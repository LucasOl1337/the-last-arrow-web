import { HEIGHT, WIDTH, solid, wrap } from '../sim/level.ts';
import type { Level } from '../sim/level.ts';

/** Render-only receiver, in scene coordinates. Never mutates physics or the level. */
export function contactShadow(level: Level, x: number, feet: number, strength = 1) {
  x = wrap(x, WIDTH);
  let ground: number | null = null;
  for (let d = 0; d < 8; d++) {
    const row = Math.floor(feet + .02) + d;
    if (solid(level, x, row)) { ground = row; break; }
  }
  // A wrapped solid lookup is not a receiving face. Reject penetration and
  // buried tiles rather than projecting upward through a wall.
  if (ground === null || strength <= 0 || ground < feet - .02 || solid(level, x, ground - 1)) return null;
  const k = Math.max(0, 1 - Math.max(0, ground - feet) / 6);
  if (k === 0) return null;
  const width = 1.1 * (.5 + .5 * k), depth = .7 * (.5 + .5 * k);
  const top = (column: number) => solid(level, column, ground) && !solid(level, column, ground - 1);
  let a = Math.floor(x), b = a + 1;
  while (a > 0 && a > x - width / 2 && top(a - 1)) a--;
  while (b < WIDTH && b < x + width / 2 && top(b)) b++;
  const left = Math.max(a, x - width / 2), right = Math.min(b, x + width / 2);
  return { x, y: HEIGHT - wrap(ground, HEIGHT) + .02,
    // The old center (.45) put half the decal in front of the terrain (.42).
    z: .42 - depth / 2, left, right,
    u0: (left - x) / width + .5, u1: (right - x) / width + .5,
    depth, opacity: .75 * k * Math.min(1, strength) };
}
