import { DT } from './world.ts';
import type { World, Fighter } from './world.ts';
import type { Intent } from './input.ts';
import { solid, wrap, WIDTH, HEIGHT } from './level.ts';
import { HALF_W, HALF_H, CROUCH_HALF_H, bodyHalfHeight } from './body.ts';
import { activateSkill, tickSkill } from './skills.ts';
export { HALF_W, HALF_H } from './body.ts';
export const GRAVITY = 32, JUMP_SPEED = 16.5, RUN_SPEED = 7.8;
function approach(a: number, b: number, amount: number) { return a < b ? Math.min(a + amount, b) : Math.max(a - amount, b); }
function collides(w: World, x: number, y: number, halfHeight=HALF_H): boolean {
  for (let ty = Math.floor(y - halfHeight + 0.001); ty <= Math.floor(y + halfHeight - 0.001); ty++)
    for (let tx = Math.floor(x - HALF_W + 0.001); tx <= Math.floor(x + HALF_W - 0.001); tx++)
      if (solid(w.level, tx, ty)) return true;
  return false;
}
export function moveFighter(w: World, f: Fighter, i: Intent): void {
  f.prevX = f.x; f.prevY = f.y;
  const oldHeight=bodyHalfHeight(f);
  const wantCrouch=!!i.crouch && f.grounded && !i.jump && !i.dash;
  if(wantCrouch && !f.crouching) {f.crouching=true;f.y+=oldHeight-CROUCH_HALF_H;f.prevY=f.y;}
  else if(!wantCrouch && f.crouching) {const standingY=f.y+CROUCH_HALF_H-HALF_H;if(!collides(w,f.x,standingY,HALF_H)){f.crouching=false;f.y=standingY;f.prevY=f.y;}}
  const halfHeight=bodyHalfHeight(f);
  tickSkill(f);
  f.dashCooldown = Math.max(0, f.dashCooldown - DT);
  f.invulnerable = Math.max(0, f.invulnerable - DT);
  f.wallLock = Math.max(0, f.wallLock - DT);
  f.coyote = f.grounded ? 0.1 : Math.max(0, f.coyote - DT);
  f.jumpBuffer = i.jump ? 0.1 : Math.max(0, f.jumpBuffer - DT);
  const mx = Math.sign(i.moveX), my = Math.sign(i.moveY);
  if (mx) f.facing = mx;
  const pointerLength=Math.hypot(i.aimX??0,i.aimY??0);
  if(Number.isFinite(pointerLength)&&pointerLength>.001) {f.aimX=i.aimX!/pointerLength;f.aimY=i.aimY!/pointerLength;}
  else if (mx || my) {
    const length = Math.hypot(mx, my); f.aimX = mx / length; f.aimY = my / length;
  } else if (!f.charging) { f.aimX = f.facing; f.aimY = 0; }
  if (i.dash && f.dashCooldown <= 0) {
    const dx = mx || (my ? 0 : f.facing), dy = my, length = Math.hypot(dx, dy);
    f.vx = dx / length * 21; f.vy = dy / length * 21;
    f.dashTime = 0.15; f.invulnerable = Math.max(f.invulnerable, 0.15);
    activateSkill(w, f);
    w.events.push({ type: 'dash', x: f.x, y: f.y, actor: f.id });
  }
  if (f.dashTime > 0) f.dashTime = Math.max(0, f.dashTime - DT);
  else {
    if (f.wallLock <= 0) f.vx = approach(f.vx, mx * RUN_SPEED * (f.crouching?.4:1), (f.grounded ? 95 : 52) * DT);
    if (f.jumpBuffer > 0 && (f.coyote > 0 || f.wall !== 0)) {
      f.vy = -JUMP_SPEED;
      if (!f.grounded && f.wall) { f.vx = -f.wall * 10; f.wallLock = 0.16; }
      f.grounded = false; f.coyote = 0; f.jumpBuffer = 0;
      w.events.push({ type: 'jump', x: f.x, y: f.y + halfHeight, actor: f.id });
    }
    if (!i.jumpHeld && f.vy < -6) f.vy = -6;
    f.vy = Math.min(f.vy + GRAVITY * (my > 0 ? 2.1 : 1) * DT, my > 0 ? 25 : 19);
    if (f.wall && mx === f.wall && f.vy > 3 && my <= 0) f.vy = 3;
  }
  f.wall = 0;
  const nx = f.x + f.vx * DT;
  if (collides(w, nx, f.y, halfHeight)) {
    f.wall = Math.sign(f.vx);
    // Snap to the nearest tile face. At 120 Hz displacement is < one tile.
    if (f.vx > 0) f.x = Math.floor(nx + HALF_W) - HALF_W;
    if (f.vx < 0) f.x = Math.floor(nx - HALF_W) + 1 + HALF_W;
    f.vx = 0;
  } else f.x = nx;
  f.grounded = false;
  const ny = f.y + f.vy * DT;
  if (collides(w, f.x, ny, halfHeight)) {
    if (f.vy > 0) { f.y = Math.floor(ny + halfHeight) - halfHeight; f.grounded = true; }
    if (f.vy < 0) f.y = Math.floor(ny - halfHeight) + 1 + halfHeight;
    f.vy = 0;
  } else f.y = ny;
  // Retain wall contact for buffered wall jumps even when no horizontal input.
  if (!f.wall) {
    if (collides(w, f.x + 0.025, f.y, halfHeight)) f.wall = 1;
    else if (collides(w, f.x - 0.025, f.y, halfHeight)) f.wall = -1;
  }
  f.x = wrap(f.x, WIDTH); f.y = wrap(f.y, HEIGHT);
}
