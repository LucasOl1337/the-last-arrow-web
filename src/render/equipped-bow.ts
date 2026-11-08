import * as THREE from 'three';

/** Authored equipped asset, NOT sockets extracted from either baked GLB.
 * Local +X is outgoing aim; +Y is across the limbs; +Z faces the camera.
 * Distances are world tiles. A braced bow: the riser is the forward-most part,
 * the limbs sweep back toward the archer and the tips flick forward again.
 * At rest the string is straight between the tips (x = -brace); drawing only
 * moves the nock further back, opposite to the shot direction. */
export const EQUIPPED_BOW_GEOMETRY = {
  upperTip: [-.19, .64, 0], lowerTip: [-.19, -.64, 0],
  grip: [0, 0, 0], brace: .19, draw: .14, releaseSeconds: .18,
} as const;
const yAxis = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1);
/** Limb axis of the bow plane, upper limb always on the archer's up side: a
 * left-facing archer mirrors the bow, never turns it upside down. */
export function bowSpan(aimX: number, aimY: number, facing: number, out = new THREE.Vector3()) {
  const side = aimX !== 0 ? Math.sign(aimX) : Math.sign(facing) || 1;
  return out.set(aimY, aimX, 0).normalize().multiplyScalar(side);
}

type P2 = readonly [number, number];
export interface BowAppearance {
  name: string; provenance: string;
  wood: number; belly: number; binding: number; wrap: number; inlay: number; string: number;
  /** Upper limb centerline (lower is mirrored), riser centre to beyond the nock. */
  limb: readonly P2[];
  /** Limb thickness in the bow plane / width across it, root→tip. */
  thickness: readonly [number, number]; width: readonly [number, number];
  /** Bands of cord along the span (|y|), each [y, length]. */
  bands: readonly (readonly [number, number])[];
  /** Silver back-edge blade (Storm) instead of a plain wooden back. */
  blade?: number;
}
export const MIZU_BOW: BowAppearance = {
  name: 'mizu-authored-equipped-bow',
  provenance: 'procedural authored wood, cord bands, indigo grip and teal inlay; separate from untouched stowed GLB bow',
  wood: 0x7b4a2a, belly: 0x9a6438, binding: 0x24325a, wrap: 0xd9c9a3, inlay: 0x3fb8b0, string: 0xd8ccb0,
  limb: [[0,0],[.012,.09],[.004,.19],[-.03,.31],[-.08,.43],[-.135,.53],[-.178,.60],[-.19,.64],[-.18,.672]],
  thickness: [.034,.014], width: [.05,.022],
  bands: [[.105,.035],[.5,.03],[.6,.025]],
};
export const STORM_BOW: BowAppearance = {
  name: 'storm-authored-equipped-bow',
  provenance: 'procedural authored dark dragonwood, silver blade edge and cyan inlay; original 435v ornament remains in GLB',
  wood: 0x1d2c44, belly: 0x2a3f5e, binding: 0x161d2c, wrap: 0xb9c7d6, inlay: 0x55dcff, string: 0x9fe7ff,
  limb: [[0,0],[.014,.10],[.004,.2],[-.035,.32],[-.095,.44],[-.155,.54],[-.2,.6],[-.19,.64],[-.165,.685]],
  thickness: [.036,.013], width: [.056,.02],
  bands: [[.11,.03]],
  blade: 0xd6e2ee,
};

