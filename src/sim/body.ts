import type { Fighter } from './world.ts';
export const HALF_W=.32, HALF_H=.55, CROUCH_HALF_H=.30;
export function bodyHalfHeight(f: Pick<Fighter,'crouching'>) {return f.crouching?CROUCH_HALF_H:HALF_H;}
