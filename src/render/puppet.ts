import * as THREE from 'three';
import { CHARACTERS } from '../sim/world.ts';
import type { Fighter } from '../sim/world.ts';

/** Low-poly procedural archer: fallback when the GLB characters cannot load. Feet at local y=0. */
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 8, 6);
function part(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, round = false) {
  const mesh = new THREE.Mesh(round ? sphere : box, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
export class ProceduralPuppet {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private arm = new THREE.Group();
  private bow = new THREE.Group();
  constructor(character: number) {
    const c = CHARACTERS[character], storm = character === 1;
    const cloth = new THREE.MeshStandardMaterial({ color: c.cloth, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xecc8a1, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: storm ? 0xcddce5 : 0x18232b, roughness: 0.7 });
    const belt = new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14212a });
    const body = this.body; body.position.y = 0.55; this.root.add(body); this.root.scale.setScalar(1.3);
    part(body, cloth, 0, -0.02, 0, 0.48, 0.5, 0.34);
    part(body, belt, 0, -0.14, 0.19, 0.49, 0.08, 0.04);
    part(body, skin, 0, 0.36, 0, 0.28, 0.26, 0.23, true);
    part(body, hair, -0.02, 0.52, -0.04, 0.29, 0.16, 0.24, true);
    part(body, belt, 0, 0.43, 0.21, 0.47, 0.055, 0.05);
    part(body, dark, 0.1, 0.35, 0.22, 0.045, 0.05, 0.04);
    part(body, dark, -0.1, 0.35, 0.22, 0.045, 0.05, 0.04);
    if (storm) {
      for (let n = 0; n < 3; n++) { const spike = part(body, hair, -0.21 + n * 0.16, 0.64, -0.04, 0.15, 0.26, 0.18); spike.rotation.z = 0.3 - n * 0.25; }
    } else part(body, hair, -0.12, 0.67, -0.07, 0.11, 0.12, 0.11, true);
    this.leftLeg.position.set(-0.13, -0.23, 0); this.rightLeg.position.set(0.13, -0.23, 0); body.add(this.leftLeg, this.rightLeg);
    for (const leg of [this.leftLeg, this.rightLeg]) { part(leg, cloth, 0, -0.11, 0, 0.19, 0.25, 0.25); part(leg, dark, 0.02, -0.27, 0.02, 0.23, 0.10, 0.29); }
    part(body, cloth, -0.3, -0.02, 0, 0.17, 0.35, 0.24);
    this.arm.position.set(0, 0.08, 0.18); body.add(this.arm);
    part(this.arm, cloth, 0.19, 0, 0, 0.32, 0.17, 0.22); part(this.arm, skin, 0.39, 0, 0, 0.13, 0.13, 0.16);
    this.bow.position.set(0.52, 0, 0); this.arm.add(this.bow);
    const bowMat = new THREE.MeshStandardMaterial({ color: storm ? 0x7ff5ff : 0xa87642, emissive: storm ? 0x27b9dd : 0x000000, emissiveIntensity: 0.8 });
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.12, -0.47, 0), new THREE.Vector3(0.15, 0, 0), new THREE.Vector3(-0.12, 0.47, 0)]);
    this.bow.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.035, 5, false), bowMat));
    part(this.bow, belt, -0.12, 0, 0, 0.018, 0.92, 0.018);
  }
  /** Facing is applied by the parent (rotation Y); the arm angle is in facing space. */
  update(f: Fighter, time: number, id: number) {
    const run = Math.sin(time * 24 + id) * Math.min(Math.abs(f.vx) / 8, 1);
    this.leftLeg.rotation.z = f.grounded ? run * 0.5 : -0.35;
    this.rightLeg.rotation.z = f.grounded ? -run * 0.5 : 0.5;
    this.body.position.y = 0.55 + (f.grounded ? Math.abs(run) * 0.035 : 0);
    this.body.rotation.z = -Math.abs(f.vx) * 0.009;
    this.arm.rotation.z = Math.atan2(-f.aimY, Math.abs(f.aimX) || 0.0001);
    this.bow.scale.setScalar(f.charging ? 1.06 + Math.sin(time * 25) * 0.035 : 1);
  }
  dispose() {
    const materials = new Set<THREE.Material>();
    this.root.traverse(obj => { if (obj instanceof THREE.Mesh) {
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => materials.add(m));
      if (obj.geometry !== box && obj.geometry !== sphere) obj.geometry.dispose();
    } });
    materials.forEach(m => m.dispose());
  }
}
