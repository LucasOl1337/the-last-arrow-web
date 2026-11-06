import * as THREE from 'three';
import type { ArrowKind, World } from '../sim/world.ts';
import { HEIGHT } from '../sim/level.ts';
import { wood, softDot } from './textures.ts';

const GLOW: Record<ArrowKind, number> = { normal: 0xffd27a, bolt: 0x6ff3ff, bomb: 0xff5a3c };
interface ChestView { group: THREE.Group; lid: THREE.Object3D; glow: THREE.Sprite; born: number }

/** Treasure chests from world.chests (optional field of the gameplay round). */
export class ChestsView {
  private views = new Map<number, ChestView>();
  private body: THREE.BufferGeometry; private lidGeo: THREE.BufferGeometry; private band: THREE.BufferGeometry;
  private woodMat: THREE.MeshStandardMaterial; private metal: THREE.MeshStandardMaterial;
  constructor(private scene: THREE.Group) {
    this.body = new THREE.BoxGeometry(0.62, 0.36, 0.42); this.body.translate(0, 0.18, 0);
    this.lidGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.62, 10, 1, false, 0, Math.PI); this.lidGeo.rotateZ(Math.PI / 2); this.lidGeo.rotateX(Math.PI / 2);
    this.band = new THREE.BoxGeometry(0.07, 0.4, 0.44); this.band.translate(0, 0.2, 0);
    this.woodMat = new THREE.MeshStandardMaterial({ map: wood(), color: 0xb07040, roughness: 0.75 });
    this.metal = new THREE.MeshStandardMaterial({ color: 0xe8c068, metalness: 0.8, roughness: 0.35, emissive: 0x3a2a08 });
  }
  reset() { for (const v of this.views.values()) this.remove(v); this.views.clear(); }
  private remove(v: ChestView) { this.scene.remove(v.group); (v.glow.material as THREE.Material).dispose(); }
  update(w: World, time: number) {
    const live = new Set<number>();
    for (const c of w.chests ?? []) {
      live.add(c.id);
      let v = this.views.get(c.id);
      if (!v) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(this.body, this.woodMat); body.castShadow = true; group.add(body);
        for (const x of [-0.22, 0.22]) { const b = new THREE.Mesh(this.band, this.metal); b.position.x = x; group.add(b); }
        const lid = new THREE.Group(); lid.position.set(0, 0.36, -0.0);
        const lidMesh = new THREE.Mesh(this.lidGeo, this.woodMat); lidMesh.castShadow = true; lid.add(lidMesh); group.add(lid);
        const kind = c.reward.find(k => k !== 'normal') ?? 'normal';
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: GLOW[kind], blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        glow.position.set(0, 0.4, 0.3); group.add(glow);
        this.scene.add(group);
        v = { group, lid, glow, born: time }; this.views.set(c.id, v);
      }
      const age = time - v.born, pop = Math.min(1, age / 0.25);
      const s = pop < 1 ? 1.25 * Math.sin(pop * Math.PI * 0.5) + (1 - pop) * 0 : 1;
      v.group.scale.setScalar(Math.max(0.01, s));
      v.group.position.set(c.x, HEIGHT - c.y - 0.5 + Math.abs(Math.sin(time * 3 + c.id)) * 0.04, 0.2);
      v.group.rotation.y = Math.sin(time * 1.3 + c.id) * 0.25;
      v.lid.rotation.x = -0.12 - Math.abs(Math.sin(time * 2.2 + c.id)) * 0.12;
      const k = 1.1 + Math.sin(time * 4 + c.id) * 0.25; v.glow.scale.set(k, k, 1);
    }
    for (const [id, v] of this.views) if (!live.has(id)) { this.remove(v); this.views.delete(id); }
  }
}
