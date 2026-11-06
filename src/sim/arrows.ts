import { DT } from './world.ts';
import type { World, Fighter, Arrow } from './world.ts';
import type { Intent } from './input.ts';
import { solid, wrap, delta, WIDTH, HEIGHT } from './level.ts';
import { kill } from './rules.ts';
import { giveArrows, takeArrow, MAX_AMMO } from './inventory.ts';
export { MAX_AMMO } from './inventory.ts';
export const ARROW_SPEED = 23, ARROW_GRAVITY = 4.5, BOLT_GRAVITY = 0.1, BOMB_RADIUS = 1.6;
export function updateBow(w: World, f: Fighter, i: Intent): void {
  f.shotCooldown = Math.max(0, f.shotCooldown - DT);
  if ((i.shoot || i.shootHeld) && !f.charging && f.shotCooldown <= 0 && f.ammo > 0) { f.charging = true; f.charge = 0; }
  if (!f.charging) return;
  f.charge += DT;
  if (i.shootHeld) return;
  f.charging = false;
  const kind = takeArrow(f);
  if (!kind) return;
  f.shotCooldown = 0.2;
  // Start inside the shooter's bounds, so firing beside a wall cannot skip it.
  w.arrows.push({ id: w.nextArrowId++, owner: f.id, x: f.x + f.aimX * 0.22, y: f.y + f.aimY * 0.22,
    vx: f.aimX * ARROW_SPEED, vy: f.aimY * ARROW_SPEED, angle: Math.atan2(f.aimY, f.aimX), stuck: false, age: 0, kind });
  w.events.push({ type: 'shoot', x: f.x, y: f.y, actor: f.id, kind });
}
function explode(w: World, a: Arrow): void {
  w.events.push({ type: 'explosion', x: a.x, y: a.y, actor: a.owner, kind: 'bomb', radius: BOMB_RADIUS });
  for (const f of w.fighters) {
    if (Math.hypot(delta(a.x, f.x, WIDTH), delta(a.y, f.y, HEIGHT)) <= BOMB_RADIUS) kill(w, f, a.owner);
  }
}
export function stepArrows(w: World): void {
  for (let index = w.arrows.length - 1; index >= 0; index--) {
    const a = w.arrows[index]; a.age += DT;
    const kind = a.kind ?? 'normal';
    let remove = false;
    if (a.stuck) {
      for (const f of w.fighters) {
        if (f.alive && f.ammo < MAX_AMMO && Math.abs(delta(f.x, a.x, WIDTH)) < 0.9 && Math.abs(delta(f.y, a.y, HEIGHT)) < 1.1) {
          giveArrows(f, [kind]); remove = true;
          w.events.push({ type: 'pickup', x: a.x, y: a.y, actor: f.id, kind }); break;
        }
      }
    } else {
      a.vy += (kind === 'bolt' ? BOLT_GRAVITY : ARROW_GRAVITY) * DT;
      a.angle = Math.atan2(a.vy, a.vx);
      // Swept samples avoid tunnelling; only bolts ignore solid tiles.
      const steps = Math.max(1, Math.ceil(Math.hypot(a.vx, a.vy) * DT / 0.12));
      for (let n = 0; n < steps && !remove && !a.stuck; n++) {
        const oldX = a.x, oldY = a.y;
        a.x = wrap(a.x + a.vx * DT / steps, WIDTH); a.y = wrap(a.y + a.vy * DT / steps, HEIGHT);
        if (kind !== 'bolt' && solid(w.level, a.x, a.y)) {
          a.x = oldX; a.y = oldY; a.vx = a.vy = 0; a.stuck = true;
          w.events.push({ type: 'impact', x: a.x, y: a.y, actor: a.owner, kind });
          if (kind === 'bomb') { explode(w, a); remove = true; }
          break;
        }
        for (const f of w.fighters) {
          if (!f.alive || (f.id === a.owner && a.age < 0.18) || a.hitTargets?.includes(f.id)) continue;
          if (Math.abs(delta(f.x, a.x, WIDTH)) > 0.39 || Math.abs(delta(f.y, a.y, HEIGHT)) > 0.58) continue;
          if (f.invulnerable > 0 && f.dashTime > 0) {
            giveArrows(f, [kind]);
            w.events.push({ type: 'catch', x: a.x, y: a.y, actor: f.id, kind });
            remove = true;
          } else if (kind === 'bolt') {
            kill(w, f, a.owner);
            (a.hitTargets ??= []).push(f.id);
          } else {
            // Spawn protection blocks damage but isn't a catch: that requires a timed dash.
            if (kind === 'bomb') explode(w, a);
            else kill(w, f, a.owner);
            remove = true;
          }
          if (remove) break;
        }
      }
    }
    // Retire runaway projectiles without unbounded piercing damage or lost normal ammo.
    if (!remove && !a.stuck && a.age > 7) {
      if (kind === 'bomb') { explode(w, a); remove = true; }
      else { a.stuck = true; a.vx = a.vy = 0; }
    }
    if (remove) w.arrows.splice(index, 1);
  }
}
