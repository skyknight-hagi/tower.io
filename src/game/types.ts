export type TowerType = "crossbow" | "laser" | "axeman" | "mortar" | "shaman" | "arcane" | "vault" | "barracks";
export type DamageType = "physical" | "explosive" | "shaman" | "magic";
export type EnemyType = "infantry" | "swarm" | "armored" | "spirit" | "flyer" | "boss";
export type Star = 1 | 2 | 3 | 4 | 5 | 6;
export type GameScreen = "loading" | "chapters" | "playing" | "paused" | "won" | "lost";
export type WavePhase = "prep" | "combat";
export type UpgradeKind = "dmg" | "rate";

export type Vec = { x: number; y: number };

export type TowerDef = {
  id: TowerType;
  name: string;
  kind: string;
  damageType: DamageType;
  cost: number;
  range: number;
  damage: number;
  fireRate: number;
  splash: number;
  desc: string;
};

export type EnemyDef = {
  id: EnemyType;
  name: string;
  hp: number;
  speed: number;
  gold: number;
  leakLives: number;
  radius: number;
  atk: number;
  atkRate: number;
};

export type WaveSpawn = {
  type: EnemyType;
  count: number;
  interval: number;
  delay: number;
};

export type WaveDef = {
  spawns: WaveSpawn[];
  preview: string;
};

export type Tower = {
  id: number;
  type: TowerType;
  star: Star;
  col: number;
  row: number;
  placed: boolean;
  dmgUp: number;
  rateUp: number;
  cooldown: number;
  angle: number;
  pulse: number;
  stunT: number;
};

export type Enemy = {
  id: number;
  alive: boolean;
  type: EnemyType;
  x: number;
  y: number;
  dist: number;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  leakLives: number;
  radius: number;
  slowT: number;
  slowMul: number;
  shredT: number;
  shredMul: number;
  burnT: number;
  burnDps: number;
  flash: number;
  atk: number;
  atkRate: number;
  atkCd: number;
  air: boolean;
  age: number;
  stunCd: number;
};

export type Ally = {
  id: number;
  alive: boolean;
  from: number;
  x: number;
  y: number;
  dist: number;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  atkRate: number;
  cooldown: number;
  angle: number;
  flash: number;
};

export type Projectile = {
  alive: boolean;
  kind: "bolt" | "meteor";
  x: number;
  y: number;
  tx: number;
  ty: number;
  x0: number;
  y0: number;
  t: number;
  dur: number;
  damage: number;
  splash: number;
  dtype: DamageType;
  pierce: number;
  hit: number[];
  burn: number;
};

export type Mark = {
  enemyId: number;
  life: number;
  max: number;
};

export type Beam = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  max: number;
  color: string;
  width: number;
};

export type Blast = {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: string;
  kind: "bubble" | "ring" | "linger" | "hit";
};

export type Slash = {
  x: number;
  y: number;
  angle: number;
  range: number;
  half: number;
  life: number;
  max: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: "puff" | "spark";
};

export type Floater = {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  max: number;
  color: string;
};

export type ShopSlot = {
  type: TowerType;
} | null;

export type MergeOffer = {
  type: TowerType;
  star: Star;
  count: number;
};

export type EnemyInspect = {
  id: number;
  name: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  weak: string[];
  resist: string[];
  atk: number;
  atkRate: number;
};

export type ChapterInfo = {
  id: number;
  name: string;
  subtitle: string;
  unlocked: boolean;
  cleared: boolean;
};

export type HudSnap = {
  screen: GameScreen;
  phase: WavePhase;
  gold: number;
  lives: number;
  maxLives: number;
  healCost: number;
  wave: number;
  totalWaves: number;
  wavePreview: string;
  chapter: number;
  chapterName: string;
  chapters: ChapterInfo[];
  endless: boolean;
  endlessUnlocked: boolean;
  loadProgress: number;
  loadLabel: string;
  enemiesAlive: number;
  enemiesLeft: number;
  shop: ShopSlot[];
  shopLocked: boolean;
  shopPrompt: boolean;
  restockCost: number;
  inventory: Tower[];
  placed: Tower[];
  placedCount: number;
  slotCap: number;
  slotCost: number | null;
  selectedInv: number | null;
  selectedField: number | null;
  inspected: EnemyInspect | null;
  merges: MergeOffer[];
  muted: boolean;
};
