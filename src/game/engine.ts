import {
  axeConeHalf,
  atkRateScale,
  atkScale,
  barracksCap,
  barracksHp,
  BENCH_SIZE,
  chapterWaves,
  CHAPTERS,
  COLS,
  DAMAGE_LABEL,
  DMG_UP,
  ENDLESS_ID,
  ENEMIES,
  enemyName,
  endlessWave,
  healCost,
  hitsAir,
  hpScale,
  investedCost,
  loadProgress,
  mergeNeed,
  RATE_UP,
  RESIST,
  RESTOCK_COST,
  ROWS,
  saveProgress,
  SELL_RATIO,
  SHOP_SIZE,
  SLOT_MAX_UP,
  slotCap,
  slotUpgradeCost,
  speedScale,
  STAR_DMG,
  STAR_RANGE,
  STAR_RATE,
  STAR_SPLASH,
  START_GOLD,
  START_LIVES,
  TICK,
  TOWERS,
  TOWER_ORDER,
  towerDamage,
  typeMatchup,
  upgradeCost,
  vaultPayout,
  WAVES_PER_CHAPTER,
} from "./config";
import { isBuildable, PATH_LEN, pointOnPath, setMap } from "./map";
import { isMuted, sfx } from "./audio";
import type {
  Ally,
  Beam,
  Blast,
  DamageType,
  Enemy,
  EnemyInspect,
  Floater,
  GameScreen,
  HudSnap,
  Mark,
  MergeOffer,
  Particle,
  Projectile,
  ShopSlot,
  Slash,
  Star,
  Tower,
  TowerType,
  WavePhase,
} from "./types";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function angDiff(a: number, b: number) {
  let n = a - b;
  while (n > Math.PI) n -= Math.PI * 2;
  while (n < -Math.PI) n += Math.PI * 2;
  return n;
}

function inCone(
  ox: number,
  oy: number,
  angle: number,
  range: number,
  half: number,
  x: number,
  y: number,
) {
  const dx = x - ox;
  const dy = y - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range || d2 < 0.0001) return false;
  return Math.abs(angDiff(Math.atan2(dy, dx), angle)) <= half;
}

