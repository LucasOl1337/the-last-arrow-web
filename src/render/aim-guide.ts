import { ARROW_SPEED, ARROW_GRAVITY, BOLT_GRAVITY } from '../sim/arrows.ts';
import { DT } from '../sim/world.ts';
import { solid } from '../sim/level.ts';
import type { Level } from '../sim/level.ts';

/** Short prediction only, not a hit guarantee: same launch and semi-implicit gravity as simulation. */
export function aimGuide(level: Level, x: number, y: number, dx: number, dy: number, bolt = false) {
  let px = x + dx * .22, py = y + dy * .22, vy = dy * ARROW_SPEED;
  const vx = dx * ARROW_SPEED, gravity = bolt ? BOLT_GRAVITY : ARROW_GRAVITY;
  const points: { x: number; y: number }[] = [];
  let blocked = false;
  // 0.24 seconds: directional assistance without drawing a line across the whole duel.
  for (let frame = 0; frame < 14 && !blocked; frame++) {
    vy += gravity * DT;
    const steps = Math.max(1, Math.ceil(Math.hypot(vx, vy) * DT / .12));
    for (let step = 0; step < steps; step++) {
      const nx = px + vx * DT / steps, ny = py + vy * DT / steps;
      // Never draw through the world seam; wrapped shots remain the simulation's responsibility.
      if (nx < 0 || nx >= 32 || ny < 0 || ny >= 18) { blocked = true; break; }
      if (!bolt && solid(level, nx, ny)) { blocked = true; break; }
      px = nx; py = ny;
    }
    if (frame % 3 === 2 || frame === 13 || blocked) points.push({ x: px, y: py });
  }
  return { points, blocked, end: { x: px, y: py } };
}
