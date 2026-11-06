import { DT, COUNTDOWN_SECONDS, resetRound } from './world.ts';
import type { World, Fighter } from './world.ts';
import { delta, WIDTH, HEIGHT } from './level.ts';
import { quiver } from './inventory.ts';
export function kill(w: World, victim: Fighter, killer: number): void {
  if (!victim.alive || victim.invulnerable > 0) return;
  victim.alive = false; victim.charging = false;
  if (killer !== victim.id && w.fighters[killer]) w.fighters[killer].kills++;
  w.events.push({ type: 'kill', x: victim.x, y: victim.y, actor: killer, target: victim.id });
  // Dead fighters drop their quiver; zero-ammo survivors can still finish a round.
  const inventory = quiver(victim);
  for (let n = 0; n < inventory.length; n++) w.arrows.push({ id: w.nextArrowId++, owner: victim.id,
    x: victim.x + (n - 1) * 0.22, y: victim.y + 0.4, vx: 0, vy: 0, angle: 0.5 + n * 0.3, stuck: true, age: 0, kind: inventory[n] });
  inventory.length = 0; victim.ammo = 0;
}
export function checkStomps(w: World): void {
  for (const a of w.fighters) for (const b of w.fighters) {
    if (a === b || !a.alive || !b.alive || a.vy <= 1 || b.invulnerable > 0) continue;
    const before = delta(a.prevY, b.prevY, HEIGHT), now = delta(a.y, b.y, HEIGHT);
    if (Math.abs(delta(a.x, b.x, WIDTH)) < 0.6 && before >= 0.96 && now <= 1.12 && now > 0.55) {
      kill(w, b, a.id); a.vy = -10;
    }
  }
}
export function stepRules(w: World): void {
  if (w.phase === 'matchover') return;
  if (w.phase === 'countdown') {
    w.phaseTime = Math.max(0, w.phaseTime - DT);
    w.countdown = Math.max(0, Math.min(3, Math.ceil((w.phaseTime - 1e-9) / (COUNTDOWN_SECONDS / 3))));
    if (w.phaseTime <= 1e-9) { w.phaseTime = 0; w.countdown = 0; w.phase = 'playing'; }
    return;
  }
  if (w.phase === 'roundover') {
    w.phaseTime -= DT;
    if (w.phaseTime <= 0) resetRound(w);
    return;
  }
  let alive = 0, winner = -1;
  for (const f of w.fighters) if (f.alive) { alive++; winner = f.id; }
  // A visible 90 s limit prevents endless human camping without awarding arbitrary points.
  if (alive > 1 && w.roundTime < 90) return;
  w.winner = alive === 1 ? winner : null;
  if (w.winner !== null) w.fighters[winner].score++;
  if (w.winner !== null && w.fighters[winner].score >= 5) {
    w.phase = 'matchover';
    w.events.push({ type: 'victory', x: 16, y: 9, actor: winner });
  } else {
    w.phase = 'roundover'; w.phaseTime = 1.8;
    w.events.push({ type: 'round', x: 16, y: 9, actor: w.winner ?? -1 });
  }
}
