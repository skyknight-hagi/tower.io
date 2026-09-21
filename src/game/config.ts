import type { DamageType, EnemyDef, EnemyType, Tower, TowerDef, TowerType, WaveDef } from "./types";

export const COLS = 14;
export const ROWS = 10;
export const START_GOLD = 170;
export const START_LIVES = 20;
export const SHOP_SIZE = 4;
export const BENCH_SIZE = 8;
export const RESTOCK_COST = 20;
export const SELL_RATIO = 0.55;
export const TICK = 1 / 60;
export const MERGE_NEED = 2;
export const MERGE_NEED_FIVE = 3;
export const MAX_SHOW_STAR = 5;
export const SLOT_BASE = 4;
export const SLOT_MAX_UP = 4;
export const SLOT_UP_COST = [0, 70, 130, 210, 320];
export const WAVES_PER_CHAPTER = 10;
export const UNLOCK_KEY = "seongru-unlock";
export const ENDLESS_ID = 4;
export const HEAL_BASE = 45;
export const HEAL_STEP = 16;

export const STAR_DMG = [1, 1, 1.4, 1.85, 2.35, 3.0, 4.0];
export const STAR_RANGE = [1, 1, 1.06, 1.12, 1.18, 1.24, 1.32];
export const STAR_RATE = [1, 1, 1.05, 1.1, 1.16, 1.22, 1.3];
export const STAR_SPLASH = [1, 1, 1.08, 1.16, 1.24, 1.32, 1.4];

export const DMG_UP = [1, 1.22, 1.48, 1.82];
export const RATE_UP = [1, 1.16, 1.36, 1.6];
export const UP_COST = [0, 32, 70, 130];

export const TOWERS: Record<TowerType, TowerDef> = {
  crossbow: {
    id: "crossbow",
    name: "Bolt",
    kind: "Physical",
    damageType: "physical",
    cost: 45,
    range: 2.7,
    damage: 9,
    fireRate: 1.2,
    splash: 0,
    desc: "Always hits one foe in range. Strong vs unarmored.",
  },
  laser: {
    id: "laser",
    name: "Beam",
    kind: "Physical",
    damageType: "physical",
    cost: 62,
    range: 3.15,
    damage: 5,
    fireRate: 3.4,
    splash: 0,
    desc: "Hitscan beam. Always hits a single target.",
  },
  axeman: {
    id: "axeman",
    name: "Axe",
    kind: "Physical",
    damageType: "physical",
    cost: 52,
    range: 1.55,
    damage: 20,
    fireRate: 0.85,
    splash: 0,
    desc: "Cone slash. Hits every foe in the swing.",
  },
  mortar: {
    id: "mortar",
    name: "Blast",
    kind: "Explosive",
    damageType: "explosive",
    cost: 78,
    range: 2.35,
    damage: 22,
    fireRate: 0.48,
    splash: 2.35,
    desc: "Detonates on nearby foes. Hits everyone in range.",
  },
  shaman: {
    id: "shaman",
    name: "Hex",
    kind: "Hex",
    damageType: "shaman",
    cost: 70,
    range: 2.5,
    damage: 6,
    fireRate: 0.9,
    splash: 0,
    desc: "Lingering slow and shred. Speeds nearby towers.",
  },
  arcane: {
    id: "arcane",
    name: "Meteor",
    kind: "Magic",
    damageType: "magic",
    cost: 88,
    range: 3.25,
    damage: 52,
    fireRate: 0.26,
    splash: 1.55,
    desc: "Long wind-up. Hits every foe in range.",
  },
  vault: {
    id: "vault",
    name: "Vault",
    kind: "Gold",
    damageType: "shaman",
    cost: 64,
    range: 1.2,
    damage: 0,
    fireRate: 0.3,
    splash: 0,
    desc: "Mints gold during combat only.",
  },
  barracks: {
    id: "barracks",
    name: "Keep",
    kind: "Summon",
    damageType: "physical",
    cost: 74,
    range: 4.2,
    damage: 11,
    fireRate: 0.7,
    splash: 0,
    desc: "Spawns soldiers ahead of the pack. Enemies cannot pass them.",
  },
};

