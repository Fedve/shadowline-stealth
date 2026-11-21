// SHADOWLINE — the three floors of the Meridian Archive.
// One file, one job: ASCII level maps, guard patrol routes and camera mounts.
// Legend: '#' wall, '.' floor, 'S' shadow tile, 'C' crate (cover, blocks sight),
// 'I' intel core, 'E' exit, 'P' player start. Every row is 32 cells, 18 rows.
// Patrol waypoints and camera mounts are in tile coordinates {tx, ty}.

export const LEVELS = [
  {
    name: 'FLOOR 1 — LOBBY',
    map: [
      '################################',
      '#P....S...#...I.....#....I.....#',
      '#.........#.........#..........#',
      '#..C......#.....C...#..C.......#',
      '#..............................#',
      '#..S......#.........#.....C....#',
      '#.........#..C......#..........#',
      '#....C....#.........#..S.......#',
      '#.........#.....C...#..........#',
      '#..............................#',
      '#..C......#.........#....C.....#',
      '#.........#...I.....#..........#',
      '#.........#.........#..C.......#',
      '#..............................#',
      '#..S......#.....C...#..........#',
      '#.........#..C......#....C.....#',
      '#.........#.........#....E.....#',
      '################################',
    ],
    guards: [
      { waypoints: [{ tx: 11, ty: 2 }, { tx: 11, ty: 15 }] },
      { waypoints: [{ tx: 28, ty: 3 }, { tx: 28, ty: 14 }] },
    ],
    cameras: [],
  },
  {
    name: 'FLOOR 2 — GALLERY',
    map: [
      '################################',
      '#P.....S......C.......#...I....#',
      '#..............................#',
      '#..C....#.....S.....#....C.....#',
      '#.......#...........#..........#',
      '#..S....#..C........#..C....S..#',
      '#.......#...........#..........#',
      '#..C....#.....C.....#....C.....#',
      '#..............................#',
      '#.......#....I......#.....C....#',
      '#..S....#...........#..........#',
      '#.......#..C.....S..#..C.......#',
      '#..............................#',
      '#..C....#...........#....S.....#',
      '#.......#....C......#..........#',
      '#..S....#...........#..C.......#',
      '#...I...#.....C.....#....E.....#',
      '################################',
    ],
    guards: [
      { waypoints: [{ tx: 4, ty: 2 }, { tx: 4, ty: 15 }] },
      { waypoints: [{ tx: 10, ty: 6 }, { tx: 18, ty: 6 }] },
      { waypoints: [{ tx: 28, ty: 3 }, { tx: 28, ty: 14 }] },
    ],
    cameras: [
      { tx: 8, ty: 5, base: 0, arc: 1.9, speed: 0.55 },
      { tx: 20, ty: 11, base: Math.PI, arc: 1.9, speed: 0.45 },
    ],
  },
  {
    name: 'FLOOR 3 — VAULT',
    map: [
      '################################',
      '#P....S......C......#....I.....#',
      '#..............................#',
      '#..C.......#....S....#..C......#',
      '#..........#.........#.........#',
      '#..S.......#....C....#.....S...#',
      '#####.....######.....####......#',
      '#..........#.........#.........#',
      '#....C.....#....C....#..S......#',
      '#..I.......#.........#.........#',
      '#..........#....S....#....C....#',
      '#....S.....#.........#.........#',
      '######....#######....#####.....#',
      '#..........#.........#.........#',
      '#..C.......#....C....#..S......#',
      '#......I...#.........#....E....#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [{ tx: 6, ty: 2 }, { tx: 24, ty: 2 }] },
      { waypoints: [{ tx: 14, ty: 8 }, { tx: 14, ty: 10 }] },
      { waypoints: [{ tx: 26, ty: 14 }, { tx: 26, ty: 16 }] },
    ],
    cameras: [
      { tx: 10, ty: 6, base: Math.PI / 2, arc: 2.2, speed: 0.6 },
      { tx: 21, ty: 12, base: -Math.PI / 2, arc: 2.2, speed: 0.5 },
    ],
  },
];

// Parse one level map into walkable grids and entity lists.
export function parseLevel(level) {
  const walls = [];
  const crates = [];
  const shadows = new Set();
  const intel = [];
  let exit = null;
  let playerStart = null;
  for (let y = 0; y < level.map.length; y++) {
    const row = level.map[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '#') walls.push({ x, y });
      else if (ch === 'C') crates.push({ x, y });
      else if (ch === 'S') shadows.add(`${x},${y}`);
      else if (ch === 'I') intel.push({ x, y });
      else if (ch === 'E') exit = { x, y };
      else if (ch === 'P') playerStart = { x, y };
    }
  }
  return { walls, crates, shadows, intel, exit, playerStart };
}

// True when the tile at (tx, ty) blocks movement.
export function isSolid(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= 32 || ty >= 18) return true;
  const ch = level.map[ty][tx];
  return ch === '#' || ch === 'C';
}

// True when the tile blocks line of sight (walls and crates both do).
export function blocksSight(level, tx, ty) {
  return isSolid(level, tx, ty);
}
