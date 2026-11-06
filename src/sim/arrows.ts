import { DT } from './world.ts';
import type { World, Fighter } from './world.ts';
import type { Intent } from './input.ts';
import { solid, wrap, delta, WIDTH, HEIGHT } from './level.ts';
import { kill } from './rules.ts';
export const ARROW_SPEED = 23, ARROW_GRAVITY = 4.5, MAX_AMMO = 6;
export function updateBow(w: World, f: Fighter, i: Intent): void {
  f.shotCooldown = Math.max(0, f.shotCooldown - DT);
  if ((i.shoot || i.shootHeld) && !f.charging && f.shotCooldown <= 0 && f.ammo > 0) { f.charging = true; f.charge = 0; }
  if (!f.charging) return;
  f.charge += DT;
  if (i.shootHeld) return;
  f.charging = false;
  if (f.ammo <= 0) return;
  f.ammo--; f.shotCooldown = 0.2;
  // Start inside the shooter's bounds, so firing beside a wall cannot skip it.
  w.arrows.push({ id: w.nextArrowId++, owner: f.id, x: f.x + f.aimX * 0.22, y: f.y + f.aimY * 0.22,
    vx: f.aimX * ARROW_SPEED, vy: f.aimY * ARROW_SPEED, angle: Math.atan2(f.aimY, f.aimX), stuck: false, age: 0 });
  w.events.push({ type: 'shoot', x: f.x, y: f.y, actor: f.id });
}
export function stepArrows(w: World): void {
  for (let index = w.arrows.length - 1; index >= 0; index--) {
    const a = w.arrows[index]; a.age += DT;
    let remove = false;
    if (a.stuck) {
      for (const f of w.fighters) {
        if (f.alive && f.ammo < MAX_AMMO && Math.abs(delta(f.x, a.x, WIDTH)) < 0.9 && Math.abs(delta(f.y, a.y, HEIGHT)) < 1.1) {
          f.ammo++; remove = true;
          w.events.push({ type: 'pickup', x: a.x, y: a.y, actor: f.id }); break;
        }
      }
    } else {
      a.vy += ARROW_GRAVITY * DT;
      a.angle = Math.atan2(a.vy, a.vx);
      // Swept samples avoid tunnelling; wall collision is resolved before fighters behind it.
      const steps = Math.max(1, Math.ceil(Math.hypot(a.vx, a.vy) * DT / 0.12));
      for (let n = 0; n < steps && !remove && !a.stuck; n++) {
        const oldX = a.x, oldY = a.y;
        a.x = wrap(a.x + a.vx * DT / steps, WIDTH); a.y = wrap(a.y + a.vy * DT / steps, HEIGHT);
        if (solid(w.level, a.x, a.y)) {
          a.x = oldX; a.y = oldY; a.vx = a.vy = 0; a.stuck = true;
          w.events.push({ type: 'impact', x: a.x, y: a.y, actor: a.owner }); break;
        }
        for (const f of w.fighters) {
          if (!f.alive || (f.id === a.owner && a.age < 0.18)) continue;
          if (Math.abs(delta(f.x, a.x, WIDTH)) > 0.39 || Math.abs(delta(f.y, a.y, HEIGHT)) > 0.58) continue;
          if (f.invulnerable > 0) {
            f.ammo = Math.min(MAX_AMMO, f.ammo + 1);
            w.events.push({ type: 'catch', x: a.x, y: a.y, actor: f.id });
          } else kill(w, f, a.owner);
          remove = true; break;
        }
      }
    }
    // Retire runaway projectiles as recoverable arrows rather than losing ammunition forever.
    if (!a.stuck && a.age > 7) { a.stuck = true; a.vx = a.vy = 0; }
    if (remove) w.arrows.splice(index, 1);
  }
}