export const TOWER_ORDER: TowerType[] = [
  "crossbow",
  "laser",
  "axeman",
  "mortar",
  "shaman",
  "arcane",
  "vault",
  "barracks",
];

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  infantry: { id: "infantry", name: "Footman", hp: 38, speed: 1.12, gold: 7, leakLives: 1, radius: 0.22, atk: 8, atkRate: 0.85 },
  swarm: { id: "swarm", name: "Swarm", hp: 22, speed: 1.52, gold: 5, leakLives: 1, radius: 0.18, atk: 5, atkRate: 1.4 },
  armored: { id: "armored", name: "Armor", hp: 86, speed: 0.78, gold: 11, leakLives: 1, radius: 0.26, atk: 14, atkRate: 0.55 },
  spirit: { id: "spirit", name: "Wisp", hp: 48, speed: 1.28, gold: 10, leakLives: 1, radius: 0.22, atk: 7, atkRate: 1.05 },
  flyer: { id: "flyer", name: "Skiff", hp: 44, speed: 1.38, gold: 10, leakLives: 1, radius: 0.22, atk: 7, atkRate: 1.1 },
  boss: { id: "boss", name: "Warden", hp: 1180, speed: 0.52, gold: 100, leakLives: 4, radius: 0.42, atk: 26, atkRate: 0.42 },
};

export const RESIST: Record<EnemyType, Record<DamageType, number>> = {
  infantry: { physical: 2, explosive: 1, shaman: 1, magic: 0.5 },
  swarm: { physical: 1, explosive: 2, shaman: 1, magic: 2 },
  armored: { physical: 0.5, explosive: 2, shaman: 1, magic: 1 },
  spirit: { physical: 0.5, explosive: 0.5, shaman: 2, magic: 2 },
  flyer: { physical: 1, explosive: 0, shaman: 2, magic: 2 },
  boss: { physical: 0.5, explosive: 2, shaman: 1, magic: 1 },
};

export type EnemySkin = { name: string; fill: string; accent: string };

export type ChapterDef = {
  id: number;
  name: string;
  subtitle: string;
  enemies: Record<EnemyType, EnemySkin>;
};

export const CHAPTERS: ChapterDef[] = [
  {
    id: 0,
    name: "Gate Road",
    subtitle: "Iron and dust",
    enemies: {
      infantry: { name: "Footman", fill: "#6a6460", accent: "#3a3834" },
      swarm: { name: "Swarm", fill: "#7a6a50", accent: "#5a4a38" },
      armored: { name: "Armor", fill: "#4a5560", accent: "#8a96a0" },
      spirit: { name: "Wisp", fill: "rgba(154,190,196,0.85)", accent: "rgba(216,232,236,0.6)" },
      flyer: { name: "Skiff", fill: "#7a8898", accent: "#d8e0e8" },
      boss: { name: "Warden", fill: "#5a403c", accent: "#c45c4a" },
    },
  },
  {
    id: 1,
    name: "Fog Marsh",
    subtitle: "Moss and mist",
    enemies: {
      infantry: { name: "Mossman", fill: "#4a6a58", accent: "#2c4438" },
      swarm: { name: "Mites", fill: "#6a7a48", accent: "#3e4a28" },
      armored: { name: "Bogplate", fill: "#3a5858", accent: "#7aa0a0" },
      spirit: { name: "Mistwisp", fill: "rgba(140,196,176,0.85)", accent: "rgba(200,232,216,0.6)" },
      flyer: { name: "Drifter", fill: "#6a8878", accent: "#c8e0d4" },
      boss: { name: "Bog Lord", fill: "#2e4a44", accent: "#7a9a78" },
    },
  },
  {
    id: 2,
    name: "Ash Peak",
    subtitle: "Cinder tide",
    enemies: {
      infantry: { name: "Ember", fill: "#8a5040", accent: "#4a241c" },
      swarm: { name: "Cinders", fill: "#a07048", accent: "#6a4028" },
      armored: { name: "Magma", fill: "#6a3834", accent: "#d08060" },
      spirit: { name: "Ashwisp", fill: "rgba(220,150,110,0.85)", accent: "rgba(240,200,160,0.6)" },
      flyer: { name: "Cinderwing", fill: "#a07060", accent: "#f0c8a8" },
      boss: { name: "Peak Guard", fill: "#5a2824", accent: "#c45c4a" },
    },
  },
  {
    id: 3,
    name: "Abyss Gate",
    subtitle: "From the void",
    enemies: {
      infantry: { name: "Deepman", fill: "#4a4660", accent: "#2a2840" },
      swarm: { name: "Voidlings", fill: "#5a4870", accent: "#3a2c50" },
      armored: { name: "Blackplate", fill: "#3a3c4c", accent: "#8a88a8" },
      spirit: { name: "Shade", fill: "rgba(170,150,210,0.85)", accent: "rgba(220,210,240,0.6)" },
      flyer: { name: "Voidwing", fill: "#6a6090", accent: "#d0c8f0" },
      boss: { name: "Abyss Lord", fill: "#322848", accent: "#9a7ab8" },
    },
  },
];

