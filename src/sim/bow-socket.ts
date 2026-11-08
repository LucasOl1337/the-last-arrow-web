import type { Fighter } from './world.ts';
import { bodyHalfHeight } from './body.ts';

/** Authored weapon contract in tile units. SIM owns XY; both renderers use the
 * same arena depth. No GLB, client-provided origin or animation clock is trusted.
 *
 * The grip is the bow-arm shoulder plus REACH along the aim, where the shoulder
 * is first rotated by the same two-joint spine pitch the renderer applies for
 * that aim. In the torso's own frame every aim is then the same pose: bow arm
 * extended at shoulder height, draw hand anchored under the chin. Body numbers
 * are per-character constants (feet-relative, facing right), not GLB reads. */
export const SHOT_PLANE = 1.20;
export const PROJECTILE_TIP = .475;
export const HELD_TIP = .54;
export const DRAW_TRAVEL = .14;
/** In-plane reach from the bow shoulder; the arena depth (~.46 from the
 * shoulder to SHOT_PLANE) takes the rest of the ~.6 two-bone arm. */
export const REACH = .36;
/** Relaxed (no arrow nocked) carry: bow nearer the body, both arms reach. */
export const REACH_IDLE = .2;
/** Relaxed carry plane: nearer the body than SHOT_PLANE (not a shot contract). */
export const CARRY_PLANE = 1.05;
/** Max spine pitch (rad), split equally over Spine1 and Spine2 as rendered. */
export const PITCH_LIMIT = 1.1;
const BODY = [
  { spine1: [.089, 1.361], spine2: [.133, 1.501], shoulder: [.179, 1.653] }, // Mizu
  { spine1: [.159, 1.536], spine2: [.204, 1.656], shoulder: [.260, 1.760] }, // Storm
] as const;
export type BowPose = Pick<Fighter, 'x' | 'y' | 'aimX' | 'aimY' | 'crouching' | 'character' | 'facing' | 'charging'>;

/** Shared aim pitch (rad, + = up) used by renderer spine and socket alike. */
export function aimPitch(aimX: number, aimY: number) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.atan2(-aimY, Math.abs(aimX))));
}

/** `bodySide` is the body's facing as rendered (1 right, -1 left, between
 * while the renderer is still turning); the SIM passes the settled side. */
export function bowSocket(f: BowPose, charge = .35, pitch = f.charging ? aimPitch(f.aimX, f.aimY) : 0, bodySide?: number, reach = REACH) {
  const length = Math.hypot(f.aimX, f.aimY) || 1;
  const dx = f.aimX / length, dy = f.aimY / length;
  const side = dx !== 0 ? Math.sign(dx) : Math.sign(f.facing) || 1;
  const body = BODY[f.character === 1 ? 1 : 0], b = bodySide ?? side;
  // Y-up model space relative to the feet; rotate shoulder about Spine1 then
  // about the moved Spine2, each by half the pitch (counter-clockwise when
  // facing right; mirrored when facing left).
  const a = pitch * .5 * side, c = Math.cos(a), s = Math.sin(a);
  const rot = (p: readonly number[], o: readonly number[]) => [o[0] + (p[0]-o[0])*c - (p[1]-o[1])*s, o[1] + (p[0]-o[0])*s + (p[1]-o[1])*c];
  const s1 = [body.spine1[0]*b, body.spine1[1]], s2 = rot([body.spine2[0]*b, body.spine2[1]], s1);
  const shoulder = rot(rot([body.shoulder[0]*b, body.shoulder[1]], s1), s2);
  const scale = f.crouching ? .58 : 1;
  const feet = f.y + bodyHalfHeight(f);
  const grip = { x: f.x + shoulder[0] + dx * reach, y: feet - shoulder[1] * scale + dy * reach * scale, z: SHOT_PLANE };
  const pull = Math.max(0, Math.min(1, charge / .35));
  const tip = { x: grip.x + dx * (HELD_TIP - DRAW_TRAVEL * pull), y: grip.y + dy * (HELD_TIP - DRAW_TRAVEL * pull), z: SHOT_PLANE };
  const origin = { x: tip.x - dx * PROJECTILE_TIP, y: tip.y - dy * PROJECTILE_TIP, z: SHOT_PLANE };
  return { grip, tip, origin };
}

