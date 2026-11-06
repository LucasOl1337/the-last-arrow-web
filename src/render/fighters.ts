import * as THREE from 'three';
import { CHARACTERS } from '../sim/world.ts';
import type { Fighter, World } from '../sim/world.ts';
import { delta, solid, WIDTH, HEIGHT } from '../sim/level.ts';
import { loadCharacterKits, instantiate } from './characters.ts';
import type { CharacterKits, ClipName, ModelKit } from './characters.ts';
import { patchCharacterMaterial, addOutline } from './characterMaterial.ts';
import type { CharacterUniforms } from './characterMaterial.ts';
import { ProceduralPuppet } from './puppet.ts';
import { blob, softDot } from './textures.ts';

/** Visual height of a fighter in tiles (hitbox is 0.64×1.10; the model is drawn taller on purpose). */
const VISUAL_HEIGHT = 1.7;
const HALF_H = 0.55;
const RUN_SPEED = 7.8;
/** Model-space speed of the run clip at timeScale 1 (root travel / duration ≈ 1.95 units/s). */
const RUN_CLIP_SPEED = 1.95;
const FADE = 0.12;
const GHOSTS = 3;
/** Each character has its own GLB; tint only applies when falling back to a sibling model. */
const LOOKS: { kit: keyof CharacterKits; fallback: keyof CharacterKits; tint: number; rim: number }[] = [
  { kit: 'mizu', fallback: 'kaze', tint: 0x3a5f9c, rim: 0x8fb8ff },
  { kit: 'storm', fallback: 'akane', tint: 0x9ed8ec, rim: 0x8ff4ff },
  { kit: 'kaze', fallback: 'mizu', tint: 0x4f9a52, rim: 0xb6f0a0 },
  { kit: 'akane', fallback: 'storm', tint: 0xc4413f, rim: 0xffa29a },
];
/** Clip windows (seconds). `hold` stops at `end`; `loop` wraps inside the window. */
const WINDOWS: Record<ClipName | 'death', { clip: ClipName; start: number; end: number; mode: 'loop' | 'hold' }> = {
  idle: { clip: 'idle', start: 0, end: 15.3, mode: 'loop' },
  run: { clip: 'run', start: 0, end: 1.25, mode: 'loop' },
  jump: { clip: 'jump', start: 0.12, end: 0.3, mode: 'hold' },
  // The fall clip turns the body toward the camera; the descending half of a jump keeps the profile.
  fall: { clip: 'jump', start: 0.3, end: 0.38, mode: 'hold' },
  // Shoot: crouch into the draw, then hold the drawn-string pose while charging.
  shoot: { clip: 'shoot', start: 1.05, end: 2.1, mode: 'hold' },
  victory: { clip: 'victory', start: 0, end: 5.6, mode: 'loop' },
  death: { clip: 'fall', start: 1.0, end: 2.3, mode: 'hold' },
};
type State = keyof typeof WINDOWS;

interface Rig {
  model: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<ClipName, THREE.AnimationAction>;
  uniforms: CharacterUniforms[]; outlines: THREE.Material[]; spine1?: THREE.Object3D; spine2?: THREE.Object3D; bowHand?: THREE.Object3D;
  ghosts: { model: THREE.Object3D; bones: THREE.Object3D[]; material: THREE.MeshBasicMaterial; life: number }[];
  bones: THREE.Object3D[];
}
interface View {
  root: THREE.Group; pivot: THREE.Group; character: number; rig: Rig | null; puppet: ProceduralPuppet | null;
  state: State; stateTime: number; yaw: number; aim: number; deathAt: number; ghostClock: number;
  wasGrounded: boolean; lastVy: number; releaseTime: number;
  shadow: THREE.Mesh; halo: THREE.Mesh; aimLine: THREE.Mesh; nock: THREE.Group;
}

