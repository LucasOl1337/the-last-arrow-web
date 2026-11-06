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
  return result;
}
