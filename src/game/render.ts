import { axeConeHalf, COLS, DAMAGE_LABEL, enemySkin, ROWS, STAR_RANGE, TOWERS, typeMatchup } from "./config";
import type { GameEngine } from "./engine";
import { grid, hash2, PATH_EDGE, PATH_FILL, WAYPOINTS } from "./map";
import type { Ally, Blast, Enemy, Particle, Projectile, Slash, Tower, TowerType } from "./types";

const GRASS_A = "#171c18";
const GRASS_B = "#121610";
const BLOCK = "#1c1e22";
const INK = "#0b0c0e";

const TOWER_COLOR: Record<TowerType, string> = {
  crossbow: "#8fa0b0",
  laser: "#9eb8c4",
  axeman: "#b09078",
  mortar: "#c45c4a",
  shaman: "#7a9a78",
  arcane: "#7a9eab",
  vault: "#c4a574",
  barracks: "#b8a078",
};

export function resizeCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function layout(canvas: HTMLCanvasElement) {
  const w = canvas.width;
  const h = canvas.height;
  const pad = Math.min(w, h) * 0.03;
  const cell = Math.min((w - pad * 2) / COLS, (h - pad * 2) / ROWS);
  const ox = (w - cell * COLS) / 2;
  const oy = (h - cell * ROWS) / 2;
  return { w, h, cell, ox, oy };
}

export function render(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const { canvas } = ctx;
  const { w, h, cell, ox, oy } = layout(canvas);

  const shake = engine.trauma * engine.trauma;
  const t = performance.now() / 1000;
  const sx = shake * cell * 0.18 * Math.sin(t * 47);
  const sy = shake * cell * 0.18 * Math.cos(t * 41);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);

  ctx.translate(ox + sx, oy + sy);

  drawGround(ctx, cell);
  drawPath(ctx, cell);
  drawDecor(ctx, cell);
  drawSpawnBase(ctx, cell);

  if (engine.selectedInv != null) {
    drawHover(ctx, engine, cell);
  }

  const sel = engine.fieldTower(engine.selectedField);
  if (sel?.placed) drawRange(ctx, sel, cell);
  const ghost = engine.towers.find((x) => x.id === engine.selectedInv);
  if (ghost && engine.hoverCol >= 0) {
    const g = { ...ghost, placed: true, col: engine.hoverCol, row: engine.hoverRow };
    drawRange(ctx, g, cell);
  }

  for (const tw of engine.towers) {
    if (tw.placed && tw.type === "shaman") drawShamanField(ctx, tw, cell);
  }
  for (const tw of engine.towers) {
    if (tw.placed) drawTower(ctx, tw, cell, tw.id === engine.selectedField);
  }
  for (const e of engine.enemies) {
    if (e.alive) drawEnemy(ctx, e, cell, e.id === engine.inspectedEnemyId, engine.skinChapter());
  }
  for (const a of engine.allies) {
    if (a.alive) drawAlly(ctx, a, cell);
  }
  for (const p of engine.projectiles) {
    if (p.alive) drawProjectile(ctx, p, cell);
  }
  for (const b of engine.beams) drawBeam(ctx, b, cell);
  for (const s of engine.slashes) drawSlash(ctx, s, cell);
  for (const b of engine.blasts) drawBlast(ctx, b, cell);
  for (const p of engine.particles) drawParticle(ctx, p, cell);
  for (const f of engine.floaters) drawFloater(ctx, f, cell);

  drawVignette(ctx, cell);
}

function wx(x: number, cell: number) {
  return x * cell;
}
function wy(y: number, cell: number) {
  return y * cell;
}

