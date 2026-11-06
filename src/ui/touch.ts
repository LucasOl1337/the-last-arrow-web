/**
 * Basic touch layer for phones/tablets (pointer: coarse): left virtual stick (move/aim),
 * right buttons for jump / shoot (hold to charge) / dash. Feeds player 1 through Controls.
 */
export interface TouchState { moveX: number; moveY: number; jump: boolean; shoot: boolean; dash: boolean }
export class TouchControls {
  readonly element = document.createElement('div');
  readonly state: TouchState = { moveX: 0, moveY: 0, jump: false, shoot: false, dash: false };
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private knob = document.createElement('div');
  private base = document.createElement('div');
  constructor() {
    this.element.className = 'touch-layer';
    this.element.setAttribute('aria-hidden', 'true');
    const zone = document.createElement('div'); zone.className = 'touch-stick';
    this.base.className = 'stick-base'; this.knob.className = 'stick-knob'; this.base.append(this.knob); zone.append(this.base);
    const pad = document.createElement('div'); pad.className = 'touch-buttons';
    for (const [key, label] of [['dash', 'Dash'], ['shoot', 'Atirar'], ['jump', 'Pular']] as const) {
      const b = document.createElement('div'); b.className = `touch-btn ${key}`; b.textContent = label;
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); this.state[key] = true; b.classList.add('on'); });
      const up = () => { this.state[key] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      pad.append(b);
    }
    zone.addEventListener('pointerdown', e => {
      if (this.stickId !== null) return; e.preventDefault();
      this.stickId = e.pointerId; zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect(); this.origin = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX - r.left}px`; this.base.style.top = `${e.clientY - r.top}px`; this.base.classList.add('on');
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== this.stickId) return;
      const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y, len = Math.hypot(dx, dy), max = 42;
      const k = len > max ? max / len : 1; this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      // 8-way with a dead zone, like the d-pad.
      this.state.moveX = Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 0.4 ? Math.sign(dx) : 0;
      this.state.moveY = Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 0.4 ? Math.sign(dy) : 0;
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null; this.state.moveX = this.state.moveY = 0; this.knob.style.transform = ''; this.base.classList.remove('on');
    };
    zone.addEventListener('pointerup', release); zone.addEventListener('pointercancel', release);
    this.element.append(zone, pad);
  }
  reset() { Object.assign(this.state, { moveX: 0, moveY: 0, jump: false, shoot: false, dash: false }); this.stickId = null; this.knob.style.transform = ''; }
}
