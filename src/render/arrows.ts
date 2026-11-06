import * as THREE from 'three';
import type { World } from '../sim/world.ts';
export class ArrowsView {
  private shafts: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  constructor(scene: THREE.Group) {
    this.shafts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.045, 0.045), new THREE.MeshStandardMaterial({ color: 0xffe1a2, emissive: 0x72582d, emissiveIntensity: 0.45 }), 64);
    const head = new THREE.ConeGeometry(0.095, 0.2, 4); head.rotateZ(-Math.PI / 2); head.translate(0.35, 0, 0);
    this.heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: 0xe3f9ff, emissive: 0x65a7bd, emissiveIntensity: 0.8 }), 64);
    this.shafts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shafts.frustumCulled = this.heads.frustumCulled = false;
    scene.add(this.shafts, this.heads);
  }
  update(w: World) {
    const count = Math.min(w.arrows.length, 64); this.shafts.count = this.heads.count = count;
    for (let n = 0; n < count; n++) {
      const a = w.arrows[n]; this.dummy.position.set(a.x, 18 - a.y, 0.8); this.dummy.rotation.z = -a.angle; this.dummy.updateMatrix();
      this.shafts.setMatrixAt(n, this.dummy.matrix); this.heads.setMatrixAt(n, this.dummy.matrix);
      this.color.set(w.fighters[a.owner]?.character === 1 ? 0x70edff : 0xffd397); this.shafts.setColorAt(n, this.color);
    }
    this.shafts.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
    if (this.shafts.instanceColor) this.shafts.instanceColor.needsUpdate = true;
  }
}
