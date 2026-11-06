import { emptyIntent, clearIntent } from '../sim/input.ts';
import type { Intent } from '../sim/input.ts';
import type { TouchControls } from './touch.ts';
import { readLayout, layoutById, layoutKeys, LOCAL_P2 } from './control-layouts.ts';
export class Controls {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private frames = [emptyIntent(), emptyIntent(), emptyIntent(), emptyIntent()];
  private padJump = [false, false, false, false];
  private padShoot = [false, false, false, false];
  private padDash = [false, false, false, false];
  private padPause = false;
  private touchPrev = { jump: false, shoot: false, dash: false };
  /** Optional virtual pad merged into player 1. */
  touch: TouchControls | null = null;
  active = false;
  layout=readLayout();
  private mouseHeld=false;
  private mousePressed=false;
  private pointer: {x:number;y:number}|null=null;
  private aimAt: ((x:number,y:number)=>{x:number;y:number}|null)|null=null;
  attachPointer(canvas: HTMLCanvasElement, aimAt:(x:number,y:number)=>{x:number;y:number}|null) {
    this.aimAt=aimAt;
    const position=(e:PointerEvent)=>{if(e.pointerType==='mouse')this.pointer={x:e.clientX,y:e.clientY};};
    canvas.addEventListener('pointermove',position);
    canvas.addEventListener('pointerdown',e=>{if(!this.active||!this.layout.mouse||e.pointerType!=='mouse'||e.button!==0)return;e.preventDefault();position(e);this.mouseHeld=true;this.mousePressed=true;});
    window.addEventListener('pointerup',e=>{if(e.button===0)this.mouseHeld=false;});
    window.addEventListener('pointercancel',()=>{this.mouseHeld=false;this.mousePressed=false;});
    canvas.addEventListener('pointerleave',()=>{if(!this.mouseHeld)this.pointer=null;});
  }
  constructor(private onPause: () => void, private onBlur: () => void) {
    window.addEventListener('tla-layout-change',e=>{this.layout=layoutById((e as CustomEvent<string>).detail);this.reset();});
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && !e.repeat) { this.onPause(); return; }
      if (!this.active || (e.target as HTMLElement)?.closest('input,select,textarea') || ![...layoutKeys(this.layout),...layoutKeys(LOCAL_P2)].includes(e.code)) return;
      e.preventDefault(); if (!this.down.has(e.code)) this.pressed.add(e.code); this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); if (this.active && [...layoutKeys(this.layout),...layoutKeys(LOCAL_P2)].includes(e.code)) e.preventDefault(); });
    window.addEventListener('blur', () => { this.reset(); if (this.active) this.onBlur(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.reset(); if (this.active) this.onBlur(); } });
  }
  reset() {
    this.down.clear(); this.pressed.clear(); this.frames.forEach(clearIntent);
    this.mouseHeld=this.mousePressed=false;this.pointer=null;
    this.touch?.reset(); this.touchPrev = { jump: false, shoot: false, dash: false };
  }
  sample(): readonly Intent[] {
    const pads = navigator.getGamepads?.() ?? [];
    if(!this.active){this.frames.forEach(clearIntent);const pause=pads.some(p=>p?.buttons[9]?.pressed);if(pause&&!this.padPause)this.onPause();this.padPause=pause;return this.frames;}
    let pause = false;
    for (let id = 0; id < 4; id++) {
      const i = this.frames[id], b = id===0?this.layout:id===1?LOCAL_P2:undefined, pad = pads[id];
      delete i.aimX;delete i.aimY;i.crouch=!!b?.crouch.some(k=>this.down.has(k));
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
    const gamepadUsed=pads[0]&&(pads[0].axes.some(a=>Math.abs(a)>.3)||pads[0].buttons.some(b=>b.pressed));
    if(gamepadUsed)this.pointer=null;
    if(this.active&&this.layout.mouse&&this.pointer) {
      const aim=this.aimAt?.(this.pointer.x,this.pointer.y);
      if(aim){this.frames[0].aimX=aim.x;this.frames[0].aimY=aim.y;}
      this.frames[0].shoot ||= this.mousePressed;this.frames[0].shootHeld ||= this.mouseHeld;
    }
    const t = this.touch?.state;
    if (t && this.active) {
      const i = this.frames[0];
      if (t.moveX) i.moveX = t.moveX; if (t.moveY) i.moveY = t.moveY;
      i.jump ||= t.jump && !this.touchPrev.jump; i.jumpHeld ||= t.jump;
      i.shoot ||= t.shoot && !this.touchPrev.shoot; i.shootHeld ||= t.shoot;
      i.dash ||= t.dash && !this.touchPrev.dash;
      this.touchPrev = { jump: t.jump, shoot: t.shoot, dash: t.dash };
    }
    if (pause && !this.padPause) this.onPause(); this.padPause = pause;
    return this.frames;
  }
  consumeEdges() { this.pressed.clear();this.mousePressed=false; for (const i of this.frames) i.jump = i.shoot = i.dash = false; }
}