export const TYPE_HINT: Record<TowerType, string> = {
  crossbow: "2x vs footmen · hits air",
  laser: "2x vs footmen · hits air",
  axeman: "2x vs footmen · cannot hit air",
  mortar: "2x vs armor & swarm · cannot hit air",
  shaman: "2x vs wisps · hits air",
  arcane: "2x vs wisps & swarm · hits air",
  vault: "Mints gold in combat",
  barracks: "Soldiers block ground foes until they fall",
};

export const AWAKEN_HINT: Record<TowerType, string> = {
  crossbow: "Arrows hang over foes, then execute after 3s.",
  laser: "Chains 500 through the pack.",
  axeman: "Awakened cleave.",
  mortar: "Map-wide blast. 20% max HP.",
  shaman: "Foes walk 3s, then freeze.",
  arcane: "Meteors rain with no wait.",
  vault: "3,000 gold every second.",
  barracks: "Soldiers pour out with no delay.",
};

export const DAMAGE_LABEL: Record<DamageType, string> = {
  physical: "Physical",
  explosive: "Explosive",
  shaman: "Hex",
  magic: "Magic",
};

export function enemySkin(chapter: number, type: EnemyType): EnemySkin {
  return CHAPTERS[chapter]?.enemies[type] ?? CHAPTERS[0]!.enemies[type];
}

export function enemyName(chapter: number, type: EnemyType): string {
  return enemySkin(chapter, type).name;
}

