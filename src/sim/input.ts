// Shared protocol: no DOM, rendering or real-time clock in the simulation.
export interface Intent {
  moveX: number;
  moveY: number; // positive points down, like the ASCII map
  jump: boolean; // rising edge
  jumpHeld: boolean;
  shoot: boolean; // rising edge; shot is released when shootHeld becomes false
  shootHeld: boolean;
  dash: boolean;
  /** Optional for legacy keyboard/bot clients. Normalized by physics; independent of movement. */
  aimX?: number; aimY?: number; crouch?: boolean; cancelShot?: boolean;
}
export const emptyIntent = (): Intent => ({ moveX: 0, moveY: 0, jump: false, jumpHeld: false, shoot: false, shootHeld: false, dash: false });
export function clearIntent(i: Intent): void {
  i.moveX = i.moveY = 0;
  i.jump = i.jumpHeld = i.shoot = i.shootHeld = i.dash = false;
  delete i.aimX; delete i.aimY; delete i.crouch; delete i.cancelShot;
}