function drawGround(ctx: CanvasRenderingContext2D, cell: number) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = grid[r][c];
      const n = hash2(c, r);
      if (kind === "path") continue;
      if (kind === "blocked") {
        ctx.fillStyle = BLOCK;
        ctx.fillRect(wx(c, cell), wy(r, cell), cell + 0.5, cell + 0.5);
        ctx.fillStyle = n > 0.5 ? "#24262c" : "#181a1e";
        roundRect(ctx, wx(c + 0.18, cell), wy(r + 0.18, cell), cell * 0.64, cell * 0.64, 3);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = n > 0.55 ? GRASS_A : GRASS_B;
      ctx.fillRect(wx(c, cell), wy(r, cell), cell + 0.5, cell + 0.5);
      if (n > 0.82) {
        ctx.fillStyle = "rgba(90,110,88,0.18)";
        ctx.beginPath();
        ctx.arc(wx(c + 0.7, cell), wy(r + 0.35, cell), cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPath(ctx: CanvasRenderingContext2D, cell: number) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = PATH_EDGE;
  ctx.lineWidth = cell * 0.92;
  strokeWay(ctx, cell);
  ctx.strokeStyle = PATH_FILL;
  ctx.lineWidth = cell * 0.72;
  strokeWay(ctx, cell);
  ctx.strokeStyle = "rgba(90,78,62,0.45)";
  ctx.lineWidth = cell * 0.12;
  strokeWay(ctx, cell);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== "path") continue;
      const n = hash2(c + 3, r + 7);
      if (n > 0.72) {
        ctx.fillStyle = "rgba(30,26,20,0.25)";
        ctx.fillRect(wx(c + 0.2, cell), wy(r + 0.4, cell), cell * 0.18, cell * 0.08);
      }
    }
  }
}

function strokeWay(ctx: CanvasRenderingContext2D, cell: number) {
  ctx.beginPath();
  ctx.moveTo(wx(WAYPOINTS[0].x, cell), wy(WAYPOINTS[0].y, cell));
  for (let i = 1; i < WAYPOINTS.length; i++) {
    ctx.lineTo(wx(WAYPOINTS[i].x, cell), wy(WAYPOINTS[i].y, cell));
  }
  ctx.stroke();
}

