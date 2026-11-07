import { emptyIntent, clearIntent } from '../sim/input.ts';
import type { Intent } from '../sim/input.ts';
import type { TouchControls } from './touch.ts';
import { readLayout, layoutKeys, LOCAL_P2 } from './control-layouts.ts';
import { GamepadInput } from '../input/gamepad.ts';
import type { MenuInput } from '../input/gamepad.ts';
export class Controls {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private frames = [emptyIntent(), emptyIntent(), emptyIntent(), emptyIntent()];
  readonly gamepads = new GamepadInput();
  onMenu: (action: MenuInput) => void = () => {};
  private focused = true;
  private pendingCancel = false;
  /** Poll even on the title screen; combat is sampled separately. */
  pollGamepads(now: number) {
    let pads: readonly (Gamepad | null)[] = [];
    try { pads = navigator.getGamepads?.() ?? []; } catch { /* Policy-disabled API: keyboard remains available. */ }
    const actions = this.gamepads.poll(pads, now, this.focused && !document.hidden);
    for (const action of actions) {
      if (action === 'pause') this.onPause();
      else if (!this.active) this.onMenu(action);
    }
    if (!this.active) this.gamepads.consumeEdges();
  }
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
    canvas.addEventListener('pointerdown',e=>{
      if(!this.active||e.pointerType!=='mouse')return;
      const code=`Mouse${e.button}`;position(e);
      if(this.utility(code)){e.preventDefault();return;}
      if(!layoutKeys(this.layout).includes(code))return;
      e.preventDefault();if(!this.down.has(code))this.pressed.add(code);this.down.add(code);this.mouseHeld=true;
    });
    canvas.addEventListener('contextmenu',e=>{if(this.active)e.preventDefault();});
    window.addEventListener('pointerup',e=>{this.down.delete(`Mouse${e.button}`);this.mouseHeld=[...this.down].some(k=>k.startsWith('Mouse'));});
    window.addEventListener('pointercancel',()=>{for(const code of this.down)if(code.startsWith('Mouse'))this.down.delete(code);this.mouseHeld=false;});
    canvas.addEventListener('pointerleave',()=>{if(!this.mouseHeld)this.pointer=null;});
  }
  private utility(code:string) {
    if(code==='Escape'||(this.layout.pause??[]).includes(code)){this.onPause();return true;}
    if(!this.active)return false;
    for(const action of ['camera','mute'] as const)if((this.layout[action]??[]).includes(code)) {
      window.dispatchEvent(new CustomEvent('tla-control-action',{detail:action}));return true;
    }
    return false;
  }
  private onPause: () => void;
  private onBlur: () => void;
  constructor(onPause: () => void, onBlur: () => void) {
    this.onPause = onPause; this.onBlur = onBlur;
    window.addEventListener('tla-layout-change',()=>{this.layout=readLayout();this.reset();});
    window.addEventListener('keydown', e => {
      if (!e.repeat && !(e.target as HTMLElement)?.closest('input,select,textarea') && this.utility(e.code)) { e.preventDefault();return; }
      if (!this.active || (e.target as HTMLElement)?.closest('input,select,textarea') || ![...layoutKeys(this.layout),...layoutKeys(LOCAL_P2)].includes(e.code)) return;
      e.preventDefault(); if (!this.down.has(e.code)) this.pressed.add(e.code); this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); if (this.active && [...layoutKeys(this.layout),...layoutKeys(LOCAL_P2)].includes(e.code)) e.preventDefault(); });
    window.addEventListener('blur', () => { this.focused = false; this.reset(); if (this.active) this.onBlur(); });
    window.addEventListener('focus', () => { this.focused = true; this.reset(); });
    document.addEventListener('visibilitychange', () => { this.reset(); if (document.hidden && this.active) this.onBlur(); });
  }
  reset() {
    this.down.clear(); this.pressed.clear(); this.frames.forEach(clearIntent);
    this.gamepads.reset(); this.pendingCancel = true;
    this.mouseHeld=this.mousePressed=false;this.pointer=null;
    this.touch?.reset(); this.touchPrev = { jump: false, shoot: false, dash: false };
  }
  sample(): readonly Intent[] {
    if(!this.active){this.frames.forEach(clearIntent);return this.frames;}
    for (let id = 0; id < 4; id++) {
      const i = this.frames[id], b = id===0?this.layout:id===1?LOCAL_P2:undefined, pad = this.gamepads.frames[id];
      delete i.aimX;delete i.aimY;delete i.cancelShot;
      i.crouch=!!b?.crouch.some(k=>this.down.has(k)) || !!pad.crouch;
      if (pad.cancelShot || this.pendingCancel) i.cancelShot = true;
      const held = (names: string[]) => names.some(k => this.down.has(k));
      const edge = (names: string[]) => names.some(k => this.pressed.has(k));

      i.moveX = b ? Number(held(b.right)) - Number(held(b.left)) : 0;
      i.moveY = b ? Number(held(b.down)) - Number(held(b.up)) : 0;
      if (pad.moveX) i.moveX = pad.moveX;
      if (pad.moveY) i.moveY = pad.moveY;
      if (pad.aimX !== undefined && pad.aimY !== undefined) { i.aimX=pad.aimX; i.aimY=pad.aimY; }
      i.jump ||= (b ? edge(b.jump) : false) || pad.jump;
      i.jumpHeld = (b ? held(b.jump) : false) || pad.jumpHeld;
      i.shoot ||= (b ? edge(b.shoot) : false) || pad.shoot;
      i.shootHeld = (b ? held(b.shoot) : false) || pad.shootHeld;
      i.dash ||= (b ? edge(b.dash) : false) || pad.dash;
    }
    const p1=this.gamepads.frames[0];
    const gamepadUsed=p1.moveX||p1.moveY||p1.jumpHeld||p1.shootHeld||p1.dash;
    if(gamepadUsed)this.pointer=null;
    if(this.active&&this.layout.mouse&&this.pointer) {
      const aim=this.aimAt?.(this.pointer.x,this.pointer.y);
      if(aim){this.frames[0].aimX=aim.x;this.frames[0].aimY=aim.y;}
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
    return this.frames;
  }
  consumeEdges() { this.pressed.clear();this.mousePressed=false;this.pendingCancel=false;this.gamepads.consumeEdges(); for (const i of this.frames) {i.jump = i.shoot = i.dash = false;delete i.cancelShot;} }
}
