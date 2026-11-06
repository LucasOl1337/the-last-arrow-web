import { delta, WIDTH, HEIGHT } from '../sim/level.ts';
import { DT } from '../sim/world.ts';
import type { World } from '../sim/world.ts';
/** Join a new authoritative snapshot to the pose actually on screen, not the previous destination.
 * A burst arriving before interpolation finishes must not teleport to that old destination.
 * This changes only render history; position, collision and score remain server-owned.
 */
export function joinSnapshot(previous: World, next: World, displayedAlpha: number) {
  const alpha=Math.max(0,Math.min(1,displayedAlpha));
  const continuous=previous.round===next.round && previous.phase===next.phase;
  for(const f of next.fighters) {
    const old=previous.fighters[f.id];
    if(!continuous || !old || old.alive!==f.alive) {f.prevX=f.x;f.prevY=f.y;continue;}
    f.prevX=old.prevX+delta(old.prevX,old.x,WIDTH)*alpha;
    f.prevY=old.prevY+delta(old.prevY,old.y,HEIGHT)*alpha;
  }
  // Lost/coalesced frames cover more simulation time; cap catch-up to avoid sluggish controls.
  return Math.max(1000/120,Math.min(100,(next.tick-previous.tick)*DT*1000));
}
