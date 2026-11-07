import { DT } from './world.ts';
import type { Arrow, Fighter, World } from './world.ts';
import { delta, solid, WIDTH, HEIGHT } from './level.ts';

export type SkillKind = 'water-guard' | 'storm-gust';
export interface SkillState {
  kind: SkillKind; time: number; x: number; y: number; charges: number; pending: boolean;
}
export const WATER_GUARD_RADIUS = .8, WATER_GUARD_SECONDS = .7, WATER_COOLDOWN = 1.8;
export const STORM_GUST_RADIUS = 2.4, STORM_GUST_SECONDS = .25, STORM_COOLDOWN = 2.4;
export function tickSkill(f: Fighter): void {
  if (!f.skill) return;
  f.skill.time = Math.max(0, f.skill.time - DT);
  if (f.skill.time <= 1e-9) f.skill = undefined;
}
export function activateSkill(w: World, f: Fighter): void {
  const water = f.character === 0;
  f.skill = { kind: water ? 'water-guard' : 'storm-gust', time: water ? WATER_GUARD_SECONDS : STORM_GUST_SECONDS,
    x: f.x, y: f.y, charges: water ? 1 : 0, pending: !water };
  f.dashCooldown = water ? WATER_COOLDOWN : STORM_COOLDOWN;
  w.events.push({ type: 'skill', skill: f.skill.kind, x: f.x, y: f.y, actor: f.id, radius: water ? WATER_GUARD_RADIUS : STORM_GUST_RADIUS });
}
/** Toroidal line of sight: neither skill can act through a platform/wall. */
function visible(w: World, x: number, y: number, dx: number, dy: number): boolean {
  const samples = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .15));
  for (let n = 0; n <= samples; n++) if (solid(w.level, x + dx * n / samples, y + dy * n / samples)) return false;
  return true;
}
export function stepSkills(w: World): void {
  for (const source of w.fighters) {
    const s = source.skill;
    if (!source.alive || !s || s.kind !== 'storm-gust' || !s.pending || s.time <= 0) continue;
    s.pending = false;
    const direction = (x: number, y: number) => {
      const dx = delta(s.x, x, WIDTH), dy = delta(s.y, y, HEIGHT), length = Math.hypot(dx, dy);
      if (length > STORM_GUST_RADIUS || !visible(w, s.x, s.y, dx, dy)) return null;
      return length > .001 ? { x: dx / length, y: dy / length } : { x: source.facing, y: 0 };
    };
    for (const target of w.fighters) {
      if (target === source || !target.alive || target.invulnerable > 0) continue;
      const d = direction(target.x, target.y); if (!d) continue;
      target.vx = Math.max(-21, Math.min(21, target.vx + d.x * 12));
      target.vy = Math.max(-19, Math.min(19, target.vy + d.y * 8));
      target.wallLock = Math.max(target.wallLock, .12);
    }
    for (const arrow of w.arrows) {
      if (arrow.stuck || arrow.owner === source.id) continue;
      const d = direction(arrow.x, arrow.y); if (!d) continue;
      const speed = Math.hypot(arrow.vx, arrow.vy);
      arrow.vx = d.x * speed; arrow.vy = d.y * speed; arrow.angle = Math.atan2(arrow.vy, arrow.vx);
    }
  }
}
/** Called at each swept projectile sample; return true when the one-use ward absorbs it. */
export function interceptWithGuard(w: World, arrow: Arrow): boolean {
  for (const f of w.fighters) {
    const s = f.skill;
    // The initial timed dodge keeps its ammo-catching semantics; the ward arms after it.
    if (!f.alive || f.dashTime > 0 || arrow.owner === f.id || !s || s.kind !== 'water-guard' || s.time <= 0 || s.charges <= 0) continue;
    const dx = delta(s.x, arrow.x, WIDTH), dy = delta(s.y, arrow.y, HEIGHT);
    if (Math.hypot(dx, dy) > WATER_GUARD_RADIUS || !visible(w, s.x, s.y, dx, dy)) continue;
    s.charges = 0; s.time = 0;
    w.events.push({ type: 'impact', x: arrow.x, y: arrow.y, actor: f.id, kind: arrow.kind, skill: s.kind });
    return true;
  }
  return false;
}
