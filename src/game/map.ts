import { COLS, ROWS } from "./config";
import type { Vec } from "./types";

export type CellKind = "path" | "build" | "blocked";

export type MapDef = {
  cells: Vec[];
  blocked: Vec[];
  path: string;
  edge: string;
};

export const MAPS: MapDef[] = [
  {
    path: "#4a4034",
    edge: "#2a241c",
    cells: [
      { x: 0, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 1 },
      { x: 9, y: 1 },
      { x: 9, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 8 },
      { x: 12, y: 8 },
      { x: 12, y: 3 },
      { x: 13, y: 3 },
    ],
    blocked: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 11, y: 0 },
      { x: 0, y: 8 },
      { x: 1, y: 8 },
      { x: 0, y: 9 },
      { x: 2, y: 7 },
      { x: 8, y: 6 },
      { x: 1, y: 2 },
      { x: 10, y: 5 },
      { x: 13, y: 6 },
      { x: 13, y: 9 },
    ],
  },
  {
    path: "#3a4a40",
    edge: "#1c2a22",
    cells: [
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 7 },
      { x: 8, y: 7 },
      { x: 8, y: 3 },
      { x: 11, y: 3 },
      { x: 11, y: 8 },
      { x: 13, y: 8 },
    ],
    blocked: [
      { x: 1, y: 0 },
      { x: 2, y: 4 },
      { x: 6, y: 1 },
      { x: 6, y: 5 },
      { x: 9, y: 5 },
      { x: 0, y: 8 },
      { x: 3, y: 9 },
      { x: 12, y: 1 },
      { x: 13, y: 4 },
    ],
  },
  {
    path: "#4a3830",
    edge: "#2a1c18",
    cells: [
      { x: 0, y: 8 },
      { x: 3, y: 8 },
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 6 },
      { x: 11, y: 6 },
      { x: 11, y: 1 },
      { x: 13, y: 1 },
    ],
    blocked: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 5, y: 0 },
      { x: 5, y: 8 },
      { x: 8, y: 8 },
      { x: 9, y: 2 },
      { x: 13, y: 4 },
      { x: 13, y: 8 },
      { x: 1, y: 5 },
    ],
  },
  {
    path: "#3a3848",
    edge: "#1c1a28",
    cells: [
      { x: 0, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 8 },
      { x: 2, y: 8 },
      { x: 2, y: 1 },
      { x: 8, y: 1 },
      { x: 8, y: 5 },
      { x: 12, y: 5 },
      { x: 12, y: 2 },
      { x: 13, y: 2 },
    ],
    blocked: [
      { x: 0, y: 0 },
      { x: 6, y: 6 },
      { x: 7, y: 8 },
      { x: 10, y: 8 },
      { x: 10, y: 0 },
      { x: 13, y: 7 },
      { x: 13, y: 9 },
      { x: 4, y: 2 },
    ],
  },
  {
    path: "#3e3a34",
    edge: "#221e1a",
    cells: [
      { x: 0, y: 1 },
      { x: 6, y: 1 },
      { x: 6, y: 4 },
      { x: 2, y: 4 },
      { x: 2, y: 8 },
      { x: 9, y: 8 },
      { x: 9, y: 3 },
      { x: 12, y: 3 },
      { x: 12, y: 7 },
      { x: 13, y: 7 },
    ],
    blocked: [
      { x: 0, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 11, y: 0 },
      { x: 11, y: 5 },
      { x: 13, y: 1 },
      { x: 7, y: 6 },
    ],
  },
];

export const grid: CellKind[][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => "build" as CellKind),
);

export let WAYPOINT_CELLS: Vec[] = MAPS[0].cells;
export let WAYPOINTS: Vec[] = [];
export let PATH_LEN = 0;
export let SEG_LEN: number[] = [];
export let PATH_FILL = MAPS[0].path;
export let PATH_EDGE = MAPS[0].edge;

function fillSegment(a: Vec, b: Vec) {
  if (a.x === b.x) {
    const x = a.x;
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    for (let y = y0; y <= y1; y++) grid[y][x] = "path";
  } else if (a.y === b.y) {
    const y = a.y;
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    for (let x = x0; x <= x1; x++) grid[y][x] = "path";
  }
}

export function setMap(index: number) {
  const def = MAPS[index] ?? MAPS[0];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) grid[r][c] = "build";
  }
  WAYPOINT_CELLS = def.cells;
  for (let i = 0; i < WAYPOINT_CELLS.length - 1; i++) {
    fillSegment(WAYPOINT_CELLS[i]!, WAYPOINT_CELLS[i + 1]!);
  }
  for (const b of def.blocked) {
    if (grid[b.y]?.[b.x] === "build") grid[b.y][b.x] = "blocked";
  }
  WAYPOINTS = WAYPOINT_CELLS.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
  SEG_LEN = WAYPOINTS.slice(0, -1).map((a, i) => {
    const b = WAYPOINTS[i + 1]!;
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  PATH_LEN = SEG_LEN.reduce((s, n) => s + n, 0);
  PATH_FILL = def.path;
  PATH_EDGE = def.edge;
}

setMap(0);

export function pointOnPath(dist: number): Vec {
  let d = Math.max(0, dist);
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (d <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
      const a = WAYPOINTS[i];
      const b = WAYPOINTS[i + 1];
      const t = SEG_LEN[i] === 0 ? 1 : Math.min(1, d / SEG_LEN[i]);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    d -= SEG_LEN[i];
  }
  return { ...WAYPOINTS[WAYPOINTS.length - 1] };
}

export function isBuildable(col: number, row: number): boolean {
  return grid[row]?.[col] === "build";
}

export function hash2(x: number, y: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