export function chapterWaves(chapter: number): WaveDef[] {
  const n = (t: EnemyType) => enemyName(chapter, t);
  const q = (base: number) => Math.round(base * (1 + chapter * 0.16));
  return [
    { preview: `${n("infantry")} ${q(16)}`, spawns: [{ type: "infantry", count: q(16), interval: 0.52, delay: 0 }] },
    {
      preview: `${n("infantry")} ${q(16)} · ${n("swarm")} ${q(12)}`,
      spawns: [
        { type: "infantry", count: q(16), interval: 0.44, delay: 0 },
        { type: "swarm", count: q(12), interval: 0.32, delay: 0.8 },
      ],
    },
    { preview: `${n("armored")} ${q(14)}`, spawns: [{ type: "armored", count: q(14), interval: 0.6, delay: 0 }] },
    {
      preview: `${n("infantry")} ${q(18)} · ${n("spirit")} ${q(10)}`,
      spawns: [
        { type: "infantry", count: q(18), interval: 0.4, delay: 0 },
        { type: "spirit", count: q(10), interval: 0.52, delay: 1.1 },
      ],
    },
    {
      preview: `${n("armored")} ${q(14)} · ${n("flyer")} ${q(10)}`,
      spawns: [
        { type: "armored", count: q(14), interval: 0.5, delay: 0 },
        { type: "flyer", count: q(10), interval: 0.38, delay: 0.6 },
      ],
    },
    {
      preview: `${n("spirit")} ${q(16)} · ${n("infantry")} ${q(14)}`,
      spawns: [
        { type: "spirit", count: q(16), interval: 0.36, delay: 0 },
        { type: "infantry", count: q(14), interval: 0.42, delay: 1 },
      ],
    },
    {
      preview: `${n("armored")} ${q(16)} · ${n("flyer")} ${q(12)}`,
      spawns: [
        { type: "armored", count: q(16), interval: 0.46, delay: 0 },
        { type: "flyer", count: q(12), interval: 0.34, delay: 0.5 },
      ],
    },
    {
      preview: `${n("swarm")} ${q(28)} · ${n("flyer")} ${q(14)}`,
      spawns: [
        { type: "swarm", count: q(28), interval: 0.18, delay: 0 },
        { type: "flyer", count: q(14), interval: 0.28, delay: 0.5 },
      ],
    },
    {
      preview: `${n("spirit")} ${q(16)} · ${n("flyer")} ${q(14)} · ${n("armored")} ${q(12)}`,
      spawns: [
        { type: "spirit", count: q(16), interval: 0.32, delay: 0 },
        { type: "flyer", count: q(14), interval: 0.3, delay: 0.4 },
        { type: "armored", count: q(12), interval: 0.42, delay: 0.8 },
      ],
    },
    {
      preview: `${n("boss")} · escort`,
      spawns: [
        { type: "boss", count: 1, interval: 1, delay: 0 },
        { type: "armored", count: q(12), interval: 0.46, delay: 1 },
        { type: "flyer", count: q(12), interval: 0.3, delay: 1.2 },
        ...(chapter >= 2 ? [{ type: "boss" as const, count: 1, interval: 1, delay: 8 }] : []),
      ],
    },
  ];
}

export function endlessWave(wave: number): WaveDef {
  const ch = ((Math.max(1, wave) - 1) % CHAPTERS.length + CHAPTERS.length) % CHAPTERS.length;
  const base = chapterWaves(Math.min(3, ch));
  const idx = (Math.max(1, wave) - 1) % base.length;
  const src = base[idx]!;
  const mul = 1 + (wave - 1) * 0.08;
  const spawns = src.spawns.map((s) => ({
    ...s,
    count: Math.max(1, Math.round(s.count * mul)),
    interval: Math.max(0.12, s.interval * (1 - Math.min(0.35, (wave - 1) * 0.012))),
  }));
  if (wave % 5 === 0) {
    spawns.push({ type: "boss", count: 1 + Math.floor((wave - 1) / 15), interval: 1.2, delay: 0.4 });
  }
  const n = (t: EnemyType) => enemyName(ch, t);
  const preview = spawns
    .slice(0, 3)
    .map((s) => `${n(s.type)} ${s.count}`)
    .join(" · ");
  return { preview: preview || src.preview, spawns };
}

export function hpScale(wave: number, chapter = 0, endless = false): number {
  const w = 1 + (wave - 1) * 0.2 + Math.max(0, wave - 7) * 0.16;
  const story = w * (1 + chapter * 0.58);
  return endless ? story * (1 + (wave - 1) * 0.07) : story;
}

export function speedScale(wave: number, chapter = 0, endless = false): number {
  return 1 + (wave - 1) * 0.02 + chapter * 0.035 + (endless ? (wave - 1) * 0.008 : 0);
}

export function atkScale(wave: number, chapter = 0, endless = false): number {
  const base = (1 + (wave - 1) * 0.18 + Math.max(0, wave - 6) * 0.12) * (1 + chapter * 0.42);
  return endless ? base * (1 + (wave - 1) * 0.05) : base;
}