function drawDecor(ctx: CanvasRenderingContext2D, cell: number) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== "blocked") continue;
      const x = wx(c + 0.5, cell);
      const y = wy(r + 0.5, cell);
      ctx.fillStyle = "#2a2d34";
      ctx.beginPath();
      ctx.moveTo(x, y - cell * 0.28);
      ctx.lineTo(x + cell * 0.22, y + cell * 0.18);
      ctx.lineTo(x - cell * 0.22, y + cell * 0.18);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawSpawnBase(ctx: CanvasRenderingContext2D, cell: number) {
  const s = WAYPOINTS[0];
  const b = WAYPOINTS[WAYPOINTS.length - 1];
  ctx.strokeStyle = "#6a6258";
  ctx.lineWidth = 2;
  ctx.strokeRect(wx(s.x - 0.42, cell), wy(s.y - 0.38, cell), cell * 0.5, cell * 0.76);
  ctx.fillStyle = "#2a2620";
  ctx.fillRect(wx(s.x - 0.42, cell), wy(s.y - 0.38, cell), cell * 0.18, cell * 0.76);

  ctx.fillStyle = "#3a3230";
  roundRect(ctx, wx(b.x - 0.38, cell), wy(b.y - 0.38, cell), cell * 0.76, cell * 0.76, 6);
  ctx.fill();
  ctx.strokeStyle = "#c45c4a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#c45c4a";
  ctx.beginPath();
  ctx.arc(wx(b.x, cell), wy(b.y, cell), cell * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawHover(ctx: CanvasRenderingContext2D, engine: GameEngine, cell: number) {
  const { hoverCol: c, hoverRow: r } = engine;
  if (c < 0 || r < 0) return;
  const ok = grid[r]?.[c] === "build" && !engine.occupied.has(`${c},${r}`);
  ctx.fillStyle = ok ? "rgba(216,212,204,0.16)" : "rgba(196,92,74,0.2)";
  ctx.fillRect(wx(c, cell), wy(r, cell), cell, cell);
  ctx.strokeStyle = ok ? "rgba(216,212,204,0.55)" : "rgba(196,92,74,0.7)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(wx(c, cell) + 1, wy(r, cell) + 1, cell - 2, cell - 2);
}

function drawRange(ctx: CanvasRenderingContext2D, t: Tower, cell: number) {
  const range = TOWERS[t.type].range * STAR_RANGE[t.star];
  const x = wx(t.col + 0.5, cell);
  const y = wy(t.row + 0.5, cell);
  if (t.type === "axeman") {
    const half = axeConeHalf(t.star);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range * cell, t.angle - half, t.angle + half);
    ctx.closePath();
    ctx.fillStyle = "rgba(176,144,120,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(176,144,120,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, range * cell, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(216,212,204,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(216,212,204,0.28)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawShamanField(ctx: CanvasRenderingContext2D, t: Tower, cell: number) {
  const range = TOWERS.shaman.range * STAR_RANGE[t.star];
  const x = wx(t.col + 0.5, cell);
  const y = wy(t.row + 0.5, cell);
  const pulse = 0.5 + 0.5 * Math.sin(t.pulse * 1.6);
  ctx.beginPath();
  ctx.arc(x, y, range * cell, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(122,154,120,${0.1 + pulse * 0.06})`;
  ctx.fill();
  for (let i = 1; i <= 3; i++) {
    const rr = range * cell * (0.35 + i * 0.22 + pulse * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(154,186,152,${0.16 + pulse * 0.1})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = t.pulse * 18 * (i % 2 === 0 ? 1 : -1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t.pulse * 0.35);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rx = Math.cos(a) * range * cell * 0.72;
    const ry = Math.sin(a) * range * cell * 0.72;
    ctx.beginPath();
    ctx.arc(rx, ry, cell * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(198,216,190,${0.35 + pulse * 0.25})`;
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, range * cell * 0.18, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(216,232,212,${0.4 + pulse * 0.2})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSlash(ctx: CanvasRenderingContext2D, s: Slash, cell: number) {
  const u = 1 - s.life / s.max;
  const ease = 1 - (1 - u) * (1 - u);
  const start = s.angle - s.half;
  const end = start + s.half * 2 * Math.max(0.08, ease);
  const x = wx(s.x, cell);
  const y = wy(s.y, cell);
  const r = s.range * cell;
  const fade = 1 - u;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, start, end);
  ctx.closePath();
  ctx.fillStyle = `rgba(232,220,200,${0.28 * fade})`;
  ctx.fill();

  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.94, Math.max(start, end - 0.55), end);
  ctx.strokeStyle = `rgba(240,232,220,${0.9 * fade})`;
  ctx.lineWidth = cell * 0.16;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, start, end);
  ctx.strokeStyle = `rgba(176,144,120,${0.45 * fade})`;
  ctx.lineWidth = cell * 0.06;
  ctx.stroke();

  const tip = end;
  const tx = x + Math.cos(tip) * r;
  const ty = y + Math.sin(tip) * r;
  ctx.beginPath();
  ctx.arc(tx, ty, cell * (0.1 + u * 0.16), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(232,228,220,${0.62 * fade})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tx, ty, cell * (0.18 + u * 0.2), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(232,220,200,${0.4 * fade})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTower(ctx: CanvasRenderingContext2D, t: Tower, cell: number, selected: boolean) {
  const x = wx(t.col + 0.5, cell);
  const y = wy(t.row + 0.5, cell);
  const col = TOWER_COLOR[t.type];
  const s = cell * (0.34 + t.star * 0.02);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.55, s * 0.7, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  if (t.type === "axeman" && t.pulse < 0.28) {
    const u = t.pulse / 0.28;
    ctx.beginPath();
    ctx.arc(x, y, s * (1.1 + u * 1.6), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(176,144,120,${0.45 * (1 - u)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (t.type === "mortar" && t.pulse < 0.22) {
    const u = t.pulse / 0.22;
    ctx.beginPath();
    ctx.arc(x, y, s * (1.2 + u * 2.4), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(196,92,74,${0.55 * (1 - u)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = "#2a2c32";
  ctx.beginPath();
  ctx.arc(x, y, s * 0.85, 0, Math.PI * 2);
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = "#e8e4dc";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y);
  const swing = t.type === "axeman" && t.pulse < 0.28 ? Math.sin((t.pulse / 0.28) * Math.PI) * 0.7 : 0;
  ctx.rotate(t.angle + swing);
  drawTowerGlyph(ctx, t.type, s, col);
  ctx.restore();

  drawStars(ctx, x, y - s * 1.15, t.star, cell);
}

function drawTowerGlyph(ctx: CanvasRenderingContext2D, type: TowerType, s: number, col: string) {
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  if (type === "crossbow") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, 0);
    ctx.lineTo(s * 0.7, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, -0.9, 0.9);
    ctx.stroke();
  } else if (type === "laser") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.18);
    ctx.lineTo(s * 0.75, 0);
    ctx.lineTo(-s * 0.1, s * 0.18);
    ctx.closePath();
    ctx.fill();
  } else if (type === "axeman") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.08);
    ctx.lineTo(s * 0.55, -s * 0.22);
    ctx.lineTo(s * 0.62, 0);
    ctx.lineTo(s * 0.55, s * 0.22);
    ctx.lineTo(-s * 0.15, s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d8c8b4";
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, 0);
    ctx.lineTo(s * 0.2, 0);
    ctx.stroke();
  } else if (type === "mortar") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8c8b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "shaman") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "vault") {
    ctx.fillRect(-s * 0.32, -s * 0.22, s * 0.64, s * 0.5);
    ctx.strokeRect(-s * 0.32, -s * 0.22, s * 0.64, s * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "#e8d8b8";
    ctx.fill();
  } else if (type === "barracks") {
    ctx.fillRect(-s * 0.38, s * 0.08, s * 0.76, s * 0.28);
    ctx.strokeRect(-s * 0.38, s * 0.08, s * 0.76, s * 0.28);
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.08);
    ctx.lineTo(-s * 0.22, -s * 0.42);
    ctx.lineTo(s * 0.2, -s * 0.18);
    ctx.lineTo(-s * 0.22, -s * 0.02);
    ctx.closePath();
    ctx.fill();
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, star: number, cell: number) {
  const gap = cell * 0.12;
  const start = x - ((star - 1) * gap) / 2;
  ctx.fillStyle = "#e8e4dc";
  for (let i = 0; i < star; i++) {
    const px = start + i * gap;
    ctx.beginPath();
    ctx.moveTo(px, y - 3);
    ctx.lineTo(px + 2.4, y + 1.4);
    ctx.lineTo(px - 2.4, y + 1.4);
    ctx.closePath();
    ctx.fill();
  }
}

function drawAlly(ctx: CanvasRenderingContext2D, a: Ally, cell: number) {
  const x = wx(a.x, cell);
  const y = wy(a.y, cell);
  const r = a.radius * cell;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.65, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a.angle);
  ctx.fillStyle = a.flash > 0 ? "#f4f0e8" : "#d8d2c4";
  roundRect(ctx, -r * 0.7, -r * 0.75, r * 1.4, r * 1.5, 2);
  ctx.fill();
  ctx.fillStyle = "#3e4a46";
  ctx.fillRect(-r * 0.45, -r * 0.95, r * 0.9, r * 0.42);
  ctx.fillStyle = "#c4a574";
  ctx.fillRect(r * 0.15, -r * 0.15, r * 0.85, r * 0.22);
  ctx.restore();
  const bw = r * 2;
  const bh = Math.max(2, cell * 0.04);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - bw / 2, y - r - bh - 3, bw, bh);
  ctx.fillStyle = "#c8c2b4";
  ctx.fillRect(x - bw / 2, y - r - bh - 3, bw * Math.max(0, a.hp / a.maxHp), bh);
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  cell: number,
  selected: boolean,
  chapter: number,
) {
  const x = wx(e.x, cell);
  const y = wy(e.y, cell);
  const r = e.radius * cell;
  const flash = e.flash > 0 ? 0.55 : 0;
  const skin = enemySkin(chapter, e.type);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.7, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.slowT > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(122,154,120,${0.35 + Math.min(0.4, e.slowT)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.65, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,228,220,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (e.type === "infantry") {
    ctx.fillStyle = mix(skin.fill, "#fff", flash);
    roundRect(ctx, x - r, y - r, r * 2, r * 2, 3);
    ctx.fill();
    ctx.fillStyle = skin.accent;
    ctx.fillRect(x - r * 0.5, y - r * 0.9, r, r * 0.5);
  } else if (e.type === "armored") {
    ctx.fillStyle = mix(skin.fill, "#fff", flash);
    hex(ctx, x, y, r * 1.15);
    ctx.fill();
    ctx.strokeStyle = skin.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (e.type === "swarm") {
    ctx.fillStyle = mix(skin.fill, "#fff", flash);
    for (const o of [
      [-0.4, -0.2],
      [0.35, -0.15],
      [0.05, 0.35],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + o[0] * r * 1.4, y + o[1] * r * 1.4, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (e.type === "spirit") {
    ctx.fillStyle = mix(skin.fill, "#fff", flash);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skin.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = mix(skin.fill, "#fff", flash);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r * 1.1, y + r * 0.7);
    ctx.lineTo(x - r * 1.1, y + r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin.accent;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  const bw = r * 2.2;
  const bh = Math.max(3, cell * 0.05);
  const ratio = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - bw / 2, y - r - bh - 4, bw, bh);
  ctx.fillStyle = ratio > 0.45 ? "#7a9a78" : "#c45c4a";
  ctx.fillRect(x - bw / 2, y - r - bh - 4, bw * ratio, bh);

  if (selected) {
    drawInspectCard(ctx, e, x, y, r, cell);
  }
}

function drawInspectCard(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  x: number,
  y: number,
  r: number,
  cell: number,
) {
  const m = typeMatchup(e.type);
  const weak = m.weak.map((d) => DAMAGE_LABEL[d]).join(" ") || "none";
  const resist = m.resist.map((d) => DAMAGE_LABEL[d]).join(" ") || "none";
  const hp = `${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}`;
  const lines = [`${hp}`, `2x ${weak}`, `½ ${resist}`];
  const font = `700 ${Math.max(11, cell * 0.2)}px Nunito, sans-serif`;
  ctx.font = font;
  ctx.textAlign = "left";
  let tw = 0;
  for (const line of lines) tw = Math.max(tw, ctx.measureText(line).width);
  const pad = 8;
  const lineH = Math.max(14, cell * 0.26);
  const boxW = tw + pad * 2;
  const boxH = lineH * lines.length + pad * 1.4;
  let bx = x + r + 8;
  let by = y - boxH / 2;
  if (bx + boxW > COLS * cell - 4) bx = x - r - 8 - boxW;
  if (by < 4) by = 4;
  if (by + boxH > ROWS * cell - 4) by = ROWS * cell - 4 - boxH;

  ctx.fillStyle = "rgba(11,12,14,0.88)";
  roundRect(ctx, bx, by, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(232,228,220,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#e8e4dc";
  ctx.fillText(lines[0], bx + pad, by + pad + lineH * 0.72);
  ctx.fillStyle = "#7a9a78";
  ctx.fillText(lines[1], bx + pad, by + pad + lineH * 1.72);
  ctx.fillStyle = "#c45c4a";
  ctx.fillText(lines[2], bx + pad, by + pad + lineH * 2.72);
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, cell: number) {
  const x = wx(p.x, cell);
  const y = wy(p.y, cell);
  const ang = Math.atan2(p.ty - p.y0, p.tx - p.x0);

  if (p.kind === "meteor") {
    const u = Math.max(0, Math.min(1, p.t / p.dur));
    ctx.beginPath();
    ctx.arc(wx(p.tx, cell), wy(p.ty, cell), p.splash * cell, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(122,158,171,${0.25 + u * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(122,158,171,${0.06 + u * 0.08})`;
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = "rgba(158,192,200,0.4)";
    ctx.beginPath();
    ctx.ellipse(-cell * 0.34, 0, cell * 0.46, cell * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8eef2";
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a9eab";
    ctx.beginPath();
    ctx.moveTo(cell * 0.22, 0);
    ctx.lineTo(-cell * 0.12, -cell * 0.14);
    ctx.lineTo(-cell * 0.12, cell * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(216,212,204,0.28)";
  ctx.fillRect(-cell * 0.38, -cell * 0.035, cell * 0.32, cell * 0.07);
  ctx.fillStyle = "#e8e4dc";
  ctx.fillRect(-cell * 0.16, -cell * 0.04, cell * 0.34, cell * 0.08);
  ctx.beginPath();
  ctx.moveTo(cell * 0.22, 0);
  ctx.lineTo(cell * 0.08, -cell * 0.09);
  ctx.lineTo(cell * 0.08, cell * 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  b: { x1: number; y1: number; x2: number; y2: number; life: number; max: number; color: string; width: number },
  cell: number,
) {
  const a = Math.max(0, b.life / b.max);
  const x1 = wx(b.x1, cell);
  const y1 = wy(b.y1, cell);
  const x2 = wx(b.x2, cell);
  const y2 = wy(b.y2, cell);
  ctx.lineCap = "round";
  ctx.globalAlpha = a * 0.45;
  ctx.strokeStyle = b.color;
  ctx.lineWidth = b.width * cell * 3.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#f4f8fa";
  ctx.lineWidth = b.width * cell * 1.15;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBlast(ctx: CanvasRenderingContext2D, b: Blast, cell: number) {
  const u = 1 - b.life / b.max;
  const fade = Math.max(0, b.life / b.max);
  const cx = wx(b.x, cell);
  const cy = wy(b.y, cell);

  if (b.kind === "linger") {
    const r = b.r * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(122,154,120,${0.12 * fade})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(154,186,152,${0.45 * fade})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.7 + 0.08 * Math.sin(b.life * 6)), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(198,216,190,${0.28 * fade})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }

  if (b.kind === "bubble") {
    const r = b.r * cell * (0.25 + u * 0.85);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = fade * 0.72;
    ctx.fill();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = "rgba(255,236,214,0.7)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy - r * 0.22, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,248,236,0.35)";
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  if (b.kind === "hit") {
    const r = b.r * cell * (0.4 + u * 1.1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = fade * 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const r = b.r * cell * (0.4 + u * 0.7);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = b.color;
  ctx.globalAlpha = fade * 0.9;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, cell: number) {
  const a = Math.max(0, p.life / p.max);
  ctx.globalAlpha = a;
  ctx.fillStyle = p.color;
  const x = wx(p.x, cell);
  const y = wy(p.y, cell);
  if (p.shape === "spark") {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillRect(-p.size * cell * 1.8, -p.size * cell * 0.35, p.size * cell * 3.6, p.size * cell * 0.7);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.4, p.size * cell * (0.8 + (1 - a) * 0.6)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloater(
  ctx: CanvasRenderingContext2D,
  f: { x: number; y: number; text: string; life: number; max: number; color: string },
  cell: number,
) {
  ctx.globalAlpha = Math.max(0, f.life / f.max);
  ctx.fillStyle = f.color;
  ctx.font = `600 ${Math.max(10, cell * 0.22)}px "IBM Plex Sans KR", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(f.text, wx(f.x, cell), wy(f.y, cell));
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D, cell: number) {
  const w = COLS * cell;
  const h = ROWS * cell;
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function mix(a: string, _b: string, t: number) {
  if (t <= 0) return a;
  return t > 0.3 ? "#efece6" : a;
}

function pointerToCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const dpr = canvas.width / rect.width;
  return { px: (clientX - rect.left) * dpr, py: (clientY - rect.top) * dpr };
}

export function hitWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const p = pointerToCanvas(canvas, clientX, clientY);
  if (!p) return null;
  const { cell, ox, oy } = layout(canvas);
  return { x: (p.px - ox) / cell, y: (p.py - oy) / cell };
}

export function hitCell(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { col: number; row: number } | null {
  const world = hitWorld(canvas, clientX, clientY);
  if (!world) return null;
  const col = Math.floor(world.x);
  const row = Math.floor(world.y);
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  return { col, row };
}
