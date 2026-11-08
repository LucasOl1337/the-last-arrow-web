import * as THREE from 'three';
import type { ArrowKind, World } from '../sim/world.ts';
import { HEIGHT } from '../sim/level.ts';
import { softDot } from './textures.ts';
import { SHOT_PLANE } from '../sim/bow-socket.ts';

const MAX = 64, TRAIL = 10, Z = SHOT_PLANE;
const COLORS: Record<ArrowKind, number> = { normal: 0xffd9a0, bolt: 0x6ff3ff, bomb: 0xff5a3c };

/** Shaft + head + three fletchings, merged into one geometry pointing +X, tip at x=.475. */
function arrowGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(0.018, 0.018, 0.66, 6); shaft.rotateZ(-Math.PI / 2); parts.push(shaft);
  const head = new THREE.ConeGeometry(0.055, 0.15, 4); head.rotateZ(-Math.PI / 2); head.translate(0.4, 0, 0); parts.push(head);
  for (let n = 0; n < 3; n++) {
    const fin = new THREE.BufferGeometry();
    fin.setAttribute('position', new THREE.Float32BufferAttribute([-0.33, 0, 0, -0.2, 0, 0, -0.36, 0.075, 0, -0.2, 0, 0, -0.24, 0.07, 0, -0.36, 0.075, 0], 3));
    fin.computeVertexNormals(); fin.rotateX(n * Math.PI * 2 / 3); parts.push(fin);
  }
  // Manual merge (keeps three/examples out of the hot path); vertex colour marks the parts.
  let count = 0; for (const p of parts) count += (p.index ? p.index.count : p.attributes.position.count);
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), color = new Float32Array(count * 3);
  let o = 0;
  parts.forEach((p, i) => {
    const g = p.index ? p.toNonIndexed() : p; g.computeVertexNormals();
    const pa = g.attributes.position, na = g.attributes.normal;
    const c = i === 0 ? [0.85, 0.72, 0.5] : i === 1 ? [0.95, 0.98, 1] : [1, 1, 1];
    for (let v = 0; v < pa.count; v++, o++) {
      position.set([pa.getX(v), pa.getY(v), pa.getZ(v)], o * 3); normal.set([na.getX(v), na.getY(v), na.getZ(v)], o * 3); color.set(c, o * 3);
    }
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  parts.forEach(p => p.dispose());
  return merged;
}

interface Track { points: THREE.Vector3[]; stuckAt: number; seen: number }

export class ArrowsView {
  private mesh: THREE.InstancedMesh;
  private glow: THREE.InstancedMesh;
  private trail: THREE.Mesh;
  private trailPos = new Float32Array(MAX * TRAIL * 2 * 3);
  private trailCol = new Float32Array(MAX * TRAIL * 2 * 4);
  private tracks = new Map<number, Track>();
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private frame = 0;
  constructor(scene: THREE.Group) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.18, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(arrowGeometry(), material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    // Additive glow sprite at the head (bolt: big cyan halo; bomb: flickering fuse).
    const glowGeo = new THREE.PlaneGeometry(0.5, 0.5); glowGeo.translate(0.38, 0, 0.02);
    this.glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ map: softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), MAX);
    this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.glow.frustumCulled = false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 4).setUsage(THREE.DynamicDrawUsage));
    const index: number[] = [];
    for (let a = 0; a < MAX; a++) for (let s = 0; s < TRAIL - 1; s++) { const b = (a * TRAIL + s) * 2; index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    geo.setIndex(index);
    this.trail = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    this.trail.frustumCulled = false;
    scene.add(this.trail, this.mesh, this.glow);
  }
  update(w: World, time = performance.now() / 1000) {
    this.frame++;
    const count = Math.min(w.arrows.length, MAX);
    this.mesh.count = this.glow.count = count;
    this.trailPos.fill(0); this.trailCol.fill(0);
    for (let n = 0; n < count; n++) {
      const a = w.arrows[n], kind = a.kind ?? 'normal';
      const x = a.x, y = HEIGHT - a.y;
      let track = this.tracks.get(a.id);
      if (!track) { track = { points: [], stuckAt: -1, seen: 0 }; this.tracks.set(a.id, track); }
      track.seen = this.frame;
      if (a.stuck && track.stuckAt < 0) track.stuckAt = time;
      // Wobble for 0.2 s after sticking.
      const since = track.stuckAt < 0 ? 1 : time - track.stuckAt;
      const wobble = since < 0.2 ? Math.sin(since * 90) * (0.2 - since) * 1.4 : 0;
      this.dummy.position.set(x, y, Z); this.dummy.rotation.set(0, 0, -a.angle + wobble); this.dummy.scale.setScalar(1); this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
      const owner = w.fighters[a.owner]?.character;
      this.color.set(kind === 'normal' ? (owner === 1 ? 0x9ff6ff : 0xffffff) : COLORS[kind]); this.mesh.setColorAt(n, this.color);
      const flicker = kind === 'bomb' ? 0.7 + Math.sin(time * 40 + a.id) * 0.3 : 1;
      const glowSize = a.stuck ? (kind === 'normal' ? 0.0001 : 0.6) : kind === 'bolt' ? 1.9 : kind === 'bomb' ? 1.1 * flicker : owner === 1 ? 0.9 : 0.55;
      this.dummy.scale.setScalar(glowSize); this.dummy.updateMatrix(); this.glow.setMatrixAt(n, this.dummy.matrix);
      this.color.set(kind === 'normal' ? (owner === 1 ? 0x56e8ff : 0xffc878) : COLORS[kind]).multiplyScalar(kind === 'bolt' ? 1.6 : 1); this.glow.setColorAt(n, this.color);
      // Trail: ring of recent positions, reset on wrap jumps.
      const last = track.points[0];
      if (a.stuck) track.points.length = Math.max(0, track.points.length - 2);
      else if (!last || Math.hypot(last.x - x, last.y - y) > 0.04) {
        if (last && Math.hypot(last.x - x, last.y - y) > 4) track.points.length = 0;
        track.points.unshift(new THREE.Vector3(x, y, Z)); if (track.points.length > TRAIL) track.points.length = TRAIL;
      }
      this.writeTrail(n, track.points, kind, owner === 1);
    }
    for (const [id, t] of this.tracks) if (t.seen !== this.frame) this.tracks.delete(id);
    this.mesh.instanceMatrix.needsUpdate = this.glow.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.color.needsUpdate = true;
  }
  private writeTrail(slot: number, pts: THREE.Vector3[], kind: ArrowKind, storm: boolean) {
    if (pts.length < 2) return;
    this.color.set(kind === 'normal' ? (storm ? 0x5eeaff : 0xffe0b0) : COLORS[kind]);
    const width = kind === 'bolt' ? 0.16 : 0.07;
    for (let s = 0; s < TRAIL; s++) {
      const p = pts[Math.min(s, pts.length - 1)], q = pts[Math.min(s + 1, pts.length - 1)] ?? p;
      let dx = p.x - q.x, dy = p.y - q.y; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const k = 1 - s / (TRAIL - 1), half = width * k, alpha = (s < pts.length ? k : 0) * (kind === 'bolt' ? 0.9 : 0.55);
      const base = (slot * TRAIL + s) * 2;
      this.trailPos.set([p.x - dy * half, p.y + dx * half, Z - 0.01, p.x + dy * half, p.y - dx * half, Z - 0.01], base * 3);
      this.trailCol.set([this.color.r, this.color.g, this.color.b, alpha, this.color.r, this.color.g, this.color.b, alpha], base * 4);
    }
  }
}

