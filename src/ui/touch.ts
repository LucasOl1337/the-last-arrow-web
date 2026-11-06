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
  private buttons = new Map<HTMLElement, { key: 'jump' | 'shoot' | 'dash'; ids: Set<number> }>();
  constructor(onPause: () => void = () => {}, private onCancel: () => void = () => {}) {
    this.element.className = 'touch-layer';
    const pause = document.createElement('button'); pause.className = 'touch-pause'; pause.type = 'button';
    pause.textContent = 'Pausa'; pause.setAttribute('aria-label', 'Pausar partida'); pause.onclick = onPause;
    const rotate = document.createElement('div'); rotate.className = 'rotate-notice'; rotate.setAttribute('role', 'status');
    rotate.innerHTML = '<span aria-hidden="true">↻</span><strong>Gire o celular</strong><p>Jogue com a tela deitada.<br>A partida espera por você.</p>';
    const zone = document.createElement('div'); zone.className = 'touch-stick';
    this.base.className = 'stick-base'; this.knob.className = 'stick-knob'; this.base.append(this.knob); zone.append(this.base);
    const pad = document.createElement('div'); pad.className = 'touch-buttons';
    for (const [key, label] of [['dash', 'Dash'], ['shoot', 'Atirar'], ['jump', 'Pular']] as const) {
      const b = document.createElement('button'); b.type = 'button'; b.className = `touch-btn ${key}`; b.textContent = label;
      b.setAttribute('aria-label', key === 'shoot' ? 'Segurar e soltar para atirar' : label);
      const ids = new Set<number>(); this.buttons.set(b, { key, ids });
      b.addEventListener('pointerdown', e => { e.preventDefault(); ids.add(e.pointerId); b.setPointerCapture(e.pointerId); this.state[key] = true; b.classList.add('on'); });
      const up = (e: PointerEvent) => { ids.delete(e.pointerId); this.state[key] = ids.size > 0; b.classList.toggle('on', this.state[key]); };
      b.addEventListener('pointerup', up);
      const cancel = (e: PointerEvent) => { if (ids.has(e.pointerId)) { this.reset(); this.onCancel(); } };
      b.addEventListener('pointercancel', cancel); b.addEventListener('lostpointercapture', cancel);
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
    zone.addEventListener('pointerup', release);
    const cancelStick = (e: PointerEvent) => { if (e.pointerId === this.stickId) { this.reset(); this.onCancel(); } };
    zone.addEventListener('pointercancel', cancelStick); zone.addEventListener('lostpointercapture', cancelStick);
    this.element.append(zone, pad, pause, rotate);
  }
  reset() {
    Object.assign(this.state, { moveX: 0, moveY: 0, jump: false, shoot: false, dash: false });
    this.stickId = null; this.knob.style.transform = ''; this.base.classList.remove('on');
    // Capture can stay until pointerup; cleared owners ensure an old contact cannot reactivate input.
    for (const [button, { ids }] of this.buttons) { ids.clear(); button.classList.remove('on'); }
  }
}