const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpQ3 = new THREE.Quaternion(), axis = new THREE.Vector3();
const aimGeometry = new THREE.PlaneGeometry(1, 1); aimGeometry.translate(0.5, 0, 0);
const haloGeometry = new THREE.RingGeometry(0.62, 0.7, 32);
const shadowGeometry = new THREE.PlaneGeometry(1, 1); shadowGeometry.rotateX(-Math.PI / 2);

function nockedArrow(color: THREE.ColorRepresentation) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5), new THREE.MeshStandardMaterial({ color: 0xe8d3a2, roughness: 0.6 }));
  shaft.rotation.z = -Math.PI / 2; shaft.position.x = 0.12; g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: color, emissiveIntensity: 1.2 }));
  head.rotation.z = -Math.PI / 2; head.position.x = 0.48; g.add(head);
  const fletch = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  fletch.position.x = -0.15; g.add(fletch);
  return g;
}

export class FightersView {
  private views: View[] = [];
  private kits: CharacterKits | null = null;
  private world: World | null = null;
  /** Optional listener (fx) for landing dust and dash afterimages. */
  onLand: ((x: number, y: number, strength: number) => void) | null = null;
  loadError: unknown = null;
  constructor(private scene: THREE.Group) {
    loadCharacterKits().then(kits => { this.kits = kits; if (this.world) this.reset(this.world); })
      .catch(error => { this.loadError = error; console.warn('Personagens 3D indisponíveis; usando bonecos procedurais.', error); });
  }
  get usingModels() { return this.views.length > 0 && this.views.every(v => v.rig !== null); }
  reset(w: World) {
    this.world = w;
    for (const v of this.views) this.dispose(v);
    this.views = w.fighters.map(f => this.build(f));
  }
  private dispose(v: View) {
    this.scene.remove(v.root, v.shadow, v.aimLine, v.nock);
    v.puppet?.dispose();
    if (v.rig) {
      v.rig.mixer.stopAllAction(); v.rig.mixer.uncacheRoot(v.rig.model);
      // Skinned geometry is shared with the cached template: only materials are per fighter.
      v.rig.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); });
      for (const g of v.rig.ghosts) { this.scene.remove(g.model); g.material.dispose(); }
    }
    for (const mesh of [v.shadow, v.halo, v.aimLine]) (mesh.material as THREE.Material).dispose();
    v.nock.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }
  private buildRig(kit: ModelKit, character: number, pivot: THREE.Group, tinted: boolean): Rig {
    const look = LOOKS[character];
    const model = instantiate(kit);
    const scale = VISUAL_HEIGHT / kit.height; model.scale.setScalar(scale);
    const uniforms: CharacterUniforms[] = [];
    const skinned: THREE.SkinnedMesh[] = [];
    model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isMesh) { uniforms.push(patchCharacterMaterial(m.material as THREE.MeshStandardMaterial, look.rim, tinted ? look.tint : undefined)); if (m.isSkinnedMesh) skinned.push(m); } });
    const outlineColor = new THREE.Color(CHARACTERS[character].color).multiplyScalar(0.08);
    const outlines = skinned.map(m => addOutline(m, outlineColor, 0.008).material);
    pivot.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries((Object.keys(kit.clips) as ClipName[]).map(name => [name, mixer.clipAction(kit.clips[name])])) as Record<ClipName, THREE.AnimationAction>;
    const bones: THREE.Object3D[] = []; model.traverse(o => { if ((o as THREE.Bone).isBone) bones.push(o); });
    const ghosts = Array.from({ length: GHOSTS }, () => {
      const ghost = instantiate(kit); ghost.scale.setScalar(scale);
      const material = new THREE.MeshBasicMaterial({ color: CHARACTERS[character].color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { (m.material as THREE.Material).dispose(); m.material = material; m.castShadow = false; } });
      ghost.visible = false; ghost.matrixAutoUpdate = true;
      const gb: THREE.Object3D[] = []; ghost.traverse(o => { if ((o as THREE.Bone).isBone) gb.push(o); });
      return { model: ghost, bones: gb, material, life: 0 };
    });
    return { model, mixer, actions, uniforms, ghosts, bones, outlines,
      spine1: model.getObjectByName('mixamorigSpine1'), spine2: model.getObjectByName('mixamorigSpine2'), bowHand: model.getObjectByName('mixamorigLeftHand') };
  }
  private build(f: Fighter): View {
    const color = CHARACTERS[f.character].color;
    const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot); this.scene.add(root);
    let rig: Rig | null = null, puppet: ProceduralPuppet | null = null;
    const look = LOOKS[f.character], own = this.kits?.[look.kit], kit = own ?? this.kits?.[look.fallback];
    if (kit) {
      try { rig = this.buildRig(kit, f.character, pivot, !own); rig.ghosts.forEach(g => this.scene.add(g.model)); }
      catch (error) { console.warn('Falha ao montar personagem 3D', error); rig = null; }
    }
    if (!rig) { puppet = new ProceduralPuppet(f.character); pivot.add(puppet.root); }
    const shadow = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, opacity: 0.8 }));
    shadow.renderOrder = 1; this.scene.add(shadow);
    const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(0, VISUAL_HEIGHT * 0.45, 0.5); root.add(halo);
    const aimLine = new THREE.Mesh(aimGeometry, new THREE.MeshBasicMaterial({ color, map: softDot(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    aimLine.renderOrder = 3; this.scene.add(aimLine);
    const nock = nockedArrow(color); nock.visible = false; this.scene.add(nock);
    const view: View = { root, pivot, character: f.character, rig, puppet, state: 'idle', stateTime: 0, yaw: f.facing > 0 ? -0.35 : -Math.PI + 0.35,
      aim: 0, deathAt: -1, ghostClock: 0, wasGrounded: true, lastVy: 0, releaseTime: 0, shadow, halo, aimLine, nock };
    if (rig) this.play(view, 'idle', 0);
    return view;
  }
  private play(v: View, state: State, fade = FADE) {
    if (!v.rig) return;
    const win = WINDOWS[state], next = v.rig.actions[win.clip];
    const prevClip = WINDOWS[v.state].clip;
    v.state = state; v.stateTime = 0;
    if (next.isRunning() && prevClip === win.clip) { next.time = win.start; return; }
    next.reset(); next.time = win.start; next.setEffectiveWeight(1); next.setEffectiveTimeScale(1); next.play();
    const prev = v.rig.actions[prevClip];
    if (fade > 0 && prev !== next && prev.isRunning()) next.crossFadeFrom(prev, fade, false);
    else for (const a of Object.values(v.rig.actions)) if (a !== next) a.stop();
  }
  private choose(v: View, f: Fighter, w: World): State {
    if (!f.alive) return 'death';
    if ((w.phase === 'roundover' || w.phase === 'matchover') && w.winner === f.id) return 'victory';
    if (f.charging || v.releaseTime > 0) return 'shoot';
    if (!f.grounded) return f.vy < 0 ? 'jump' : 'fall';
    return Math.abs(f.vx) > 0.6 ? 'run' : 'idle';
  }
  /** Fixed-step events (called from the sim loop) that affect poses. */
  event(type: string, actor: number) {
    const v = this.views[actor]; if (!v) return;
    if (type === 'shoot') v.releaseTime = 0.16;
    if (type === 'dash') v.ghostClock = 0;
  }
  update(w: World, alpha: number, time: number, dt = 1 / 60) {
    w.fighters.forEach((f, id) => {
      const v = this.views[id]; if (!v) return;
      if (f.alive) v.deathAt = -1; else if (v.deathAt < 0) v.deathAt = time;
      const dying = f.alive ? 0 : time - v.deathAt;
      const x = f.prevX + delta(f.prevX, f.x, WIDTH) * alpha;
      const y = f.prevY + delta(f.prevY, f.y, HEIGHT) * alpha;
      const feet = HEIGHT - (y + HALF_H);
      v.root.position.set(x, feet, 0.55);
      v.releaseTime = Math.max(0, v.releaseTime - dt);
      // Facing: +X at yaw≈0, turning through the camera so the face shows during the turn.
      const face = f.charging && f.aimX !== 0 ? Math.sign(f.aimX) : f.facing;
      const targetYaw = face > 0 ? -0.35 : -Math.PI + 0.35;
      v.yaw += (targetYaw - v.yaw) * Math.min(1, dt * 24);
      v.pivot.rotation.y = v.yaw;
      // Landing dust.
      if (f.alive && f.grounded && !v.wasGrounded && v.lastVy > 6) this.onLand?.(x, y + HALF_H, Math.min(1, v.lastVy / 19));
      v.wasGrounded = f.grounded; v.lastVy = f.vy;
      const visible = f.alive || dying < 0.9;
      v.root.visible = visible;
      if (v.rig) this.animateRig(v, f, w, dt, dying);
      else if (v.puppet) {
        v.puppet.update(f, time, id);
        v.root.scale.setScalar(f.alive ? 1 : Math.max(0.05, 1 - dying * 1.6));
        v.root.rotation.z = f.alive ? 0 : -dying * face * 3;
      }
      // Spawn/dash protection halo.
      v.halo.visible = f.alive && f.invulnerable > 0;
      if (v.halo.visible) { (v.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(time * 18) * 0.2; v.halo.rotation.z = time * 2; }
      this.updateAim(v, f, x, feet, time);
      this.updateShadow(v, w, x, y, visible ? (f.alive ? 1 : Math.max(0, 1 - dying * 1.4)) : 0);
    });
  }
  private animateRig(v: View, f: Fighter, w: World, dt: number, dying: number) {
    const rig = v.rig!;
    const want = this.choose(v, f, w);
    if (want !== v.state) this.play(v, want, want === 'death' ? 0.08 : FADE);
    v.stateTime += dt;
    const win = WINDOWS[v.state], action = rig.actions[win.clip];
    let speed = 1;
    if (v.state === 'run') speed = THREE.MathUtils.clamp(Math.abs(f.vx) / (RUN_CLIP_SPEED * VISUAL_HEIGHT / 0.98), 0.6, 2.4);
    if (v.state === 'death') speed = 1.8;
    if (v.state === 'shoot' && !f.charging && v.releaseTime > 0) speed = 0; // release snap: hold the draw pose briefly
    action.setEffectiveTimeScale(speed);
    rig.mixer.update(dt);
    if (action.time >= win.end) {
      if (win.mode === 'loop') action.time = win.start + (action.time - win.end) % (win.end - win.start);
      else { action.time = win.end; action.setEffectiveTimeScale(0); }
    }
    // Aim offset: pitch the spine around the facing plane normal so the bow follows 8-way aim.
    const aimTarget = f.alive && (f.charging || v.releaseTime > 0) ? Math.atan2(-f.aimY, Math.abs(f.aimX)) : 0;
    v.aim += (THREE.MathUtils.clamp(aimTarget, -1.1, 1.1) - v.aim) * Math.min(1, dt * 18);
    if (Math.abs(v.aim) > 0.001) {
      v.pivot.updateWorldMatrix(true, false);
      v.pivot.getWorldQuaternion(tmpQ); axis.set(0, 0, 1).applyQuaternion(tmpQ);
      for (const bone of [rig.spine1, rig.spine2]) {
        if (!bone?.parent) continue;
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldQuaternion(tmpQ2);
        // local' = P^-1 · R · P · local, with R a world-space pitch about the facing-plane normal.
        tmpQ3.setFromAxisAngle(axis, v.aim * 0.5).multiply(tmpQ2);
        bone.quaternion.premultiply(tmpQ2.invert().multiply(tmpQ3));
      }
    }
    // Death: dissolve to the character colour + fake ragdoll topple.
    const dissolve = f.alive ? 0 : THREE.MathUtils.clamp((dying - 0.18) / 0.6, 0, 1);
    v.root.rotation.z = f.alive ? 0 : -Math.min(dying * 2.2, 0.9) * (f.facing > 0 ? 1 : -1);
    const flash = f.alive ? 0 : Math.max(0, 1 - dying * 9);
    const protect = f.alive && f.invulnerable > 0 ? 0.35 + Math.sin(performance.now() * 0.02) * 0.25 : 0;
    for (const u of rig.uniforms) { u.uDissolve.value = dissolve; u.uFlash.value = flash; u.uRimStrength.value = 0.32 + protect; }
    for (const m of rig.outlines) m.visible = f.alive;
    // Dash afterimages: snapshot the pose into a pooled ghost every 30 ms while dashing.
    v.ghostClock -= dt;
    if (f.alive && f.dashTime > 0 && v.ghostClock <= 0) {
      v.ghostClock = 0.03;
      const ghost = rig.ghosts.reduce((a, b) => (a.life <= b.life ? a : b));
      v.root.updateWorldMatrix(true, true);
      rig.model.getWorldPosition(tmpV); ghost.model.position.copy(tmpV);
      rig.model.getWorldQuaternion(ghost.model.quaternion);
      for (let n = 0; n < ghost.bones.length && n < rig.bones.length; n++) {
        ghost.bones[n].position.copy(rig.bones[n].position); ghost.bones[n].quaternion.copy(rig.bones[n].quaternion);
      }
      ghost.life = 0.22; ghost.model.visible = true;
    }
    for (const g of rig.ghosts) {
      if (g.life <= 0) continue;
      g.life -= dt; g.material.opacity = Math.max(0, g.life / 0.22) * 0.45;
      if (g.life <= 0) g.model.visible = false;
    }
  }
  private updateAim(v: View, f: Fighter, x: number, feet: number, time: number) {
    const charging = f.alive && f.charging;
    v.nock.visible = charging;
    const line = v.aimLine.material as THREE.MeshBasicMaterial;
    if (!charging) { line.opacity = Math.max(0, line.opacity - 0.15); v.aimLine.visible = line.opacity > 0.01; return; }
    const angle = Math.atan2(-f.aimY, f.aimX);
    // Bow hand if the rig has it; otherwise chest height.
    if (v.rig?.bowHand) { v.rig.bowHand.getWorldPosition(tmpV); }
    else tmpV.set(x + Math.sign(f.aimX || f.facing) * 0.35, feet + VISUAL_HEIGHT * 0.55, 0.6);
    const pull = Math.min(1, f.charge / 0.35);
    v.nock.position.set(tmpV.x - f.aimX * 0.12 * pull, tmpV.y + f.aimY * 0.12 * pull, 0.75);
    v.nock.rotation.set(0, 0, angle);
    const length = 1.2 + pull * 1.6;
    v.aimLine.visible = true; v.aimLine.position.set(tmpV.x, tmpV.y, 0.74); v.aimLine.rotation.set(0, 0, angle);
    v.aimLine.scale.set(length, 0.09 + Math.sin(time * 30) * 0.01, 1);
    line.opacity = 0.35 + pull * 0.4;
  }
  private updateShadow(v: View, w: World, x: number, y: number, strength: number) {
    // Project down to the first solid tile under the feet (wrap-aware, up to 8 tiles).
    let ground = -1;
    for (let d = 0; d < 8; d++) { const ty = Math.floor(y + HALF_H + 0.02) + d; if (solid(w.level, x, ty)) { ground = ty; break; } }
    if (ground < 0 || strength <= 0) { v.shadow.visible = false; return; }
    const height = ground - (y + HALF_H);
    const k = Math.max(0, 1 - height / 6);
    v.shadow.visible = true;
    v.shadow.position.set(x, HEIGHT - ground + 0.02, 0.45);
    v.shadow.scale.set(1.1 * (0.5 + 0.5 * k), 1, 0.7 * (0.5 + 0.5 * k));
    (v.shadow.material as THREE.MeshBasicMaterial).opacity = 0.75 * k * strength;
  }
}
