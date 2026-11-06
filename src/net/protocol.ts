import { emptyIntent } from '../sim/input.ts';
import type { Intent } from '../sim/input.ts';
import type { MatchOptions, World, SimEvent } from '../sim/world.ts';
export type ServerMessage = { type: 'joined'; room: string; player: number } | { type: 'waiting' } | { type: 'start'; options: MatchOptions } | { type: 'state'; world: World; events: SimEvent[] } | { type: 'error'; message: string } | { type: 'left' };
/** Untrusted client input has no authority over position, ammo, score or timing. */
export function parseIntent(value: unknown): Intent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>, result = emptyIntent();
  if (![v.moveX,v.moveY].every(n => typeof n === 'number' && Number.isFinite(n) && [-1,0,1].includes(n))) return null;
  result.moveX = v.moveX as number; result.moveY = v.moveY as number;
  for (const k of ['jump','jumpHeld','shoot','shootHeld','dash'] as const) { if (typeof v[k] !== 'boolean') return null; result[k] = v[k]; }
  if(v.aimX!==undefined || v.aimY!==undefined) {
    if(typeof v.aimX!=='number'||typeof v.aimY!=='number'||!Number.isFinite(v.aimX)||!Number.isFinite(v.aimY)||Math.abs(v.aimX)>1||Math.abs(v.aimY)>1)return null;
    const length=Math.hypot(v.aimX,v.aimY);if(length<.001)return null;result.aimX=v.aimX/length;result.aimY=v.aimY/length;
  }
  for(const flag of ['crouch','cancelShot'] as const)if(v[flag]!==undefined){if(typeof v[flag]!=='boolean')return null;result[flag]=v[flag];}
  return result;
}