/** Swept elliptical tube: radius a in the bow plane, b across it, tapering. */
function sweep(points: THREE.Vector3[], a: (t:number)=>number, b: (t:number)=>number, offset: (t:number)=>number = () => 0, segments = 48, sides = 10) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const pos: number[] = [], idx: number[] = [], p = new THREE.Vector3(), tan = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments; curve.getPointAt(t, p); curve.getTangentAt(t, tan);
    n.set(-tan.y, tan.x, 0).normalize(); // in-plane normal, points to the bow's back side
    const o = offset(t);
    for (let k = 0; k < sides; k++) {
      const th = k / sides * Math.PI * 2;
      pos.push(p.x + n.x * (o + Math.cos(th) * a(t)), p.y + n.y * (o + Math.cos(th) * a(t)), Math.sin(th) * b(t));
    }
  }
  for (let i = 0; i < segments; i++) for (let k = 0; k < sides; k++) {
    const q = i * sides, r = (i + 1) * sides, k1 = (k + 1) % sides;
    idx.push(q + k, r + k, q + k1, q + k1, r + k, r + k1);
  }
  // Rounded end caps (fan) so tips read as finished horn, not open pipe.
  for (const [ring, flip] of [[0, true], [segments, false]] as const) {
    const c = pos.length / 3; curve.getPointAt(ring / segments, p); pos.push(p.x, p.y, 0);
    for (let k = 0; k < sides; k++) { const a0 = ring * sides + k, a1 = ring * sides + (k + 1) % sides; idx.push(...(flip ? [c, a1, a0] : [c, a0, a1])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { geometry: g, curve };
}

export class EquippedBow {
  readonly root = new THREE.Group();
  readonly grip = new THREE.Object3D();
  readonly upperTip = new THREE.Object3D();
  readonly lowerTip = new THREE.Object3D();
  readonly nock = new THREE.Object3D();
  readonly strings: THREE.Mesh[];
  private heldDraw = 0;
  private delta = new THREE.Vector3();
  private seatTurn = new THREE.Quaternion();
  private readonly limb: readonly (readonly [number, number])[];
  private aim = new THREE.Vector3();
  private span = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  constructor(appearance: BowAppearance = MIZU_BOW) {
    this.limb = appearance.limb.map(([x, y]) => [x, y] as const);
    this.root.name = appearance.name;
    this.root.userData.provenance = appearance.provenance;
    const mat = (color: number, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const wood = mat(appearance.wood, .62), belly = mat(appearance.belly, .7), binding = mat(appearance.binding, .95);
    const wrap = mat(appearance.wrap, .9), inlay = mat(appearance.inlay, .45, .1);
    const string = new THREE.MeshStandardMaterial({ color: appearance.string, roughness: .98, metalness: 0 });
    this.grip.name = 'authored-grip'; this.upperTip.name = 'authored-upper-tip';
    this.lowerTip.name = 'authored-lower-tip'; this.nock.name = 'authored-string-nock';
    this.upperTip.position.fromArray(EQUIPPED_BOW_GEOMETRY.upperTip);
    this.lowerTip.position.fromArray(EQUIPPED_BOW_GEOMETRY.lowerTip);
    this.root.add(this.grip, this.upperTip, this.lowerTip, this.nock);
    // One continuous stave through the grip: lower tip → riser → upper tip.
    const upper = appearance.limb.map(([x,y]) => new THREE.Vector3(x,y,0));
    const stave = [...upper.slice(1).reverse().map(p => new THREE.Vector3(p.x,-p.y,0)), ...upper];
    const [t0,t1] = appearance.thickness, [w0,w1] = appearance.width;
    // Thick riser in the middle (|s-.5| small), tapering limbs to slim tips.
    const taper = (s:number) => { const d = Math.min(1, Math.abs(s - .5) * 2); return d < .16 ? 0 : Math.pow((d - .16) / .84, .85); };
    const thick = (s:number) => THREE.MathUtils.lerp(t0, t1, taper(s)), wide = (s:number) => THREE.MathUtils.lerp(w0, w1, taper(s));
    const body = sweep(stave, thick, wide, () => 0, 96, 12);
    const limb = new THREE.Mesh(body.geometry, wood); limb.name = 'authored-stave'; this.root.add(limb);
    // Belly lamination toward the archer: a lighter strip that reads as a
    // shaped limb rather than a uniform tube.
    const bellyStrip = new THREE.Mesh(sweep(stave, s => thick(s) * .45, s => wide(s) * .92, s => -thick(s) * .62, 96, 8).geometry, belly);
    bellyStrip.name = 'authored-belly'; this.root.add(bellyStrip);
    // Inlay on both broad faces (camera side and far side), limbs only.
    const inlayPath = stave.filter(p => Math.abs(p.y) > .17 && Math.abs(p.y) < .6);
    for (const half of [inlayPath.filter(p => p.y > 0), inlayPath.filter(p => p.y < 0)]) {
      const geometry = sweep(half, () => .007, () => .003, () => 0, 32, 6).geometry;
      for (const side of [1, -1]) {
        const m = new THREE.Mesh(geometry, inlay); m.position.z = side * w0 * .42; m.name = 'authored-inlay'; this.root.add(m);
      }
    }
    if (appearance.blade !== undefined) {
      // Storm: silver blade along the bow's back (target side), widening into
      // a hooked fin before each tip. Functional edge, no emissive glow.
      const blade = mat(appearance.blade, .3, .55);
      const back = sweep(stave, s => thick(s) * .35 + .012 * Math.pow(taper(s), 3), () => .006, s => thick(s) + .01 + .025 * Math.pow(taper(s), 4), 96, 6);
      const m = new THREE.Mesh(back.geometry, blade); m.name = 'authored-blade-edge'; this.root.add(m);
      for (const s of [1, -1]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(.022, .11, 4), blade);
        claw.position.set(-.15, s * .7, 0); claw.rotation.z = s > 0 ? -.35 : Math.PI + .35; claw.name = 'authored-tip-claw'; this.root.add(claw);
      }
    }
    // Grip: indigo/charcoal leather wrap (thicker than the riser) + arrow shelf.
    const gripWrap = new THREE.Mesh(new THREE.CylinderGeometry(.033, .031, .15, 12), binding);
    gripWrap.position.set(.004, -.01, 0); gripWrap.scale.z = w0 / .05; gripWrap.name = 'authored-grip-wrap'; this.root.add(gripWrap);
    for (const y of [-.055, -.01, .035]) { const ridge = new THREE.Mesh(new THREE.TorusGeometry(.032, .004, 5, 14), binding); ridge.rotation.x = Math.PI / 2; ridge.position.set(.004, y, 0); this.root.add(ridge); }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(.03, .012, .03), wrap); shelf.position.set(.03, .072, 0); shelf.name = 'authored-arrow-shelf'; this.root.add(shelf);
    // Cord bands at limb joints and below the tips.
    const samples = Array.from({ length: 201 }, (_, i) => i / 200);
    for (const [y, len] of appearance.bands) for (const sign of [1, -1]) {
      const u = samples.reduce((a, b) => Math.abs(body.curve.getPointAt(b).y - sign * y) < Math.abs(body.curve.getPointAt(a).y - sign * y) ? b : a);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, len, 10), wrap);
      band.scale.set(thick(u) * 1.1 + .004, 1, wide(u) * 1.1 + .004);
      band.position.copy(body.curve.getPointAt(u)); band.name = 'authored-cord-band';
      band.quaternion.setFromUnitVectors(yAxis, body.curve.getTangentAt(u)); this.root.add(band);
    }
    // String loops at the nocks.
    for (const tip of [this.upperTip, this.lowerTip]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(.016, .005, 5, 10), string); loop.rotation.y = Math.PI / 2; tip.add(loop);
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
      segment.scale.set(1,Math.max(1e-6,this.delta.length()),1);
      if (this.delta.lengthSq() > 1e-12) segment.quaternion.setFromUnitVectors(yAxis,this.delta.normalize());
      else segment.quaternion.identity();
    }
  }
  /** The riser is held in the fist; `gripWorld` is the measured fist centre. */
  update(gripWorld: THREE.Vector3, aimX: number, aimY: number, charging: boolean, charge: number, releaseTime: number, visible: boolean, facing = 1) {
    this.root.visible = visible;
    this.root.position.copy(gripWorld);
    this.aim.set(aimX,-aimY,0).normalize();
    // Bow plane is the arena plane: limbs across aim, string toward camera side.
    bowSpan(aimX,aimY,facing,this.span);
    this.normal.crossVectors(this.aim,this.span).normalize();
    this.root.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.aim,this.span,this.normal));
    this.setNock(this.pull(charging,charge,releaseTime));
  }
  /** Seat a hand-borne ornament (Storm's preserved dragon) on the authored
   * upper limb: rotate the bow in its own plane about the fist until the real
   * ornament point sits on the limb curve at its own radius from the grip.
   * Only for a relaxed carry (`weight` 0 when an arrow is nocked, so the bow
   * stays exactly across the shot). Returns the full in-plane angle (rad). */
  seat(pointWorld: THREE.Vector3, weight: number) {
    this.root.updateMatrixWorld(true);
    const local = this.root.worldToLocal(this.delta.copy(pointWorld)), limb = this.limb;
    const r = Math.hypot(local.x, local.y);
    let k = 1; while (k < limb.length - 1 && Math.hypot(...limb[k]) < r) k++;
    const [a, b] = [limb[k - 1], limb[k]], ra = Math.hypot(...a), rb = Math.hypot(...b);
    const t = THREE.MathUtils.clamp((r - ra) / ((rb - ra) || 1), 0, 1);
    const angle = Math.atan2(local.y, local.x) - Math.atan2(a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t);
    if (weight > 0) { this.root.quaternion.multiply(this.seatTurn.setFromAxisAngle(zAxis, angle * weight)); this.root.updateMatrixWorld(true); }
    return angle;
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
