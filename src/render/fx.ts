import * as THREE from 'three';
import type { World, SimEvent } from '../sim/world.ts';
import { CHARACTERS } from '../sim/world.ts';
import { HEIGHT } from '../sim/level.ts';
import { softDot, leaf } from './textures.ts';

const DOTS = 500, LEAVES = 160, RINGS = 8;
/**
 * Bounded particle pools + screen juice. Cosmetic randomness never touches the seeded simulation RNG.
 * Timing contract with main.ts: `hitstop` freezes the sim, `slow` scales it to 0.3, `shake`/`flash` are screen-only.
 */
export class Effects {
  // Glow dots (sparks, dust, embers).
  private dPos = new Float32Array(DOTS * 3); private dCol = new Float32Array(DOTS * 3); private dSize = new Float32Array(DOTS);
  private dVel = new Float32Array(DOTS * 3); private dLife = new Float32Array(DOTS); private dMax = new Float32Array(DOTS);
  private dDrag = new Float32Array(DOTS); private dGrav = new Float32Array(DOTS);
  private dGeo = new THREE.BufferGeometry(); private dCursor = 0;
  // Leaves / feathers (instanced quads that tumble).
  private leaves: THREE.InstancedMesh; private lPos = new Float32Array(LEAVES * 3); private lVel = new Float32Array(LEAVES * 3);
  private lRot = new Float32Array(LEAVES * 3); private lSpin = new Float32Array(LEAVES * 3); private lLife = new Float32Array(LEAVES); private lCursor = 0;
  // Shock rings (explosions / kills).
  private rings: { mesh: THREE.Mesh; life: number; max: number; size: number }[] = [];
  private color = new THREE.Color(); private dummy = new THREE.Object3D();
  shake = 0; slow = 0; flash = 0; hitstop = 0;
  constructor(scene: THREE.Group) {
    this.dPos.fill(999);
    this.dGeo.setAttribute('position', new THREE.BufferAttribute(this.dPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.dGeo.setAttribute('color', new THREE.BufferAttribute(this.dCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.dGeo.setAttribute('size', new THREE.BufferAttribute(this.dSize, 1).setUsage(THREE.DynamicDrawUsage));
    const dots = new THREE.Points(this.dGeo, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: softDot() } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC;
        void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * (900.0 / -mv.z); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; void main() { float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    dots.frustumCulled = false; dots.renderOrder = 4;
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: leaf(), alphaTest: 0.3, side: THREE.DoubleSide }), LEAVES);
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.leaves.frustumCulled = false;
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < LEAVES; i++) { this.leaves.setMatrixAt(i, this.dummy.matrix); this.leaves.setColorAt(i, this.color.set(0xffffff)); }
    const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < RINGS; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      mesh.visible = false; scene.add(mesh); this.rings.push({ mesh, life: 0, max: 1, size: 1 });
    }
    scene.add(dots, this.leaves);
  }
  reset() {
    this.dLife.fill(0); this.dPos.fill(999); this.lLife.fill(0);
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < LEAVES; i++) this.leaves.setMatrixAt(i, this.dummy.matrix);
    this.leaves.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    this.shake = this.slow = this.flash = this.hitstop = 0;
  }
  /** Scene-space emitter (y up). */
  private dot(x: number, y: number, color: THREE.ColorRepresentation, vx: number, vy: number, life: number, size: number, grav = -9, drag = 1.5, z = 1) {
    const n = this.dCursor; this.dCursor = (n + 1) % DOTS;
    this.dPos[n * 3] = x; this.dPos[n * 3 + 1] = y; this.dPos[n * 3 + 2] = z;
    this.dVel[n * 3] = vx; this.dVel[n * 3 + 1] = vy; this.dVel[n * 3 + 2] = (Math.random() - 0.5) * 0.5;
    this.dLife[n] = this.dMax[n] = life; this.dSize[n] = size; this.dGrav[n] = grav; this.dDrag[n] = drag;
    this.color.set(color); this.color.toArray(this.dCol, n * 3);
  }
  private leafBurst(x: number, y: number, color: THREE.ColorRepresentation, count: number, speed: number) {
    for (let k = 0; k < count; k++) {
      const n = this.lCursor; this.lCursor = (n + 1) % LEAVES;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.lPos.set([x, y, 1 + (Math.random() - 0.5) * 0.4], n * 3);
      this.lVel.set([Math.cos(a) * s, Math.sin(a) * s + 2.5, (Math.random() - 0.5) * 2], n * 3);
      this.lRot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], n * 3);
      this.lSpin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], n * 3);
      this.lLife[n] = 0.9 + Math.random() * 0.9;
      // Mix character colour with leaf greens / feather whites.
      const pick = Math.random();
      this.color.set(pick < 0.5 ? color : pick < 0.8 ? 0x7fbf4a : 0xf3f0e4); this.leaves.setColorAt(n, this.color);
    }
    if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }
  private ring(x: number, y: number, color: THREE.ColorRepresentation, size: number, life: number) {
    const r = this.rings.reduce((a, b) => (a.life <= b.life ? a : b));
    r.life = r.max = life; r.size = size; r.mesh.visible = true; r.mesh.position.set(x, y, 0.95);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
  /** Landing dust from FightersView (sim coordinates, y down). */
  land(x: number, simY: number, strength: number) {
    const y = HEIGHT - simY;
    for (let k = 0; k < 6 + strength * 10; k++) { const side = k % 2 ? 1 : -1; this.dot(x + side * 0.15, y + 0.04, 0xd8cfb0, side * (1 + Math.random() * 2.6) * (0.5 + strength), 0.3 + Math.random() * 1.2, 0.35 + Math.random() * 0.3, 0.05 + Math.random() * 0.05, -2, 4); }
  }
  event(e: SimEvent, w: World) {
    const x = e.x, y = HEIGHT - e.y;
    switch (e.type) {
      case 'kill': {
        const color = CHARACTERS[w.fighters[e.target!].character].color;
        this.hitstop = Math.max(this.hitstop, 0.08); this.slow = 0.3; this.shake = Math.max(this.shake, 0.22); this.flash = 0.14;
        this.leafBurst(x, y, color, 34, 6.5);
        for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7; this.dot(x, y, k % 3 ? color : 0xffffff, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.45, 0.06 + Math.random() * 0.07, -6, 2.2); }
        this.ring(x, y, color, 2.2, 0.35);
        break;
      }
      case 'explosion': {
        const radius = e.radius ?? 1.6;
        this.shake = Math.max(this.shake, 0.3); this.flash = Math.max(this.flash, 0.1);
        for (let k = 0; k < 70; k++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * radius * 5; this.dot(x, y, k % 4 === 0 ? 0xfff2c0 : k % 2 ? 0xff7a2a : 0xff3a1a, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.5, 0.08 + Math.random() * 0.1, -3, 3); }
        for (let k = 0; k < 18; k++) this.dot(x + (Math.random() - 0.5), y + (Math.random() - 0.5), 0x5a4a40, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, 0.8 + Math.random() * 0.5, 0.18, 1.2, 1.2, 0.8);
        this.ring(x, y, 0xffa040, radius, 0.3); this.ring(x, y, 0xfff0c0, radius * 0.6, 0.18);
        break;
      }
      case 'jump': for (let k = 0; k < 8; k++) this.dot(x + (Math.random() - 0.5) * 0.4, y + 0.02, 0xd8cfb0, (Math.random() - 0.5) * 3, Math.random() * 0.8, 0.3 + Math.random() * 0.2, 0.05, -2, 4); break;
      case 'dash': for (let k = 0; k < 10; k++) this.dot(x, y, CHARACTERS[w.fighters[e.actor].character].color, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0.25, 0.06, 0, 5); break;
      case 'impact': {
        const c = e.kind === 'bolt' ? 0x7ff5ff : 0xffe2a8;
        for (let k = 0; k < 10; k++) this.dot(x, y, k % 2 ? c : 0xb8b0a0, (Math.random() - 0.5) * 5, Math.random() * 3, 0.25 + Math.random() * 0.25, 0.04 + Math.random() * 0.03, -10, 1.5);
        break;
      }
      case 'catch': this.ring(x, y, 0x8affdd, 0.9, 0.25); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; this.dot(x, y, 0x8affdd, Math.cos(a) * 3, Math.sin(a) * 3, 0.3, 0.06, 0, 3); } break;
      case 'pickup': for (let k = 0; k < 6; k++) this.dot(x, y, 0xfff0b0, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, 0.4, 0.05, 0, 2); break;
      case 'shoot': if (e.kind === 'bolt') { this.shake = Math.max(this.shake, 0.06); for (let k = 0; k < 10; k++) this.dot(x, y, 0x7ff5ff, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, 0.25, 0.06, 0, 4); } break;
      case 'chest-spawn': this.ring(x, y, 0xffe08a, 0.9, 0.4); for (let k = 0; k < 14; k++) this.dot(x + (Math.random() - 0.5) * 0.6, y - 0.3, 0xffe08a, (Math.random() - 0.5) * 1.2, 1 + Math.random() * 2.5, 0.6, 0.05, -1, 1); break;
      case 'chest-open': {
        const special = e.reward?.find(k => k !== 'normal');
        const c = special === 'bolt' ? 0x6ff3ff : special === 'bomb' ? 0xff6a3c : 0xffd27a;
        this.ring(x, y, c, 1.3, 0.35);
        for (let k = 0; k < 26; k++) this.dot(x + (Math.random() - 0.5) * 0.5, y, c, (Math.random() - 0.5) * 3, 2 + Math.random() * 4, 0.6 + Math.random() * 0.3, 0.06, -6, 1.2);
        break;
      }
    }
  }
  update(realDt: number, gameDt: number, w: World) {
    this.shake = Math.max(0, this.shake - realDt * 0.9); this.slow = Math.max(0, this.slow - realDt);
    this.flash = Math.max(0, this.flash - realDt); this.hitstop = Math.max(0, this.hitstop - realDt);
    const dt = gameDt > 0 ? Math.max(gameDt, realDt * 0.3) : 0;
    for (let n = 0; n < DOTS; n++) {
      if (this.dLife[n] <= 0) continue;
      this.dLife[n] -= dt;
      const drag = Math.exp(-this.dDrag[n] * dt);
      this.dVel[n * 3] *= drag; this.dVel[n * 3 + 1] = this.dVel[n * 3 + 1] * drag + this.dGrav[n] * dt;
      this.dPos[n * 3] += this.dVel[n * 3] * dt; this.dPos[n * 3 + 1] += this.dVel[n * 3 + 1] * dt; this.dPos[n * 3 + 2] += this.dVel[n * 3 + 2] * dt;
      if (this.dLife[n] <= 0) this.dPos[n * 3 + 2] = 999;
    }
    // Fade by shrinking size relative to remaining life (cheap: no per-vertex alpha attribute).
    for (let n = 0; n < DOTS; n++) if (this.dLife[n] > 0) this.dSize[n] = Math.max(0, this.dSize[n] * (this.dLife[n] / Math.max(this.dLife[n] + dt, 1e-4)));
    for (let n = 0; n < LEAVES; n++) {
      if (this.lLife[n] <= 0) continue;
      this.lLife[n] -= dt;
      const i = n * 3, drag = Math.exp(-2.2 * dt);
      this.lVel[i] *= drag; this.lVel[i + 1] = this.lVel[i + 1] * drag - 5 * dt; this.lVel[i + 2] *= drag;
      this.lVel[i] += Math.sin(this.lLife[n] * 6 + n) * 3 * dt; // flutter
      for (let a = 0; a < 3; a++) { this.lPos[i + a] += this.lVel[i + a] * dt; this.lRot[i + a] += this.lSpin[i + a] * dt; }
      this.dummy.position.set(this.lPos[i], this.lPos[i + 1], this.lPos[i + 2]);
      this.dummy.rotation.set(this.lRot[i], this.lRot[i + 1], this.lRot[i + 2]);
      this.dummy.scale.setScalar(this.lLife[n] > 0 ? Math.min(1, this.lLife[n] * 2) : 0); this.dummy.updateMatrix();
      this.leaves.setMatrixAt(n, this.dummy.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= realDt; const t = 1 - Math.max(0, r.life) / r.max;
      r.mesh.scale.setScalar(0.2 + r.size * (1 - Math.pow(1 - t, 3)));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }
    // Bolt arrows shed sparks; bomb fuses smoke.
    if (gameDt > 0) for (const a of w.arrows) {
      if (a.stuck) continue;
      if (a.kind === 'bolt' && Math.random() < 0.6) this.dot(a.x, HEIGHT - a.y, 0x9ff8ff, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.2, 0.05, 0, 3);
      else if (a.kind === 'bomb' && Math.random() < 0.5) this.dot(a.x, HEIGHT - a.y, 0xffb040, Math.random() - 0.5, 1 + Math.random(), 0.25, 0.04, 2, 2);
    }
    this.dGeo.attributes.position.needsUpdate = true; this.dGeo.attributes.color.needsUpdate = true; this.dGeo.attributes.size.needsUpdate = true;
  }
}
