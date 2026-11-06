import * as THREE from 'three';
import type { World, SimEvent } from '../sim/world.ts';
import { CHARACTERS } from '../sim/world.ts';
const CAPACITY = 400;
/** Bounded particle pool. Cosmetic randomness never touches the seeded simulation RNG. */
export class Effects {
  private positions = new Float32Array(CAPACITY * 3);
  private colors = new Float32Array(CAPACITY * 3);
  private velocity = new Float32Array(CAPACITY * 2);
  private life = new Float32Array(CAPACITY);
  private cursor = 0;
  private geometry = new THREE.BufferGeometry();
  private color = new THREE.Color();
  shake = 0; slow = 0; flash = 0;
  constructor(scene: THREE.Group) {
    this.positions.fill(999);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    const dots = new THREE.Points(this.geometry, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    dots.frustumCulled = false; scene.add(dots);
  }
  reset() { this.life.fill(0); this.positions.fill(999); this.shake = this.slow = this.flash = 0; }
  private emit(x: number, y: number, color: string | number, speed: number, lifetime: number) {
    const n = this.cursor; this.cursor = (n + 1) % CAPACITY;
    this.positions[n * 3] = x; this.positions[n * 3 + 1] = 18 - y; this.positions[n * 3 + 2] = 1;
    this.velocity[n * 2] = (Math.random() - 0.5) * speed; this.velocity[n * 2 + 1] = (Math.random() - 0.25) * speed;
    this.life[n] = lifetime; this.color.set(color); this.color.toArray(this.colors, n * 3);
  }
  event(e: SimEvent, w: World) {
    if (e.type === 'kill') { this.shake = 0.16; this.slow = 0.16; this.flash = 0.12; }
    const count = e.type === 'kill' ? 30 : e.type === 'jump' ? 8 : e.type === 'impact' || e.type === 'catch' ? 12 : e.type === 'dash' ? 8 : 0;
    const color = e.type === 'kill' ? CHARACTERS[w.fighters[e.target!].character].color : e.type === 'catch' ? 0x8affdd : 0xd3d8ad;
    for (let n = 0; n < count; n++) this.emit(e.x, e.y, color, e.type === 'kill' ? 10 : 4, 0.25 + Math.random() * 0.4);
  }
  update(realDt: number, gameDt: number, w: World) {
    this.shake = Math.max(0, this.shake - realDt * 0.8); this.slow = Math.max(0, this.slow - realDt); this.flash = Math.max(0, this.flash - realDt);
    for (let n = 0; n < CAPACITY; n++) {
      if (this.life[n] <= 0) continue;
      this.life[n] -= realDt;
      this.positions[n * 3] += this.velocity[n * 2] * realDt;
      this.positions[n * 3 + 1] += this.velocity[n * 2 + 1] * realDt;
      this.velocity[n * 2 + 1] -= 10 * realDt;
      if (this.life[n] <= 0) this.positions[n * 3 + 2] = 999;
    }
    if (gameDt > 0) for (const a of w.arrows) if (!a.stuck) this.emit(a.x, a.y, w.fighters[a.owner]?.character === 1 ? 0x6dedff : 0xffdfa1, 0.1, 0.13);
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.color.needsUpdate = true;
  }
}