export function atkRateScale(wave: number, chapter = 0, endless = false): number {
  return 1 + (wave - 1) * 0.045 + chapter * 0.07 + (endless ? (wave - 1) * 0.01 : 0);
}

export function healCost(heals: number): number {
  return HEAL_BASE + heals * HEAL_STEP;
}

export function barracksCap(star: number): number {
  return star >= 6 ? 18 : 1 + star;
}

export function displayStar(star: number): number {
  return Math.min(MAX_SHOW_STAR, star);
}

export function isAwakened(star: number): boolean {
  return star >= 6;
}

export function mergeNeed(star: number): number {
  return star >= 5 ? MERGE_NEED_FIVE : MERGE_NEED;
}

export function hitsAir(src: TowerType | "ally"): boolean {
  return src === "crossbow" || src === "laser" || src === "arcane" || src === "shaman";
}

export function barracksHp(star: number, dmgUp: number): number {
  return 20 + star * 8 + dmgUp * 6;
}

export function axeConeHalf(star: number): number {
  return 0.62 + star * 0.08;
}

export function towerDamage(t: Tower): number {
  return TOWERS[t.type].damage * STAR_DMG[t.star] * DMG_UP[t.dmgUp];
}

export function towerRange(t: Tower): number {
  return TOWERS[t.type].range * STAR_RANGE[t.star];
}

export function towerRate(t: Tower): number {
  return TOWERS[t.type].fireRate * STAR_RATE[t.star] * RATE_UP[t.rateUp];
}

export function vaultPayout(t: Tower): number {
  return 4 + t.star * 2 + t.dmgUp;
}

export function upgradeCost(star: number, level: number): number {
  return Math.round((UP_COST[level] ?? 130) * (1 + (star - 1) * 0.35));
}

export function investedCost(type: TowerType, star: number, dmgUp: number, rateUp: number): number {
  const copies = 2 ** (star - 1);
  let cost = TOWERS[type].cost * copies;
  for (let i = 1; i <= dmgUp; i++) cost += upgradeCost(star, i);
  for (let i = 1; i <= rateUp; i++) cost += upgradeCost(star, i);
  return cost;
}

export function slotCap(slotUp: number): number {
  return SLOT_BASE + slotUp;
}

export function slotUpgradeCost(nextLevel: number): number {
  return SLOT_UP_COST[nextLevel] ?? 320;
}

export function typeMatchup(type: EnemyType): { weak: DamageType[]; resist: DamageType[] } {
  const row = RESIST[type];
  const weak: DamageType[] = [];
  const resist: DamageType[] = [];
  (Object.keys(row) as DamageType[]).forEach((d) => {
    if (row[d] >= 2) weak.push(d);
    if (row[d] <= 0.5) resist.push(d);
  });
  return { weak, resist };
}

type Progress = { unlocked: number; cleared: number };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return { unlocked: 1, cleared: 0 };
    if (/^\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(CHAPTERS.length, Number(raw)));
      return { unlocked: n, cleared: Math.max(0, n - 1) };
    }
    const o = JSON.parse(raw) as { unlocked?: number; cleared?: number };
    const unlocked = Math.max(1, Math.min(CHAPTERS.length, Number(o.unlocked) || 1));
    const cleared = Math.max(0, Math.min(CHAPTERS.length, Number(o.cleared) || 0));
    return { unlocked, cleared };
  } catch {
    return { unlocked: 1, cleared: 0 };
  }
}

export function saveProgress(unlocked: number, cleared: number) {
  try {
    localStorage.setItem(
      UNLOCK_KEY,
      JSON.stringify({
        unlocked: Math.max(1, Math.min(CHAPTERS.length, unlocked)),
        cleared: Math.max(0, Math.min(CHAPTERS.length, cleared)),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function loadUnlocked(): number {
  return loadProgress().unlocked;
}

export function saveUnlocked(count: number) {
  const { cleared } = loadProgress();
  saveProgress(count, cleared);
}
