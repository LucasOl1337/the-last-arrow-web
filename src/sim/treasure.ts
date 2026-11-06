import { DT, random } from './world.ts';
import type { ArrowKind, World } from './world.ts';
import { delta, solid, WIDTH, HEIGHT } from './level.ts';
import { giveArrows } from './inventory.ts';

export const CHEST_INTERVAL = 12;
export function stepChests(w: World): void {
  if (w.phase !== 'playing') return;
  const chests = w.chests ??= [];
  w.chestTimer = (w.chestTimer ?? CHEST_INTERVAL) - DT;
  if (w.chestTimer <= 1e-9) {
    w.chestTimer = CHEST_INTERVAL;
    // Supported, empty tile with headroom, not inside a fighter or another chest.
    const spots: { x: number; y: number }[] = [];
    for (const p of w.level.platforms) for (let x = p.left + 0.5; x < p.right; x++) {
      const y = p.y - 0.5;
      if (solid(w.level, x, y) || solid(w.level, x, y - 1) || !solid(w.level, x, p.y)) continue;
      if (w.fighters.some(f => f.alive && Math.hypot(delta(x, f.x, WIDTH), delta(y, f.y, HEIGHT)) < 1.5)) continue;
      if (chests.some(c => Math.hypot(delta(x, c.x, WIDTH), delta(y, c.y, HEIGHT)) < 1.5)) continue;
      spots.push({ x, y });
    }
    // Bounded population even in a 90 s camping round.
    if (spots.length && chests.length < 3) {
      const spot = spots[Math.floor(random(w) * spots.length)];
      const roll = Math.floor(random(w) * 3);
      const reward: ArrowKind[] = roll === 0 ? ['normal', 'normal'] : [roll === 1 ? 'bolt' : 'bomb'];
      const id = w.nextChestId ?? 1; w.nextChestId = id + 1;
      chests.push({ id, ...spot, reward });
      w.events.push({ type: 'chest-spawn', ...spot, actor: -1, chestId: id, reward: [...reward] });
    }
  }
  for (let n = chests.length - 1; n >= 0; n--) {
    const c = chests[n];
    const opener = w.fighters.find(f => f.alive && Math.abs(delta(f.x, c.x, WIDTH)) < 0.8 && Math.abs(delta(f.y, c.y, HEIGHT)) < 0.95);
    if (!opener) continue;
    giveArrows(opener, c.reward);
    w.events.push({ type: 'chest-open', x: c.x, y: c.y, actor: opener.id, chestId: c.id, reward: [...c.reward] });
    chests.splice(n, 1);
  }
}
