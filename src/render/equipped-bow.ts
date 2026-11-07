import * as THREE from 'three';

/** Authored equipped asset, NOT sockets extracted from either baked GLB.
 * Local +X is outgoing aim; +Y is across the limbs. Distances are world tiles. */
export const EQUIPPED_BOW_GEOMETRY = {
  upperTip: [.19, .64, 0], lowerTip: [.19, -.64, 0],
  grip: [0, 0, 0], brace: .19, draw: .14, releaseSeconds: .18,
} as const;
const yAxis = new THREE.Vector3(0, 1, 0);

export interface BowAppearance {
  name: string; provenance: string; wood: number; binding: number; string: number;
  arenaPlane?: boolean;
  upperCurve?: readonly (readonly [number, number, number])[];
}
export const MIZU_BOW: BowAppearance = {
  name: 'mizu-authored-equipped-bow',
  provenance: 'procedural authored wood/indigo; separate from untouched stowed GLB bow',
  wood: 0x70472f, binding: 0x202e4c, string: 0xa99b7c,
};
export const STORM_BOW: BowAppearance = {
  name: 'storm-authored-equipped-bow',
  provenance: 'procedural authored cold dragonwood/blue; original 435v ornament remains in GLB',
  wood: 0x253a4e, binding: 0x172436, string: 0x88adbb, arenaPlane: true,
  // Authored support follows below the preserved dragon's measured bottom
  // (~.23,.26,-.053 in bow frame), not a second detached crown or GLB edit.
  upperCurve: [[.10,.16,-.025],[.23,.29,-.053],[.21,.48,-.025],[.19,.64,0]],
};
export class EquippedBow {
  readonly root = new THREE.Group();
  readonly grip = new THREE.Object3D();
  readonly upperTip = new THREE.Object3D();
  readonly lowerTip = new THREE.Object3D();
  readonly nock = new THREE.Object3D();
  readonly strings: THREE.Mesh[];
  private heldDraw = 0;
  private delta = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private span = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  private appearance: BowAppearance;
  constructor(appearance: BowAppearance = MIZU_BOW) {
    this.appearance = appearance;
    this.root.name = appearance.name;
    this.root.userData.provenance = appearance.provenance;
    const wood = new THREE.MeshStandardMaterial({ color: appearance.wood, roughness: .78, metalness: 0 });
    const binding = new THREE.MeshStandardMaterial({ color: appearance.binding, roughness: .92, metalness: 0 });
    const string = new THREE.MeshStandardMaterial({ color: appearance.string, roughness: .98, metalness: 0 });
    this.grip.name = 'authored-grip'; this.upperTip.name = 'authored-upper-tip';
    this.lowerTip.name = 'authored-lower-tip'; this.nock.name = 'authored-string-nock';
    this.upperTip.position.fromArray(EQUIPPED_BOW_GEOMETRY.upperTip);
    this.lowerTip.position.fromArray(EQUIPPED_BOW_GEOMETRY.lowerTip);
    this.root.add(this.grip, this.upperTip, this.lowerTip, this.nock);
    // A continuous wooden recurve through the grip; both endpoints are the
    // actual authored string anchors, not a box or guessed character extremity.
    const curve = new THREE.CatmullRomCurve3([
      [.19,-.64,0],[.12,-.56,0],[-.035,-.34,0],[-.025,-.16,0],[0,0,0],
      ...(appearance.upperCurve ?? [[-.025,.16,0],[-.035,.34,0],[.12,.56,0],[.19,.64,0]]),
    ].map(p => new THREE.Vector3(...p)), false, 'centripetal');
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .025, 8, false), wood);
    limb.name = 'authored-wooden-limb'; this.root.add(limb);
    // Indigo grip wraps, no emissive shader, glow or borrowed/generated texture.
    for (let i = 0; i < 7; i++) {
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.036,.036,.024,10),binding);
      wrap.position.y = (i-3)*.027; this.root.add(wrap);
    }
    for (const tip of [this.upperTip,this.lowerTip]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),wood); tip.add(cap);
    }
    this.strings = [0,1].map(() => new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,1,5), string));
    this.strings.forEach(s => { s.name = 'authored-string-segment'; this.root.add(s); });
    this.root.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = false; o.frustumCulled = false; } });
    this.setNock(0);
  }
  private setNock(pull: number) {
    this.nock.position.set(-EQUIPPED_BOW_GEOMETRY.brace - EQUIPPED_BOW_GEOMETRY.draw * pull, 0, 0);
    for (const [i,tip] of [this.upperTip,this.lowerTip].entries()) {
      const segment = this.strings[i]; this.delta.subVectors(this.nock.position,tip.position);
      segment.position.copy(tip.position).addScaledVector(this.delta,.5);
      segment.scale.set(1,this.delta.length(),1);
      segment.quaternion.setFromUnitVectors(yAxis,this.delta.normalize());
    }
  }
  update(handWorld: THREE.Vector3, aimX: number, aimY: number, charging: boolean, charge: number, releaseTime: number, visible: boolean, forearmWorld: THREE.Vector3, palmNormalWorld: THREE.Vector3) {
    this.root.visible = visible;
    this.root.position.copy(handWorld);
    this.aim.set(aimX,-aimY,0).normalize();
    // Bank around outgoing aim using the measured palm surface normal. The
    // knuckle-row trial made a limb follow the forearm depth and crossed it;
    // the palm normal instead directs the limbs out of that skin surface.
    this.span.copy(palmNormalWorld).addScaledVector(this.aim,-palmNormalWorld.dot(this.aim));
    if (this.span.lengthSq() < 1e-10) {
      this.normal.subVectors(handWorld,forearmWorld);
      this.span.crossVectors(this.normal,this.aim);
    }
    if(this.appearance.arenaPlane)this.span.set(-this.aim.y,this.aim.x,0);
    this.span.normalize();
    this.normal.crossVectors(this.aim,this.span).normalize();
    this.root.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.aim,this.span,this.normal));
    this.setNock(this.pull(charging,charge,releaseTime));
  }
  /** Shared finite draw reference for string and draw-arm IK. */
  pull(charging:boolean,charge:number,releaseTime:number) {
    if(charging){this.heldDraw=THREE.MathUtils.clamp(charge/.35,0,1);return this.heldDraw;}
    if(releaseTime<=0)return 0;
    const t=THREE.MathUtils.clamp(1-releaseTime/EQUIPPED_BOW_GEOMETRY.releaseSeconds,0,1);
    return this.heldDraw*(1-t)**3*Math.cos(3*Math.PI*t);
  }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.root.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; geometries.add(m.geometry); materials.add(m.material as THREE.Material); });
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); this.root.removeFromParent();
  }
}
