export const WIDTH = 32;
export const HEIGHT = 18;
export interface Platform { id: number; left: number; right: number; y: number; links: number[] }
export type LevelTheme = 'moss' | 'totem' | 'canopy';
export interface Level { id: string; theme?: LevelTheme; name: string; rows: readonly string[]; platforms: Platform[]; spawns: { x: number; y: number }[] }

const maps = [
  {
    id: 'moss', name: 'Ruínas do Musgo', rows: [
      '................................',
      '................................',
      '................................',
      '.............######.............',
      '................................',
      '....#####..............#####....',
      '................................',
      '................................',
      '..........####....####..........',
      '................................',
      '###..........................###',
      '................................',
      '.....######..........######.....',
      '................................',
      '..............####..............',
      '................................',
      '##########............##########',
      '................................',
    ],
  },
  {
    id: 'totem', name: 'Templo do Totem', rows: [
      '................................',
      '................................',
      '.....####..............####.....',
      '................................',
      '..............####..............',
      '................................',
      '###.......##........##.......###',
      '..........##........##..........',
      '..........##........##..........',
      '.....###................###.....',
      '................................',
      '..............####..............',
      '................................',
      '####.....####......####.....####',
      '................................',
      '................................',
      '.......##################.......',
      '................................',
    ],
  },
  {
    id: 'canopy', name: 'Copas Altas', rows: [
      '................................',
      '................................',
      '..........####....####..........',
      '................................',
      '...####..................####...',
      '................................',
      '..............####..............',
      '................................',
      '.......####..........####.......',
      '................................',
      '##............................##',
      '................................',
      '....####......####......####....',
      '................................',
      '................................',
      '.........####......####.........',
      '................................',
      '................................',
    ],
  },
  {
    id: 'falls', theme: 'totem' as const, name: 'Cachoeira Sagrada', rows: [
      '................................',
      '................................',
      '................................',
      '..####....................####..',
      '................................',
      '................................',
      '......####............####......',
      '................................',
      '................................',
      '..........####....####..........',
      '##............................##',
      '................................',
      '......####............####......',
      '................................',
      '..............####..............',
      '..####....................####..',
      '................................',
      '................................',
    ],
  },
  {
    id: 'roots', theme: 'moss' as const, name: 'Raízes Antigas', rows: [
      '................................',
      '................................',
      '................................',
      '............########............',
      '................................',
      '................................',
      '..####....................####..',
      '................................',
      '..........###......###..........',
      '.....#....................#.....',
      '.....#....................#.....',
      '..####....###......###....####..',
      '................................',
      '................................',
      '......####....####....####......',
      '......#..................#......',
      '..####....................####..',
      '................................',
    ],
  },
];
export function themeOf(levelId: string): LevelTheme {
  const map = maps.find(map => map.id === levelId);
  return map?.theme ?? (map?.id === 'totem' || map?.id === 'canopy' ? map.id : 'moss');
}
export function wrap(v: number, size: number): number { return ((v % size) + size) % size; }
export function delta(a: number, b: number, size: number): number { return wrap(b - a + size / 2, size) - size / 2; }
export function solid(level: Level, x: number, y: number): boolean {
  return level.rows[wrap(Math.floor(y), HEIGHT)][wrap(Math.floor(x), WIDTH)] === '#';
}
function makeLevel(map: typeof maps[number]): Level {
  if (map.rows.length !== HEIGHT || map.rows.some(row => row.length !== WIDTH)) throw new Error(`Mapa inválido: ${map.id}`);
  const platforms: Platform[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (map.rows[y][x] !== '#' || map.rows[wrap(y - 1, HEIGHT)][x] === '#') continue;
      const left = x;
      while (x + 1 < WIDTH && map.rows[y][x + 1] === '#' && map.rows[wrap(y - 1, HEIGHT)][x + 1] !== '#') x++;
      platforms.push({ id: platforms.length, left, right: x + 1, y, links: [] });
    }
  }
  // Directed reachability: rising edges fit the jump envelope; falling edges may wrap vertically.
  for (const a of platforms) for (const b of platforms) {
    if (a === b) continue;
    const dx = Math.max(0, Math.abs(delta((a.left + a.right) / 2, (b.left + b.right) / 2, WIDTH)) - (a.right - a.left + b.right - b.left) / 2);
    const rise = a.y - b.y;
    if (dx <= 7 && (rise <= 4.8 || rise > 12)) a.links.push(b.id);
  }
  const preferred = platforms.filter(p => p.right - p.left >= 3);
  const spawns = [0.12, 0.87, 0.34, 0.66].map((fraction, index) => {
    const sorted = [...preferred].sort((a, b) => Math.abs((a.left + a.right) / 2 - fraction * WIDTH) - Math.abs((b.left + b.right) / 2 - fraction * WIDTH) || ((index < 2 ? a.y - b.y : b.y - a.y)));
    const p = sorted[0];
    return { x: (p.left + p.right) / 2, y: p.y - 0.56 };
  });
  return { ...map, platforms, spawns };
}
export const LEVELS: readonly Level[] = maps.map(makeLevel);
export function platformAt(level: Level, x: number, y: number): Platform {
  let best = level.platforms[0], distance = Infinity;
  for (const p of level.platforms) {
    const dx = Math.max(0, Math.abs(delta(x, (p.left + p.right) / 2, WIDTH)) - (p.right - p.left) / 2);
    const score = dx * 1.5 + Math.abs(y + 0.55 - p.y);
    if (score < distance) { best = p; distance = score; }
  }
  return best;
}
export function nextPlatform(level: Level, from: number, to: number): Platform {
  if (from === to) return level.platforms[to];
  const queue = [from], parent = new Map<number, number>([[from, -1]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of level.platforms[id].links) {
      if (parent.has(next)) continue;
      parent.set(next, id); queue.push(next);
      if (next === to) {
        let step = to;
        while (parent.get(step) !== from) step = parent.get(step)!;
        return level.platforms[step];
      }
    }
  }
  return level.platforms[to];
}
