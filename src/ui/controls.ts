import { emptyIntent } from '../sim/input.ts';
import type { Intent } from '../sim/input.ts';
const bindings = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['KeyK', 'Space'], shoot: ['KeyJ'], dash: ['KeyL'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Numpad2', 'Period'], shoot: ['Numpad1', 'Comma'], dash: ['Numpad3', 'Slash'] },
];
const keys = new Set(bindings.flatMap(b => Object.values(b).flat()));
export class Controls {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private frames = [emptyIntent(), emptyIntent(), emptyIntent(), emptyIntent()];
  private padJump = [false, false, false, false];
  private padShoot = [false, false, false, false];
  private padDash = [false, false, false, false];
  private padPause = false;
  active = false;
  constructor(private onPause: () => void, private onBlur: () => void) {
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && !e.repeat) { this.onPause(); return; }
      if (!this.active || !keys.has(e.code)) return;
      e.preventDefault(); if (!this.down.has(e.code)) this.pressed.add(e.code); this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); if (this.active && keys.has(e.code)) e.preventDefault(); });
    window.addEventListener('blur', () => { this.reset(); if (this.active) this.onBlur(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.reset(); if (this.active) this.onBlur(); } });
  }
  reset() { this.down.clear(); this.pressed.clear(); this.frames.forEach(i => Object.assign(i, emptyIntent())); }
  sample(): readonly Intent[] {
    const pads = navigator.getGamepads?.() ?? [];
    let pause = false;
    for (let id = 0; id < 4; id++) {
      const i = this.frames[id], b = bindings[id], pad = pads[id];
      const held = (names: string[]) => names.some(k => this.down.has(k));
      const edge = (names: string[]) => names.some(k => this.pressed.has(k));
      const button = (n: number) => pad?.buttons[n]?.pressed ?? false;
      const jump = button(0), shoot = button(2) || button(7), dash = button(1) || button(5);
      i.moveX = b ? Number(held(b.right)) - Number(held(b.left)) : 0;
      i.moveY = b ? Number(held(b.down)) - Number(held(b.up)) : 0;
      if (pad) {
        if (Math.abs(pad.axes[0] ?? 0) > 0.3) i.moveX = Math.sign(pad.axes[0]);
        if (Math.abs(pad.axes[1] ?? 0) > 0.3) i.moveY = Math.sign(pad.axes[1]);
        if (button(14) || button(15)) i.moveX = Number(button(15)) - Number(button(14));
        if (button(12) || button(13)) i.moveY = Number(button(13)) - Number(button(12));
      }
      i.jump ||= (b ? edge(b.jump) : false) || (jump && !this.padJump[id]);
      i.jumpHeld = (b ? held(b.jump) : false) || jump;
      i.shoot ||= (b ? edge(b.shoot) : false) || (shoot && !this.padShoot[id]);
      i.shootHeld = (b ? held(b.shoot) : false) || shoot;
      i.dash ||= (b ? edge(b.dash) : false) || (dash && !this.padDash[id]);
      this.padJump[id] = jump; this.padShoot[id] = shoot; this.padDash[id] = dash; pause ||= button(9);
    }
    if (pause && !this.padPause) this.onPause(); this.padPause = pause;
    return this.frames;
  }
  consumeEdges() { this.pressed.clear(); for (const i of this.frames) i.jump = i.shoot = i.dash = false; }
}