export class GameEngine {
  screen: GameScreen = "loading";
  phase: WavePhase = "prep";
  gold = START_GOLD;
  lives = START_LIVES;
  wave = 0;
  chapter = 0;
  unlocked = 1;
  cleared = 0;
  endless = false;
  heals = 0;
  loadProgress = 0;
  loadLabel = "Preparing the keep";
  waves = chapterWaves(0);
  shop: ShopSlot[] = [null, null, null, null];
  shopLocked = false;
  shopPrompt = false;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  allies: Ally[] = [];
  projectiles: Projectile[] = [];
  beams: Beam[] = [];
  blasts: Blast[] = [];
  slashes: Slash[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  marks: Mark[] = [];
  selectedInv: number | null = null;
  selectedField: number | null = null;
  inspectedEnemyId: number | null = null;
  inspectAcc = 0;
  hoverCol = -1;
  hoverRow = -1;
  trauma = 0;
  acc = 0;
  spawnQueue: { type: Enemy["type"]; at: number }[] = [];
  combatTime = 0;
  slotUp = 0;
  nextId = 1;
  ui = 0;
  hitstop = 0;
  listeners = new Set<() => void>();
  occupied = new Set<string>();

  constructor() {
    const p = loadProgress();
    this.unlocked = p.unlocked;
    this.cleared = p.cleared;
    this.shop = [{ type: "crossbow" }, { type: "axeman" }, { type: "mortar" }, { type: "shaman" }];
  }

  on(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private bump() {
    this.ui++;
    for (const fn of this.listeners) fn();
  }

  setLoad(progress: number, label: string) {
    this.loadProgress = Math.max(0, Math.min(100, progress));
    this.loadLabel = label;
    this.bump();
  }

  finishLoading() {
    this.loadProgress = 100;
    this.loadLabel = "Ready";
    this.screen = "chapters";
    this.bump();
  }

  openChapters() {
    this.screen = "chapters";
    this.shopPrompt = false;
    this.bump();
  }

  startGame(chapterId = this.chapter) {
    const endless = chapterId === ENDLESS_ID;
    if (endless) {
      if (this.cleared < CHAPTERS.length) {
        sfx("deny");
        return;
      }
    } else {
      if (chapterId < 0 || chapterId >= CHAPTERS.length) return;
      if (chapterId >= this.unlocked) {
        sfx("deny");
        return;
      }
    }
    this.endless = endless;
    this.chapter = endless ? 3 : chapterId;
    this.waves = endless ? [] : chapterWaves(chapterId);
    setMap(endless ? 4 : chapterId);
    this.screen = "playing";
    this.phase = "prep";
    this.gold = START_GOLD + (endless ? 40 : chapterId * 20);
    this.lives = START_LIVES;
    this.heals = 0;
    this.wave = 0;
    this.towers = [];
    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.beams = [];
    this.blasts = [];
    this.slashes = [];
    this.particles = [];
    this.floaters = [];
    this.marks = [];
    this.spawnQueue = [];
    this.selectedInv = null;
    this.selectedField = null;
    this.inspectedEnemyId = null;
    this.shopLocked = false;
    this.slotUp = 0;
    this.occupied.clear();
    this.combatTime = 0;
    this.acc = 0;
    this.trauma = 0;
    this.shopPrompt = false;
    this.hitstop = 0;
    this.shop = [
      { type: "crossbow" },
      { type: "axeman" },
      { type: "mortar" },
      { type: "shaman" },
    ];
    sfx("wave");
    this.bump();
  }

  skinChapter() {
    if (!this.endless) return this.chapter;
    return (Math.max(1, this.wave) - 1) % CHAPTERS.length;
  }

  heal() {
    if (this.screen !== "playing") return false;
    if (this.lives >= START_LIVES) {
      sfx("deny");
      return false;
    }
    const cost = healCost(this.heals);
    if (this.gold < cost) {
      sfx("deny");
      return false;
    }
    this.gold -= cost;
    this.lives += 1;
    this.heals += 1;
    sfx("buy");
    this.bump();
    return true;
  }

  pause() {
    if (this.screen === "playing") {
      this.screen = "paused";
      this.bump();
    }
  }

  resume() {
    if (this.screen === "paused") {
      this.screen = "playing";
      this.bump();
    }
  }

  update(dt: number) {
    if (this.screen !== "playing") {
      this.trauma = Math.max(0, this.trauma - dt * 3);
      this.tickFx(dt);
      return;
    }
    this.acc += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.tickFx(dt);
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
      return;
    }
    let steps = 0;
    while (this.acc >= TICK && steps < 5) {
      this.acc -= TICK;
      this.step(TICK);
      steps++;
    }
    this.tickFx(dt);
  }

  private step(dt: number) {
    if (this.phase === "combat") {
      this.combatTime += dt;
      this.spawn(dt);
      this.tickAllies(dt);
      this.tickEnemies(dt);
      this.tickTowers(dt);
      this.tickProjectiles(dt);
      this.tickMarks(dt);
      this.checkWaveEnd();
    } else {
      this.tickTowersIdle(dt);
    }
    this.trauma = Math.max(0, this.trauma - dt * 2.8);
    if (this.inspectedEnemyId != null) {
      this.inspectAcc += dt;
      if (this.inspectAcc >= 0.12) {
        this.inspectAcc = 0;
        const e = this.enemies.find((x) => x.id === this.inspectedEnemyId);
        if (!e?.alive) this.inspectedEnemyId = null;
        this.bump();
      }
    }
  }

  private spawn(_dt: number) {
    while (this.spawnQueue.length && this.spawnQueue[0]!.at <= this.combatTime) {
      const s = this.spawnQueue.shift()!;
      this.makeEnemy(s.type);
    }
  }

  private makeEnemy(type: Enemy["type"]) {
    const def = ENEMIES[type];
    const w = Math.max(1, this.wave);
    const p = pointOnPath(0);
    const hp = Math.round(def.hp * hpScale(w, this.chapter, this.endless));
    this.enemies.push({
      id: this.nextId++,
      alive: true,
      type,
      x: p.x,
      y: p.y,
      dist: 0,
      hp,
      maxHp: hp,
      speed: def.speed * speedScale(w, this.chapter, this.endless),
      gold: def.gold + Math.floor(w / 2) + this.chapter * 2 + (this.endless ? Math.floor(w / 3) : 0),
      leakLives: def.leakLives,
      radius: def.radius,
      slowT: 0,
      slowMul: 1,
      shredT: 0,
      shredMul: 1,
      burnT: 0,
      burnDps: 0,
      flash: 0,
      atk: Math.round(def.atk * atkScale(w, this.chapter, this.endless)),
      atkRate: def.atkRate * atkRateScale(w, this.chapter, this.endless),
      atkCd: 0.18,
      air: type === "flyer",
      age: 0,
      stunCd: type === "boss" ? 5 : 0,
    });
  }

  private hexRoot() {
    return this.towers.some((t) => t.placed && t.type === "shaman" && t.star >= 6);
  }

  private tickBossStun(e: Enemy, dt: number) {
    e.stunCd -= dt;
    if (e.stunCd > 0) return;
    e.stunCd = 5;
    const r2 = 9 * 9;
    let n = 0;
    for (const t of this.towers) {
      if (!t.placed) continue;
      const dx = t.col + 0.5 - e.x;
      const dy = t.row + 0.5 - e.y;
      if (dx * dx + dy * dy <= r2) {
        t.stunT = 2;
        n += 1;
      }
    }
    if (n) {
      this.blasts.push({
        x: e.x,
        y: e.y,
        r: 9,
        life: 0.4,
        max: 0.4,
        color: "rgba(196,92,74,0.28)",
        kind: "ring",
      });
      this.trauma = clamp(this.trauma + 0.1, 0, 1);
      sfx("boom");
    }
  }

  private tickEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.age += dt;
      if (e.slowT > 0) e.slowT -= dt;
      else e.slowMul = 1;
      if (e.shredT > 0) e.shredT -= dt;
      else e.shredMul = 1;
      if (e.burnT > 0) {
        e.burnT -= dt;
        this.hurt(e, e.burnDps * dt, "explosive", false, "mortar");
      }
      if (e.flash > 0) e.flash -= dt;
      const rooted = this.hexRoot() && e.age >= 3;
      const spd = rooted ? 0 : e.speed * (e.slowT > 0 ? e.slowMul : 1);
      const blocker = e.air ? null : this.blockerAhead(e);
      if (blocker) {
        const gap = e.radius + blocker.radius + 0.08;
        if (e.dist > blocker.dist - gap) e.dist = Math.max(0, blocker.dist - gap);
        e.atkCd -= dt;
        if (e.atkCd <= 0) {
          e.atkCd = 1 / Math.max(0.2, e.atkRate);
          this.hitAlly(blocker, e.atk);
        }
      } else {
        e.dist += spd * dt;
        if (e.atkCd > 0) e.atkCd -= dt;
      }
      if (e.dist >= PATH_LEN) {
        e.alive = false;
        if (this.inspectedEnemyId === e.id) this.inspectedEnemyId = null;
        this.lives -= e.leakLives;
        this.trauma = clamp(this.trauma + 0.18, 0, 1);
        sfx("leak");
        this.bump();
        if (this.lives <= 0) {
          this.lives = 0;
          this.screen = "lost";
          sfx("lose");
          this.bump();
        }
        continue;
      }
      const p = pointOnPath(e.dist);
      e.x = p.x;
      e.y = p.y;
      if (e.type === "boss") this.tickBossStun(e, dt);
    }
    if (this.enemies.length > 120) this.enemies = this.enemies.filter((e) => e.alive);
  }

  private blockerAhead(e: Enemy): Ally | null {
    let best: Ally | null = null;
    let bestGap = 1e9;
    const reach = e.radius + 0.42;
    for (const a of this.allies) {
      if (!a.alive) continue;
      const gap = a.dist - e.dist;
      if (gap < -0.12) continue;
      const dx = a.x - e.x;
      const dy = a.y - e.y;
      if (dx * dx + dy * dy > (reach + a.radius) * (reach + a.radius)) continue;
      if (gap < bestGap) {
        bestGap = gap;
        best = a;
      }
    }
    return best;
  }

  private hitAlly(a: Ally, dmg: number) {
    if (!a.alive) return;
    a.hp -= dmg;
    a.flash = 0.12;
    this.burst(a.x, a.y, "#e8d8c8", 5, "spark");
    sfx("hit");
    if (a.hp <= 0) this.killAlly(a);
  }

  private killAlly(a: Ally) {
    if (!a.alive) return;
    a.alive = false;
    a.hp = 0;
    this.burst(a.x, a.y, "#d8d0c4", 8, "spark");
    this.blasts.push({
      x: a.x,
      y: a.y,
      r: 0.32,
      life: 0.14,
      max: 0.14,
      color: "rgba(216,208,196,0.5)",
      kind: "hit",
    });
  }

  private packFrontRally(tx: number, ty: number, range: number): number | null {
    const r2 = range * range;
    let inRange = false;
    let lead: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive || e.air) continue;
      if (!lead || e.dist > lead.dist) lead = e;
      const dx = e.x - tx;
      const dy = e.y - ty;
      if (dx * dx + dy * dy <= r2) inRange = true;
    }
    if (!inRange || !lead) return null;
    return Math.min(PATH_LEN - 0.08, lead.dist + 1.05);
  }

  private spawnAlly(t: Tower, rally: number) {
    const mine = this.allies.filter((a) => a.alive && a.from === t.id).length;
    const dist = Math.min(PATH_LEN - 0.08, rally + 0.22 * mine);
    const p = pointOnPath(dist);
    const ahead = pointOnPath(Math.max(0, dist - 0.2));
    this.allies.push({
      id: this.nextId++,
      alive: true,
      from: t.id,
      x: p.x,
      y: p.y,
      dist,
      radius: 0.2,
      hp: barracksHp(t.star, t.dmgUp),
      maxHp: barracksHp(t.star, t.dmgUp),
      damage: towerDamage(t),
      atkRate: 0.95 + t.star * 0.1,
      cooldown: 0.12,
      angle: Math.atan2(ahead.y - p.y, ahead.x - p.x),
      flash: 0,
    });
    this.burst(p.x, p.y, "#c8c4b8", 6, "puff");
    sfx("place");
  }

  private tickAllies(dt: number) {
    const alive = this.enemies.filter((e) => e.alive && !e.air);
    const speed = 1.7;
    for (const a of this.allies) {
      if (!a.alive) continue;
      if (a.flash > 0) a.flash -= dt;
      a.cooldown -= dt;
      let target: Enemy | null = null;
      let best = 1e9;
      let hunt: Enemy | null = null;
      let huntD = 1e9;
      const reach = a.radius + 0.5;
      for (const e of alive) {
        const dx = e.x - a.x;
        const dy = e.y - a.y;
        const d2 = dx * dx + dy * dy;
        const along = Math.abs(e.dist - a.dist);
        if (along < huntD) {
          huntD = along;
          hunt = e;
        }
        if (d2 <= (reach + e.radius) * (reach + e.radius) && d2 < best) {
          best = d2;
          target = e;
        }
      }
      if (target) {
        a.angle = Math.atan2(target.y - a.y, target.x - a.x);
        if (a.cooldown <= 0) {
          a.cooldown = 1 / Math.max(0.3, a.atkRate);
          this.hurt(target, a.damage, "physical", true, "ally");
          this.slashes.push({
            x: a.x,
            y: a.y,
            angle: a.angle,
            range: 0.55,
            half: 0.7,
            life: 0.18,
            max: 0.18,
          });
          this.burst(target.x, target.y, "#e8dcc8", 4, "spark");
        }
      } else if (hunt) {
        const gap = a.radius + hunt.radius + 0.12;
        if (hunt.dist > a.dist + gap) a.dist += speed * dt;
        else if (hunt.dist < a.dist - gap) a.dist -= speed * dt;
        const look = hunt.dist >= a.dist ? a.dist + 0.2 : a.dist - 0.2;
        const next = pointOnPath(Math.max(0, Math.min(PATH_LEN, look)));
        a.angle = Math.atan2(next.y - a.y, next.x - a.x);
      }
      a.dist = Math.max(0, Math.min(PATH_LEN - 0.08, a.dist));
      const p = pointOnPath(a.dist);
      a.x = p.x;
      a.y = p.y;
    }
    if (this.allies.length > 64) this.allies = this.allies.filter((a) => a.alive);
  }

  refresh() {
    this.bump();
  }

  private rateBuffAt(x: number, y: number): number {
    let best = 1;
    for (const t of this.towers) {
      if (!t.placed || t.type !== "shaman") continue;
      const range = TOWERS.shaman.range * STAR_RANGE[t.star]!;
      const dx = t.col + 0.5 - x;
      const dy = t.row + 0.5 - y;
      if (dx * dx + dy * dy <= range * range) {
        const mul = 1 + 0.14 * t.star + t.rateUp * 0.04;
        if (mul > best) best = mul;
      }
    }
    return best;
  }

  private tickVault(t: Tower, dt: number) {
    if (t.stunT > 0) return;
    t.pulse += dt;
    if (t.star >= 6) {
      this.gold += 3000 * dt;
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        t.cooldown = 0.4;
        this.floaters.push({
          x: t.col + 0.5,
          y: t.row + 0.15,
          vy: -0.55,
          text: "+3000/s",
          life: 0.7,
          max: 0.7,
          color: "#c4a574",
        });
        this.bump();
      }
      return;
    }
    t.cooldown -= dt;
    if (t.cooldown > 0) return;
    const rate = TOWERS.vault.fireRate * STAR_RATE[t.star]! * RATE_UP[t.rateUp]!;
    t.cooldown = 1 / Math.max(0.08, rate);
    const pay = vaultPayout(t);
    this.gold += pay;
    this.floaters.push({
      x: t.col + 0.5,
      y: t.row + 0.15,
      vy: -0.55,
      text: `+${pay}`,
      life: 0.85,
      max: 0.85,
      color: "#c4a574",
    });
    sfx("buy");
    this.bump();
  }

  private tickTowersIdle(dt: number) {
    for (const t of this.towers) {
      if (!t.placed) continue;
      if (t.stunT > 0) t.stunT = Math.max(0, t.stunT - dt);
      if (t.type === "vault") continue;
      t.pulse += dt;
      t.cooldown = Math.max(0, t.cooldown - dt);
    }
  }

  private tickTowers(dt: number) {
    const alive = this.enemies.filter((e) => e.alive);
    for (const t of this.towers) {
      if (!t.placed) continue;
      if (t.stunT > 0) {
        t.stunT -= dt;
        continue;
      }
      if (t.type === "vault") {
        this.tickVault(t, dt);
        continue;
      }
      t.pulse += dt;
      t.cooldown -= dt;
      const def = TOWERS[t.type];
      const range = def.range * STAR_RANGE[t.star]!;
      const r2 = range * range;
      const tx = t.col + 0.5;
      const ty = t.row + 0.5;

      if (t.type === "barracks") {
        if (t.star < 6 && t.cooldown > 0) continue;
        const cap = barracksCap(t.star);
        const mine = this.allies.filter((a) => a.alive && a.from === t.id).length;
        if (mine >= cap) continue;
        if (!alive.some((e) => !e.air)) continue;
        const rally = this.packFrontRally(tx, ty, range);
        if (rally == null) continue;
        const rate = def.fireRate * STAR_RATE[t.star]! * RATE_UP[t.rateUp]! * this.rateBuffAt(tx, ty);
        t.cooldown = t.star >= 6 ? 0 : 1 / Math.max(0.08, rate);
        t.angle = 0;
        this.spawnAlly(t, rally);
        continue;
      }

      if (t.type === "shaman") {
        let affecting = false;
        for (const e of alive) {
          const dx = e.x - tx;
          const dy = e.y - ty;
          if (dx * dx + dy * dy <= r2) {
            affecting = true;
            e.slowT = 0.95;
            e.slowMul = Math.max(0.42, 0.72 - t.star * 0.06);
            e.shredT = 0.95;
            e.shredMul = 1.18 + t.star * 0.06;
          }
        }
        if (affecting) {
          t.pulse = Math.min(t.pulse, 8);
          this.ensureLinger(tx, ty, range);
          if (Math.random() < 0.18) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * range;
            this.particles.push({
              x: tx + Math.cos(a) * d,
              y: ty + Math.sin(a) * d,
              vx: (Math.random() - 0.5) * 0.2,
              vy: -0.15 - Math.random() * 0.2,
              life: 0.9,
              max: 0.9,
              size: 0.06,
              color: "#9ab898",
              shape: "puff",
            });
          }
        }
      }

      if (t.star >= 6 && t.type === "arcane") {
        t.cooldown = 0;
        for (const e of alive) this.hurt(e, def.damage * STAR_DMG[t.star]! * DMG_UP[t.dmgUp]!, def.damageType, true, "arcane");
        if (alive[0]) this.spawnMeteor(alive[0].x, alive[0].y, 0, 1.2, def.damageType);
        if (alive[1]) this.spawnMeteor(alive[1].x, alive[1].y, 0, 0.9, def.damageType);
        sfx("magic");
        continue;
      }

      if (t.cooldown > 0) continue;
      const rate =
        def.fireRate *
        STAR_RATE[t.star]! *
        RATE_UP[t.rateUp]! *
        (t.type === "shaman" ? 1 : this.rateBuffAt(tx, ty));
      const cd = 1 / Math.max(0.05, rate);
      let target: Enemy | null = null;
      let bestDist = -1;
      for (const e of alive) {
        if (e.air && !hitsAir(t.type)) continue;
        const dx = e.x - tx;
        const dy = e.y - ty;
        if (dx * dx + dy * dy <= r2 && e.dist > bestDist) {
          bestDist = e.dist;
          target = e;
        }
      }
      if (!target) continue;
      t.angle = Math.atan2(target.y - ty, target.x - tx);
      t.cooldown = cd;
      this.fire(t, target, tx, ty, alive, range);
    }
  }

  private fire(t: Tower, target: Enemy, tx: number, ty: number, alive: Enemy[], range: number) {
    const def = TOWERS[t.type];
    const dmg = def.damage * STAR_DMG[t.star]! * DMG_UP[t.dmgUp]!;
    const splash = def.splash * STAR_SPLASH[t.star]!;
    const src = t.type;

    if (t.type === "axeman") {
      const half = axeConeHalf(t.star);
      let hits = 0;
      for (const e of alive) {
        if (e.air) continue;
        if (inCone(tx, ty, t.angle, range, half, e.x, e.y)) {
          this.hurt(e, dmg, def.damageType, true, src);
          hits += 1;
        }
      }
      if (hits === 0 && !target.air) this.hurt(target, dmg, def.damageType, true, src);
      this.slashes.push({ x: tx, y: ty, angle: t.angle, range, half, life: 0.34, max: 0.34 });
      t.pulse = 0;
      sfx("axe");
      this.trauma = clamp(this.trauma + 0.06, 0, 1);
      const tipX = tx + Math.cos(t.angle) * range * 0.85;
      const tipY = ty + Math.sin(t.angle) * range * 0.85;
      this.burst(tipX, tipY, "#e8d8c4", 10, "spark");
      this.blasts.push({
        x: tipX,
        y: tipY,
        r: 0.45,
        life: 0.16,
        max: 0.16,
        color: "rgba(232,220,200,0.45)",
        kind: "hit",
      });
      return;
    }

    if (t.type === "laser") {
      this.hurt(target, dmg, def.damageType, true, src);
      this.beams.push({
        x1: tx,
        y1: ty,
        x2: target.x,
        y2: target.y,
        life: 0.22,
        max: 0.22,
        color: t.star >= 4 ? "#e8f0f4" : "#b8d0dc",
        width: 0.08 + t.star * 0.018,
      });
      this.blasts.push({
        x: target.x,
        y: target.y,
        r: 0.38,
        life: 0.14,
        max: 0.14,
        color: "rgba(200,224,232,0.55)",
        kind: "hit",
      });
      this.burst(target.x, target.y, "#d8ecf0", 6, "spark");
      this.trauma = clamp(this.trauma + 0.03, 0, 1);
      sfx("laser");
      if (t.star >= 6) {
        let prev = target;
        const seen = new Set<number>([target.id]);
        for (let hop = 0; hop < 8; hop++) {
          let nxt: Enemy | null = null;
          let nd = 1e9;
          for (const e of alive) {
            if (!e.alive || seen.has(e.id)) continue;
            const dx = e.x - prev.x;
            const dy = e.y - prev.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < nd && d2 <= 2.4 * 2.4) {
              nd = d2;
              nxt = e;
            }
          }
          if (!nxt) break;
          seen.add(nxt.id);
          this.hurt(nxt, 500, def.damageType, true, src);
          this.beams.push({
            x1: prev.x,
            y1: prev.y,
            x2: nxt.x,
            y2: nxt.y,
            life: 0.16,
            max: 0.16,
            color: "#e8f4f8",
            width: 0.05,
          });
          prev = nxt;
        }
      } else if (t.star >= 4) {
        let extra: Enemy | null = null;
        let extraD = 1e9;
        for (const e of alive) {
          if (e === target || !e.alive) continue;
          if (e.air && !hitsAir("laser")) continue;
          const dx = e.x - target.x;
          const dy = e.y - target.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < extraD && d2 <= 1.6 * 1.6) {
            extraD = d2;
            extra = e;
          }
        }
        if (extra) {
          this.hurt(extra, dmg * 0.55, def.damageType, true, src);
          this.beams.push({
            x1: target.x,
            y1: target.y,
            x2: extra.x,
            y2: extra.y,
            life: 0.14,
            max: 0.14,
            color: "#c5d8e0",
            width: 0.045,
          });
        }
      }
      return;
    }

    if (t.type === "crossbow") {
      if (t.star >= 6) {
        for (const e of alive) {
          const dx = e.x - tx;
          const dy = e.y - ty;
          if (dx * dx + dy * dy > range * range) continue;
          if (!this.marks.some((m) => m.enemyId === e.id)) {
            this.marks.push({ enemyId: e.id, life: 3, max: 3 });
          }
        }
        sfx("bolt");
        return;
      }
      this.hurt(target, dmg, def.damageType, true, src);
      this.burst(target.x, target.y, "#e8e4dc", 5, "spark");
      this.blasts.push({
        x: target.x,
        y: target.y,
        r: 0.28,
        life: 0.12,
        max: 0.12,
        color: "rgba(232,228,220,0.5)",
        kind: "hit",
      });
      const dist = Math.hypot(target.x - tx, target.y - ty);
      this.projectiles.push({
        alive: true,
        kind: "bolt",
        x: tx,
        y: ty,
        x0: tx,
        y0: ty,
        tx: target.x,
        ty: target.y,
        t: 0,
        dur: Math.max(0.1, dist / 12),
        damage: 0,
        splash: 0,
        dtype: def.damageType,
        pierce: 0,
        hit: [target.id],
        burn: 0,
      });
      if (t.star >= 4) {
        let extra: Enemy | null = null;
        let extraD = 1e9;
        for (const e of alive) {
          if (e === target || !e.alive) continue;
          const dx = e.x - tx;
          const dy = e.y - ty;
          const d2 = dx * dx + dy * dy;
          if (d2 <= range * range && d2 < extraD) {
            extraD = d2;
            extra = e;
          }
        }
        if (extra) this.hurt(extra, dmg * 0.55, def.damageType, true, src);
      }
      sfx("bolt");
      return;
    }

    if (t.type === "mortar") {
      if (t.star >= 6) {
        for (const e of alive) {
          if (e.air) continue;
          this.hurt(e, e.maxHp * 0.2, def.damageType, true, src);
        }
        this.blasts.push({
          x: COLS / 2,
          y: ROWS / 2,
          r: 8,
          life: 0.4,
          max: 0.4,
          color: "rgba(196,92,74,0.35)",
          kind: "bubble",
        });
        t.pulse = 0;
        sfx("boom");
        this.trauma = clamp(this.trauma + 0.12, 0, 1);
        return;
      }
      this.explode(tx, ty, range, dmg, def.damageType, t.star >= 4 ? 12 + t.star * 3 : 0, src);
      t.pulse = 0;
      return;
    }

    if (t.type === "arcane") {
      for (const e of alive) {
        const dx = e.x - tx;
        const dy = e.y - ty;
        if (dx * dx + dy * dy <= range * range) this.hurt(e, dmg, def.damageType, true, src);
      }
      this.spawnMeteor(target.x, target.y, 0, splash, def.damageType);
      sfx("magic");
      if (t.star >= 4) {
        let cluster: Enemy | null = null;
        let best = -1;
        for (const e of alive) {
          if (e === target) continue;
          const dx = e.x - tx;
          const dy = e.y - ty;
          if (dx * dx + dy * dy <= range * range && e.dist > best) {
            best = e.dist;
            cluster = e;
          }
        }
        if (cluster) this.spawnMeteor(cluster.x, cluster.y, 0, splash * 0.75, def.damageType);
      }
      return;
    }

    if (t.type === "shaman") {
      for (const e of alive) {
        const dx = e.x - tx;
        const dy = e.y - ty;
        if (dx * dx + dy * dy <= range * range) this.hurt(e, dmg, def.damageType, false, src);
      }
      this.ensureLinger(tx, ty, range);
      this.blasts.push({
        x: tx,
        y: ty,
        r: range * 0.55,
        life: 0.45,
        max: 0.45,
        color: "rgba(154,186,152,0.28)",
        kind: "ring",
      });
      sfx("shaman");
    }
  }

  private spawnMeteor(x: number, y: number, dmg: number, splash: number, dtype: DamageType) {
    const x0 = x + 0.95;
    const y0 = Math.max(-0.12, y - 2.45);
    this.projectiles.push({
      alive: true,
      kind: "meteor",
      x: x0,
      y: y0,
      x0,
      y0,
      tx: x,
      ty: y,
      t: 0,
      dur: 0.52,
      damage: dmg,
      splash,
      dtype,
      pierce: 0,
      hit: [],
      burn: 0,
    });
  }

  private tickProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.t += dt;
      const u = clamp(p.t / p.dur, 0, 1);
      p.x = p.x0 + (p.tx - p.x0) * u;
      p.y = p.y0 + (p.ty - p.y0) * u;
      if (p.kind === "meteor") {
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          life: 0.18 + Math.random() * 0.12,
          max: 0.3,
          size: 0.05 + Math.random() * 0.04,
          color: "#9ec0c8",
          shape: "puff",
        });
      }
      if (p.kind === "bolt") {
        for (const e of this.enemies) {
          if (!e.alive || p.hit.includes(e.id)) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const rr = e.radius + 0.14;
          if (dx * dx + dy * dy <= rr * rr) {
            if (p.damage > 0) this.hurt(e, p.damage, p.dtype, true, "crossbow");
            p.hit.push(e.id);
            this.burst(e.x, e.y, "#e8e4dc", 5, "spark");
            this.blasts.push({
              x: e.x,
              y: e.y,
              r: 0.28,
              life: 0.12,
              max: 0.12,
              color: "rgba(232,228,220,0.5)",
              kind: "hit",
            });
            if (p.hit.length > p.pierce) {
              p.alive = false;
              break;
            }
          }
        }
      }
      if (u >= 1) {
        p.alive = false;
        if (p.kind === "meteor" && p.damage > 0) this.explode(p.tx, p.ty, p.splash, p.damage, p.dtype, p.burn, "arcane");
        if (p.kind === "meteor" && p.damage <= 0) this.explode(p.tx, p.ty, Math.max(0.6, p.splash), 0, p.dtype, 0, "arcane");
      }
    }
  }

  private explode(
    x: number,
    y: number,
    r: number,
    dmg: number,
    dtype: DamageType,
    burn: number,
    src: TowerType = "mortar",
  ) {
    const r2 = r * r;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r2) {
        if (dmg > 0) this.hurt(e, dmg, dtype, true, src);
        if (burn > 0 && !e.air) {
          e.burnT = 2.2;
          e.burnDps = burn;
        }
      }
    }
    const magic = dtype === "magic";
    const palette = magic
      ? ["rgba(176,216,224,0.55)", "rgba(122,158,171,0.42)", "rgba(232,244,248,0.35)"]
      : ["rgba(240,176,128,0.55)", "rgba(196,92,74,0.48)", "rgba(255,220,180,0.38)"];
    for (let i = 0; i < 4; i++) {
      this.blasts.push({
        x,
        y,
        r: r * (0.28 + i * 0.24),
        life: 0.2 + i * 0.09,
        max: 0.2 + i * 0.09,
        color: palette[i % palette.length]!,
        kind: "bubble",
      });
    }
    this.blasts.push({
      x,
      y,
      r: r * 0.22,
      life: 0.14,
      max: 0.14,
      color: magic ? "rgba(240,252,255,0.7)" : "rgba(255,236,210,0.72)",
      kind: "hit",
    });
    this.burst(x, y, magic ? "#c8e4ea" : "#f0c8a8", magic ? 14 : 18, "puff");
    this.trauma = clamp(this.trauma + (magic ? 0.08 : 0.12), 0, 1);
    this.hitstop = Math.max(this.hitstop, magic ? 0.03 : 0.04);
    sfx("boom");
  }

  private ensureLinger(x: number, y: number, r: number) {
    const existing = this.blasts.find((b) => b.kind === "linger" && Math.hypot(b.x - x, b.y - y) < 0.25);
    if (existing) {
      existing.life = Math.min(existing.max, existing.life + 0.25);
      existing.r = r;
      return;
    }
    this.blasts.push({
      x,
      y,
      r,
      life: 1.15,
      max: 1.15,
      color: "rgba(122,154,120,0.32)",
      kind: "linger",
    });
  }

  private hurt(e: Enemy, raw: number, dtype: DamageType, numbers: boolean, src?: TowerType | "ally") {
    if (!e.alive) return;
    if (e.air && src && !hitsAir(src)) return;
    const mul = RESIST[e.type][dtype] * (e.shredT > 0 ? e.shredMul : 1);
    const dmg = raw * mul;
    e.hp -= dmg;
    e.flash = 0.14;
    if (numbers) {
      this.trauma = clamp(this.trauma + 0.02, 0, 1);
      if (dmg >= 8) sfx("hit");
      this.particles.push({
        x: e.x,
        y: e.y,
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.5) * 1.6,
        life: 0.16,
        max: 0.16,
        size: 0.04,
        color: "#efece6",
        shape: "spark",
      });
    }
    if (numbers && dmg >= 4) {
      this.floaters.push({
        x: e.x + (Math.random() - 0.5) * 0.2,
        y: e.y - 0.25,
        vy: -0.7,
        text: String(Math.round(dmg)),
        life: 0.7,
        max: 0.7,
        color: mul >= 1.9 ? "#e8e4dc" : mul <= 0.55 ? "#8a8680" : "#c8c2b6",
      });
    }
    if (e.hp <= 0) {
      e.alive = false;
      if (this.inspectedEnemyId === e.id) this.inspectedEnemyId = null;
      this.gold += e.gold;
      this.burst(e.x, e.y, "#c8c0b0", 10, "puff");
      this.hitstop = Math.max(this.hitstop, 0.03);
      this.trauma = clamp(this.trauma + 0.04, 0, 1);
      sfx("death");
      this.bump();
    }
  }

  private tickMarks(dt: number) {
    for (const m of this.marks) {
      m.life -= dt;
      if (m.life > 0) continue;
      const e = this.enemies.find((x) => x.id === m.enemyId && x.alive);
      if (e) {
        this.hurt(e, e.maxHp * 8, "physical", true, "crossbow");
        this.burst(e.x, e.y, "#e8e4dc", 16, "spark");
        sfx("death");
      }
    }
    this.marks = this.marks.filter((m) => m.life > 0);
  }

  private burst(x: number, y: number, color: string, n: number, shape: "puff" | "spark" = "puff") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.45 + Math.random() * 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.28 + Math.random() * 0.38,
        max: 0.55,
        size: shape === "puff" ? 0.07 + Math.random() * 0.07 : 0.03 + Math.random() * 0.04,
        color,
        shape,
      });
    }
  }

  private tickFx(dt: number) {
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const b of this.blasts) b.life -= dt;
    this.blasts = this.blasts.filter((b) => b.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private checkWaveEnd() {
    if (this.spawnQueue.length) return;
    if (this.enemies.some((e) => e.alive)) return;
    this.phase = "prep";
    this.gold += 12 + this.wave * 2;
    this.enemies = [];
    this.marks = [];
    this.inspectedEnemyId = null;
    if (!this.endless && this.wave >= WAVES_PER_CHAPTER) {
      this.cleared = Math.max(this.cleared, this.chapter + 1);
      this.unlocked = Math.max(this.unlocked, Math.min(CHAPTERS.length, this.chapter + 2));
      saveProgress(this.unlocked, this.cleared);
      this.screen = "won";
      sfx("win");
    } else {
      this.shopPrompt = true;
      sfx("wave");
    }
    this.bump();
  }

  startWave() {
    if (this.screen !== "playing" || this.phase !== "prep") return;
    if (this.shopPrompt) return;
    if (!this.endless && this.wave >= WAVES_PER_CHAPTER) return;
    this.wave += 1;
    const def = this.endless ? endlessWave(this.wave) : this.waves[this.wave - 1];
    if (!def) return;
    this.spawnQueue = [];
    this.combatTime = 0;
    this.phase = "combat";
    this.marks = [];
    for (const s of def.spawns) {
      for (let i = 0; i < s.count; i++) this.spawnQueue.push({ type: s.type, at: s.delay + i * s.interval });
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    sfx("wave");
    this.bump();
  }

  private rollShop(first: boolean) {
    const owned = new Set(this.towers.map((t) => t.type));
    const slots: ShopSlot[] = [];
    const w = [16, 12, 14, 12, 12, 10, 10, 14];
    for (let i = 0; i < SHOP_SIZE; i++) {
      let type: TowerType;
      if (first && i === 0) type = "crossbow";
      else if (owned.size && Math.random() < 0.38) {
        const arr = [...owned];
        type = arr[Math.floor(Math.random() * arr.length)]!;
      } else {
        const total = w.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        type = TOWER_ORDER[TOWER_ORDER.length - 1]!;
        for (let k = 0; k < TOWER_ORDER.length; k++) {
          r -= w[k] ?? 10;
          if (r <= 0) {
            type = TOWER_ORDER[k]!;
            break;
          }
        }
      }
      slots.push({ type });
    }
    this.shop = slots;
  }

  toggleShopLock() {
    this.shopLocked = !this.shopLocked;
    sfx("click");
    this.bump();
  }

  answerShopLock(lock: boolean) {
    if (!this.shopPrompt) return;
    this.shopPrompt = false;
    this.shopLocked = lock;
    if (!lock) this.rollShop(false);
    sfx(lock ? "click" : "buy");
    this.bump();
  }

  restock() {
    if (this.gold < RESTOCK_COST) {
      sfx("deny");
      return false;
    }
    this.gold -= RESTOCK_COST;
    this.rollShop(false);
    sfx("click");
    this.bump();
    return true;
  }

  buy(slot: number) {
    const s = this.shop[slot];
    if (!s) {
      sfx("deny");
      return false;
    }
    const cost = TOWERS[s.type].cost;
    if (this.gold < cost || this.towers.filter((t) => !t.placed).length >= BENCH_SIZE) {
      sfx("deny");
      return false;
    }
    this.gold -= cost;
    this.shop[slot] = null;
    const t: Tower = {
      id: this.nextId++,
      type: s.type,
      star: 1,
      col: -1,
      row: -1,
      placed: false,
      dmgUp: 0,
      rateUp: 0,
      cooldown: 0,
      angle: -Math.PI / 2,
      pulse: 0,
      stunT: 0,
    };
    this.towers.push(t);
    this.selectedInv = t.id;
    this.selectedField = null;
    this.inspectedEnemyId = null;
    sfx("buy");
    this.bump();
    return true;
  }

  selectInv(id: number) {
    this.selectedInv = id;
    this.selectedField = null;
    this.inspectedEnemyId = null;
    sfx("click");
    this.bump();
  }

  selectField(id: number | null) {
    this.selectedField = id;
    this.selectedInv = null;
    this.inspectedEnemyId = null;
    sfx("click");
    this.bump();
  }

  inspectEnemy(id: number) {
    this.inspectedEnemyId = id;
    this.selectedInv = null;
    this.selectedField = null;
    this.inspectAcc = 0;
    sfx("click");
    this.bump();
  }

  enemyAt(x: number, y: number) {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      const r = e.radius + 0.32;
      if (d2 <= r * r && d2 < bestD) {
        bestD = d2;
        best = e;
      }
    }
    return best;
  }

  tryPlace(col: number, row: number) {
    if (this.selectedInv == null) return false;
    if (!isBuildable(col, row)) {
      sfx("deny");
      return false;
    }
    const key = `${col},${row}`;
    if (this.occupied.has(key) || this.towers.filter((t) => t.placed).length >= slotCap(this.slotUp)) {
      sfx("deny");
      return false;
    }
    const t = this.towers.find((x) => x.id === this.selectedInv);
    if (!t || t.placed) return false;
    t.placed = true;
    t.col = col;
    t.row = row;
    this.occupied.add(key);
    this.selectedInv = null;
    this.selectedField = t.id;
    this.burst(col + 0.5, row + 0.5, "#d8d4cc", 6);
    sfx("place");
    this.bump();
    return true;
  }

  expandSlots() {
    if (this.slotUp >= SLOT_MAX_UP) {
      sfx("deny");
      return false;
    }
    const cost = slotUpgradeCost(this.slotUp + 1);
    if (this.gold < cost) {
      sfx("deny");
      return false;
    }
    this.gold -= cost;
    this.slotUp += 1;
    sfx("buy");
    this.bump();
    return true;
  }

  pickup(id: number) {
    const t = this.towers.find((x) => x.id === id);
    if (!t?.placed) return false;
    if (this.towers.filter((x) => !x.placed).length >= BENCH_SIZE) {
      sfx("deny");
      return false;
    }
    this.occupied.delete(`${t.col},${t.row}`);
    t.placed = false;
    t.col = -1;
    t.row = -1;
    this.selectedField = null;
    this.selectedInv = t.id;
    sfx("click");
    this.bump();
    return true;
  }

  sell(id: number) {
    const t = this.towers.find((x) => x.id === id);
    if (!t) return false;
    const value = Math.round(investedCost(t.type, t.star, t.dmgUp, t.rateUp) * SELL_RATIO);
    this.gold += value;
    if (t.placed) this.occupied.delete(`${t.col},${t.row}`);
    for (const a of this.allies) {
      if (a.from === id && a.alive) this.killAlly(a);
    }
    this.towers = this.towers.filter((x) => x.id !== id);
    this.selectedField = null;
    this.selectedInv = null;
    sfx("click");
    this.bump();
    return true;
  }

  upgrade(id: number, kind: "dmg" | "rate") {
    const t = this.towers.find((x) => x.id === id);
    if (!t) return false;
    const level = kind === "dmg" ? t.dmgUp : t.rateUp;
    if (level >= 3) {
      sfx("deny");
      return false;
    }
    const cost = upgradeCost(t.star, level + 1);
    if (this.gold < cost) {
      sfx("deny");
      return false;
    }
    this.gold -= cost;
    if (kind === "dmg") t.dmgUp += 1;
    else t.rateUp += 1;
    sfx("buy");
    this.bump();
    return true;
  }

  merges(): MergeOffer[] {
    const map = new Map<string, number>();
    for (const t of this.towers) {
      if (t.star >= 6) continue;
      const k = `${t.type}:${t.star}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const out: MergeOffer[] = [];
    for (const [k, count] of map) {
      const [type, starStr] = k.split(":");
      const star = Number(starStr) as Star;
      if (count < mergeNeed(star)) continue;
      out.push({ type: type as TowerType, star, count });
    }
    return out;
  }

  merge(type: TowerType, star: Star) {
    if (star >= 6) return false;
    const need = mergeNeed(star);
    const pool = this.towers
      .filter((t) => t.type === type && t.star === star)
      .sort((a, b) => Number(a.placed) - Number(b.placed) || a.dmgUp + a.rateUp - (b.dmgUp + b.rateUp));
    if (pool.length < need) {
      sfx("deny");
      return false;
    }
    const take = pool.slice(0, need);
    const dmgUp = Math.max(...take.map((t) => t.dmgUp));
    const rateUp = Math.max(...take.map((t) => t.rateUp));
    const field = take.find((t) => t.placed);
    const ids = new Set(take.map((t) => t.id));
    for (const tw of take) {
      if (tw.placed) this.occupied.delete(`${tw.col},${tw.row}`);
    }
    this.towers = this.towers.filter((tw) => !ids.has(tw.id));
    const next: Tower = {
      id: this.nextId++,
      type,
      star: (star + 1) as Star,
      col: field ? field.col : -1,
      row: field ? field.row : -1,
      placed: Boolean(field),
      dmgUp,
      rateUp,
      cooldown: 0,
      angle: field?.angle ?? -Math.PI / 2,
      pulse: 0,
      stunT: 0,
    };
    if (next.placed) this.occupied.add(`${next.col},${next.row}`);
    this.towers.push(next);
    if (type === "barracks") {
      const kept: Ally[] = [];
      for (const a of this.allies) {
        if (!a.alive) continue;
        if (ids.has(a.from)) {
          a.from = next.id;
          a.damage = towerDamage(next);
          a.atkRate = 0.95 + next.star * 0.1;
          a.maxHp = barracksHp(next.star, next.dmgUp);
          a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * 0.35));
          kept.push(a);
        }
      }
      const cap = barracksCap(next.star);
      for (let i = cap; i < kept.length; i++) this.killAlly(kept[i]!);
    }
    this.selectedField = next.placed ? next.id : null;
    this.selectedInv = next.placed ? null : next.id;
    if (next.placed) this.burst(next.col + 0.5, next.row + 0.5, "#e8e4dc", 14);
    sfx("merge");
    this.trauma = clamp(this.trauma + 0.06, 0, 1);
    this.bump();
    return true;
  }

  setHover(col: number, row: number) {
    this.hoverCol = col;
    this.hoverRow = row;
  }

  inspectSnap(): EnemyInspect | null {
    if (this.inspectedEnemyId == null) return null;
    const e = this.enemies.find((x) => x.id === this.inspectedEnemyId && x.alive);
    if (!e) return null;
    const m = typeMatchup(e.type);
    return {
      id: e.id,
      name: enemyName(this.skinChapter(), e.type),
      type: e.type,
      hp: Math.max(0, e.hp),
      maxHp: e.maxHp,
      weak: m.weak.map((d) => DAMAGE_LABEL[d]),
      resist: m.resist.map((d) => DAMAGE_LABEL[d]),
      atk: e.atk,
      atkRate: e.atkRate,
    };
  }

  snapshot(): HudSnap {
    const cap = slotCap(this.slotUp);
    const placed = this.towers.filter((t) => t.placed);
    return {
      screen: this.screen,
      phase: this.phase,
      gold: this.gold,
      lives: this.lives,
      maxLives: START_LIVES,
      healCost: healCost(this.heals),
      wave: this.wave,
      totalWaves: this.endless ? 0 : WAVES_PER_CHAPTER,
      wavePreview: this.endless
        ? endlessWave(Math.max(1, this.wave + (this.phase === "prep" ? 1 : 0))).preview
        : this.wave >= WAVES_PER_CHAPTER
          ? "Cleared"
          : (this.waves[this.wave]?.preview ?? this.waves[0]?.preview ?? ""),
      chapter: this.chapter,
      chapterName: this.endless ? "Endless Watch" : (CHAPTERS[this.chapter]?.name ?? ""),
      chapters: CHAPTERS.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.subtitle,
        unlocked: c.id < this.unlocked,
        cleared: c.id < this.cleared,
      })),
      endless: this.endless,
      endlessUnlocked: this.cleared >= CHAPTERS.length,
      loadProgress: this.loadProgress,
      loadLabel: this.loadLabel,
      enemiesAlive: this.enemies.filter((e) => e.alive).length,
      enemiesLeft: this.enemies.filter((e) => e.alive).length + this.spawnQueue.length,
      shop: this.shop.slice(),
      shopLocked: this.shopLocked,
      shopPrompt: this.shopPrompt,
      restockCost: RESTOCK_COST,
      inventory: this.towers.filter((t) => !t.placed),
      placed,
      placedCount: placed.length,
      slotCap: cap,
      slotCost: this.slotUp >= SLOT_MAX_UP ? null : slotUpgradeCost(this.slotUp + 1),
      selectedInv: this.selectedInv,
      selectedField: this.selectedField,
      inspected: this.inspectSnap(),
      merges: this.merges(),
      muted: isMuted(),
    };
  }

  fieldTower(id: number | null) {
    return this.towers.find((t) => t.id === id) ?? null;
  }
}

