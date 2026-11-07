import { clearIntent, emptyIntent } from '../sim/input.ts';
import type { Intent } from '../sim/input.ts';

/** Structural snapshots allow deterministic tests without claiming real hardware. */
export interface PadSnapshot {
  index: number; id: string; connected: boolean; mapping: string;
  axes: readonly number[]; buttons: readonly { pressed: boolean; value?: number }[];
}
export type MenuInput = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';
interface Device { index: number; id: string; armed: boolean; previous: Set<number>; direction: string; repeatAt: number }
export const PAD_DEADZONE = 0.25;
/** Preserve analogue strength; zero drift and clamp malformed snapshots. */
export function padAxis(value = 0): number {
  if (!Number.isFinite(value) || Math.abs(value) <= PAD_DEADZONE) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - PAD_DEADZONE) / (1 - PAD_DEADZONE));
}
const held = (pad: PadSnapshot, n: number) => !!pad.buttons[n]?.pressed || (pad.buttons[n]?.value ?? 0) > 0.5;
const relevant = [0, 1, 2, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15];
export class GamepadInput {
  readonly frames: Intent[] = Array.from({ length: 4 }, emptyIntent);
  private devices: (Device | undefined)[] = Array.from({ length: 4 }, () => undefined);
  unsupported = 0;
  get slots(): readonly (number | null)[] { return this.devices.map(d => d?.index ?? null); }
  reset() {
    this.frames.forEach(clearIntent);
    for (const d of this.devices) if (d) { d.armed = false; d.previous.clear(); d.direction = ''; }
  }
  consumeEdges() {
    for (const f of this.frames) { f.jump = f.shoot = f.dash = false; delete f.cancelShot; }
  }
  poll(snapshots: readonly (PadSnapshot | null)[], now: number, focused = true): MenuInput[] {
    const pads = snapshots.filter((p): p is PadSnapshot => !!p?.connected && p.mapping === 'standard');
    this.unsupported = snapshots.filter(p => p?.connected && p.mapping !== 'standard').length;
    // Removal never shifts another player's slot. Cancel is retained until a sim/network tick consumes it.
    this.devices.forEach((d, slot) => {
      if (d && !pads.some(p => p.index === d.index && p.id === d.id)) {
        this.devices[slot] = undefined; clearIntent(this.frames[slot]); this.frames[slot].cancelShot = true;
      }
    });
    for (const p of pads) if (!this.devices.some(d => d?.index === p.index)) {
      const slot = this.devices.findIndex(d => !d);
      if (slot >= 0) this.devices[slot] = { index: p.index, id: p.id, armed: false, previous: new Set(), direction: '', repeatAt: 0 };
    }
    const menu = new Set<MenuInput>();
    this.devices.forEach((d, slot) => {
      if (!d) return;
      const pad = pads.find(p => p.index === d.index)!;
      const f = this.frames[slot];
      const x = Number(held(pad, 15)) - Number(held(pad, 14)) || padAxis(pad.axes[0]);
      const y = Number(held(pad, 13)) - Number(held(pad, 12)) || padAxis(pad.axes[1]);
      const buttons = new Set(relevant.filter(n => held(pad, n)));
      if (!focused) { clearIntent(f); f.cancelShot = true; d.armed = false; d.previous = buttons; return; }
      if (!d.armed) {
        f.moveX = f.moveY = 0; f.jumpHeld = f.shootHeld = false;
        if (!x && !y && !buttons.size) { d.armed = true; d.previous.clear(); }
        return;
      }
      const edge = (n: number) => buttons.has(n) && !d.previous.has(n);
      f.moveX = x; f.moveY = y; f.crouch = y > 0.5;
      delete f.aimX; delete f.aimY;
      if (x || y) {
        const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
        f.aimX = Math.cos(angle); f.aimY = Math.sin(angle);
      }
      f.jump ||= edge(0); f.jumpHeld = buttons.has(0);
      f.shoot ||= edge(2) || edge(1); f.shootHeld = buttons.has(2) || buttons.has(1);
      f.dash ||= [4, 5, 6, 7].some(edge);
      if (edge(0)) menu.add('confirm');
      if (edge(1) || edge(8)) menu.add('back');
      if (edge(9)) menu.add('pause');
      const direction = Math.abs(y) > 0.5 ? (y > 0 ? 'down' : 'up') : Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : '';
      if (direction && (direction !== d.direction || now >= d.repeatAt)) {
        menu.add(direction as MenuInput); d.repeatAt = now + (direction !== d.direction ? 350 : 140);
      }
      d.direction = direction; d.previous = buttons;
    });
    return [...menu];
  }
}
