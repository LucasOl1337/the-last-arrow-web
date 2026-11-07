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
import { themeForLevel } from './themes.ts';
import { clipWindow, runTimeScale } from './animation.ts';
import { disposeSkeletons } from './disposal.ts';
import { aimGuide } from './aim-guide.ts';

/** Visual height of a fighter in tiles (hitbox is 0.64×1.10; feet stay on the hitbox base, the body grows up). */
export const VISUAL_HEIGHT = 2.4;
const VISUAL_WIDTH = 1.18;
import { HALF_H, bodyHalfHeight } from '../sim/body.ts';
const FADE = 0.12;
const GHOSTS = 3;
/** Each character has its own GLB; tint only applies when falling back to a sibling model. */
/** Rim light is the character's identity colour (Mizu blue, Storm cyan, Kaze green, Akane red). */
const LOOKS: { kit: keyof CharacterKits; fallback: keyof CharacterKits; tint: number; rim: number }[] = [
  { kit: 'mizu', fallback: 'kaze', tint: 0x3a5f9c, rim: 0x4f8dff },
  { kit: 'storm', fallback: 'akane', tint: 0x9ed8ec, rim: 0x2ef2ff },
  { kit: 'kaze', fallback: 'mizu', tint: 0x4f9a52, rim: 0x55ff6a },
  { kit: 'akane', fallback: 'storm', tint: 0xc4413f, rim: 0xff3b30 },
];
const RIM_STRENGTH = 0.24;
/** Small albedo lift only; the silhouette outline already separates fighters from scenery. */
const SELF_LIGHT: Record<string, number> = { moss: 0.12, totem: 0.16, canopy: 0.14 };
const AIM_DOTS = 5;
/** Clip windows (seconds). `hold` stops at `end`; `loop` wraps inside the window. */
const WINDOWS: Record<ClipName | 'land' | 'death', { clip: ClipName; start: number; end: number; mode: 'loop' | 'hold' }> = {
  idle: { clip: 'idle', start: 0, end: 15.3, mode: 'loop' },
  run: { clip: 'run', start: 0, end: 1.25, mode: 'loop' },
  jump: { clip: 'jump', start: 0.12, end: 0.3, mode: 'hold' },
  // The fall clip turns the body toward the camera; the descending half of a jump keeps the profile.
  fall: { clip: 'jump', start: 0.3, end: 0.38, mode: 'hold' },
  land: { clip: 'jump', start: 0.38, end: 0.52, mode: 'hold' },
  // `fire` keeps a standing bow stance; hold the drawn string, then play its short release.
  shoot: { clip: 'shoot', start: 0.02, end: 0.2, mode: 'hold' },
  victory: { clip: 'victory', start: 0, end: 5.6, mode: 'loop' },
  death: { clip: 'fall', start: 1.0, end: 2.3, mode: 'hold' },
};
type State = keyof typeof WINDOWS;

interface Rig {
  model: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<State, THREE.AnimationAction>;
  uniforms: CharacterUniforms[]; outlines: THREE.Material[]; spine1?: THREE.Object3D; spine2?: THREE.Object3D; bowHand?: THREE.Object3D;
  ghosts: { model: THREE.Object3D; bones: THREE.Object3D[]; material: THREE.MeshBasicMaterial; life: number }[];
  bones: THREE.Object3D[]; runSpeed: number;
  aimLegs: Record<'idle' | 'run' | 'jump' | 'fall', THREE.AnimationAction>;
  pitchBase: Map<THREE.Object3D, THREE.Quaternion>;
}
interface View {
  root: THREE.Group; pivot: THREE.Group; character: number; rig: Rig | null; puppet: ProceduralPuppet | null;
  state: State; stateTime: number; yaw: number; aim: number; deathAt: number; ghostClock: number;
  wasGrounded: boolean; lastVy: number; releaseTime: number; landingTime: number;
  shadow: THREE.Mesh; halo: THREE.Mesh; backdrop: THREE.Sprite; aimDots: THREE.Mesh[]; aimPoint: THREE.Mesh; aimFade: number; nock: THREE.Group;
}

const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpQ3 = new THREE.Quaternion(), axis = new THREE.Vector3();
const dotGeometry = new THREE.PlaneGeometry(1, 1);
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
  private selfLight = SELF_LIGHT.moss;
  constructor(private scene: THREE.Group, onFallback: () => void = () => {}) {
    loadCharacterKits().then(kits => {
      this.kits = kits;
      if (Object.values(kits).some(kit => !kit)) onFallback();
      if (this.world) this.reset(this.world);
    }).catch(error => { this.loadError = error; onFallback(); console.warn('Personagens 3D indisponíveis; usando bonecos procedurais.', error); });
  }
  get usingModels() { return this.views.length > 0 && this.views.every(v => v.rig !== null); }
  /** Read-only visual probes for the bench: validate the actual skinned hand, not just the intended yaw. */
  inspect() {
    return this.views.map(v => {
      v.root.updateWorldMatrix(true, true);
      const hand = v.rig?.bowHand?.getWorldPosition(new THREE.Vector3());
      const shoulder = v.rig?.model.getObjectByName('mixamorigLeftShoulder')?.getWorldPosition(new THREE.Vector3());
      const action = v.rig?.actions[v.state];
      const head = v.rig?.model.getObjectByName('mixamorigHead')?.getWorldPosition(new THREE.Vector3());
      return { state: v.state, yaw: v.yaw, feet: v.root.position.toArray(),
        headHeight: head ? head.y - v.root.position.y : null,
        animationTime: action?.time, animationSpeed: action?.getEffectiveTimeScale(),
        strideSpeed: v.rig ? v.rig.runSpeed * v.rig.model.scale.x : null,
        landingTime: v.landingTime,
        weights: v.rig ? Object.fromEntries(Object.entries(v.rig.actions).map(([name, a]) => [name, a.getEffectiveWeight()])) : {},
        toes: ['mixamorigLeftToeBase', 'mixamorigRightToeBase'].map(name => {
          const p = v.rig?.model.getObjectByName(name)?.getWorldPosition(new THREE.Vector3());
          return p ? p.y - v.root.position.y : null;
        }),
        bowDirection: hand && shoulder ? hand.sub(shoulder).toArray() : null,
        nock: v.nock.visible ? v.nock.position.toArray() : null };
    });
  }
  reset(w: World) {
    this.world = w; this.selfLight = SELF_LIGHT[themeForLevel(w.level).id] ?? SELF_LIGHT.moss;
    for (const v of this.views) this.dispose(v);
    this.views = w.fighters.map(f => this.build(f));
  }
  private dispose(v: View) {
    this.scene.remove(v.root, v.shadow, v.nock, v.aimPoint, ...v.aimDots);
    v.puppet?.dispose();
    if (v.rig) {
      v.rig.mixer.stopAllAction(); v.rig.mixer.uncacheRoot(v.rig.model);
      disposeSkeletons(v.rig.model);
      // Skinned geometry is shared with the cached template: only materials are per fighter.
      v.rig.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); });
      for (const g of v.rig.ghosts) { this.scene.remove(g.model); disposeSkeletons(g.model); g.material.dispose(); }
    }
    for (const mesh of [v.shadow, v.halo, v.backdrop, v.aimPoint, ...v.aimDots]) (mesh.material as THREE.Material).dispose();
    v.nock.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }
  private buildRig(kit: ModelKit, character: number, pivot: THREE.Group, tinted: boolean): Rig {
    const look = LOOKS[character];
    const model = instantiate(kit);
    const scale = VISUAL_HEIGHT / kit.height;
    model.scale.set(scale * VISUAL_WIDTH, scale, scale * VISUAL_WIDTH);
    model.position.y = -kit.floor * scale;
    const uniforms: CharacterUniforms[] = [];
    const skinned: THREE.SkinnedMesh[] = [];
    model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isMesh) {
      const u = patchCharacterMaterial(m.material as THREE.MeshStandardMaterial, look.rim, tinted ? look.tint : undefined);
      u.uSelf.value = this.selfLight; uniforms.push(u); if (m.isSkinnedMesh) skinned.push(m);
    } });
    // Constant CSS-pixel silhouette, independent of model units and viewport size.
    const outlineColor = new THREE.Color(CHARACTERS[character].color);
    const outlines = skinned.map(m => addOutline(m, outlineColor, 2.25).material);
    pivot.add(model);
    const mixer = new THREE.AnimationMixer(model);
    // A separate action for each state is essential: crossfading jump → fall must not seek jump in place.
    const actions = Object.fromEntries((Object.keys(WINDOWS) as State[]).map(name => {
      const win = WINDOWS[name];
      const clip = clipWindow(kit.clips[win.clip], name, win.start, name === 'shoot' ? 0.65 : win.end);
      // A drawn bow owns the upper body only. Feet still follow idle/run/airborne locomotion.
      if (name === 'shoot') clip.tracks = clip.tracks.filter(t => !/mixamorig(Hips|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot|LeftToe|RightToe)/.test(t.name));
      const action = mixer.clipAction(clip);
      if (win.mode === 'hold') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      return [name, action];
    })) as Record<State, THREE.AnimationAction>;
    const aimLegs = Object.fromEntries((['idle', 'run', 'jump', 'fall'] as const).map(name => {
      const win = WINDOWS[name], clip = clipWindow(kit.clips[win.clip], `aim-legs-${name}`, win.start, win.end);
      clip.tracks = clip.tracks.filter(t => /mixamorig(Hips|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot|LeftToe|RightToe)/.test(t.name));
      const action = mixer.clipAction(clip);
      if (win.mode === 'hold') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      return [name, action];
    })) as Rig['aimLegs'];
    const bones: THREE.Object3D[] = []; model.traverse(o => { if ((o as THREE.Bone).isBone) bones.push(o); });
    const ghosts = Array.from({ length: GHOSTS }, () => {
      const ghost = instantiate(kit); ghost.scale.copy(model.scale);
      const material = new THREE.MeshBasicMaterial({ color: CHARACTERS[character].color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { (m.material as THREE.Material).dispose(); m.material = material; m.castShadow = false; } });
      ghost.visible = false; ghost.matrixAutoUpdate = true;
      const gb: THREE.Object3D[] = []; ghost.traverse(o => { if ((o as THREE.Bone).isBone) gb.push(o); });
      return { model: ghost, bones: gb, material, life: 0 };
    });
    return { model, mixer, actions, uniforms, ghosts, bones, outlines, aimLegs, pitchBase: new Map(), runSpeed: kit.runSpeed,
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
    if (!rig) {
      puppet = new ProceduralPuppet(f.character);
      const height = new THREE.Box3().setFromObject(puppet.root).getSize(tmpV).y;
      puppet.root.scale.multiplyScalar(VISUAL_HEIGHT / height);
      pivot.add(puppet.root);
    }
    const shadow = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, opacity: 0.8 }));
    shadow.renderOrder = 1; this.scene.add(shadow);
    const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(0, VISUAL_HEIGHT * 0.45, 0.5); root.add(halo);
    // Local dark separation over bright painted scenery; depth-tested behind the body/terrain.
    const backdrop = new THREE.Sprite(new THREE.SpriteMaterial({ map: blob(), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    backdrop.position.set(0, VISUAL_HEIGHT * 0.5, -0.75);
    backdrop.scale.set(2.1, VISUAL_HEIGHT * 1.5, 1); root.add(backdrop);
    // Short dotted trajectory (same speed/gravity as the sim) shown only while charging.
    const aimDots = Array.from({ length: AIM_DOTS }, () => {
      const dot = new THREE.Mesh(dotGeometry, new THREE.MeshBasicMaterial({ color, map: softDot(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      dot.renderOrder = 3; dot.visible = false; this.scene.add(dot); return dot;
    });
    const aimPoint = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color: 0xf5edcf, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    aimPoint.scale.setScalar(.28); aimPoint.visible = false; aimPoint.renderOrder = 4; this.scene.add(aimPoint);
    const nock = nockedArrow(color); nock.visible = false; this.scene.add(nock);
    const view: View = { root, pivot, character: f.character, rig, puppet, state: 'idle', stateTime: 0, yaw: f.facing > 0 ? -0.35 : -Math.PI + 0.35,
      aim: 0, deathAt: -1, ghostClock: 0, wasGrounded: true, lastVy: 0, releaseTime: 0, landingTime: 0, shadow, halo, backdrop, aimDots, aimPoint, aimFade: 0, nock };
    if (rig) this.play(view, 'idle', 0);
    return view;
  }
  private play(v: View, state: State, fade = FADE) {
    if (!v.rig) return;
    const next = v.rig.actions[state], prev = v.rig.actions[v.state];
    v.state = state; v.stateTime = 0;
    next.reset(); next.setEffectiveWeight(1); next.setEffectiveTimeScale(1); next.play();
    // A clamped/paused pose still has weight and must fade out, too.
    if (fade > 0 && prev !== next && prev.isScheduled()) next.crossFadeFrom(prev, fade, false);
    else for (const a of Object.values(v.rig.actions)) if (a !== next) a.stop();
  }
  private choose(v: View, f: Fighter, w: World): State {
    if (!f.alive) return 'death';
    if ((w.phase === 'roundover' || w.phase === 'matchover') && w.winner === f.id) return 'victory';
    if (f.charging || v.releaseTime > 0) return 'shoot';
    if (!f.grounded) return f.vy < 0 ? 'jump' : 'fall';
    if (Math.abs(f.vx) > 0.6) return 'run';
    return v.landingTime > 0 ? 'land' : 'idle';
  }
  /** Fixed-step events (called from the sim loop) that affect poses. */
  event(type: string, actor: number) {
    const v = this.views[actor]; if (!v) return;
    if (type === 'shoot') {
      v.releaseTime = 0.18;
      if (v.rig && v.state === 'shoot') { v.rig.actions.shoot.paused = false; v.rig.actions.shoot.time = 0.18; }
    }
    if (type === 'dash') v.ghostClock = 0;
  }
  update(w: World, alpha: number, time: number, dt = 1 / 60) {
    w.fighters.forEach((f, id) => {
      const v = this.views[id]; if (!v) return;
      if (f.alive) v.deathAt = -1; else if (v.deathAt < 0) v.deathAt = time;
      const dying = f.alive ? 0 : time - v.deathAt;
      const x = f.prevX + delta(f.prevX, f.x, WIDTH) * alpha;
      const y = f.prevY + delta(f.prevY, f.y, HEIGHT) * alpha;
      const feet = HEIGHT - (y + bodyHalfHeight(f));
      v.root.position.set(x, feet, 0.55);
      v.releaseTime = Math.max(0, v.releaseTime - dt);
      const aiming = f.charging || v.releaseTime > 0;
      const face = aiming && f.aimX !== 0 ? Math.sign(f.aimX) : f.facing;
      // Standing `fire` and locomotion both face +X: no quarter-turn at every draw.
      const targetYaw = face > 0 ? -0.35 : -Math.PI + 0.35;
      const turn = Math.atan2(Math.sin(targetYaw - v.yaw), Math.cos(targetYaw - v.yaw));
      v.yaw += turn * Math.min(1, dt * 24);
      v.pivot.rotation.y = v.yaw;
      // Landing recovery is visual only; it never delays input or changes collision.
      v.landingTime = Math.max(0, v.landingTime - dt);
      if (f.alive && f.grounded && !v.wasGrounded) {
        v.landingTime = 0.14;
        if (v.lastVy > 6) this.onLand?.(x, y + bodyHalfHeight(f), Math.min(1, v.lastVy / 19));
      }
      if (!f.grounded) v.landingTime = 0;
      v.wasGrounded = f.grounded; v.lastVy = f.vy;
      v.pivot.scale.y = (f.crouching?.58:1) * (1 - 0.055 * Math.sin(Math.PI * v.landingTime / 0.14));
      const visible = f.alive || dying < 0.9;
      v.root.visible = visible;
      v.backdrop.material.opacity = f.alive ? 0.95 : Math.max(0, 0.95 - dying * 1.5);
      if (v.rig) this.animateRig(v, f, w, dt, dying);
      else if (v.puppet) {
        v.puppet.update(f, time, id);
        v.root.scale.setScalar(f.alive ? 1 : Math.max(0.05, 1 - dying * 1.6));
        v.root.rotation.z = f.alive ? 0 : -dying * face * 3;
      }
      // Spawn/dash protection halo.
      v.halo.visible = f.alive && f.invulnerable > 0;
      if (v.halo.visible) { (v.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(time * 18) * 0.2; v.halo.rotation.z = time * 2; }
      this.updateAim(v, f, w, x, y, feet, dt);
      this.updateShadow(v, w, x, y+bodyHalfHeight(f)-HALF_H, visible ? (f.alive ? 1 : Math.max(0, 1 - dying * 1.4)) : 0);
    });
  }
  private animateRig(v: View, f: Fighter, w: World, dt: number, dying: number) {
    const rig = v.rig!;
    const want = this.choose(v, f, w);
    if (want !== v.state) this.play(v, want, want === 'death' || want === 'land' ? 0.08 : FADE);
    v.stateTime += dt;
    const win = WINDOWS[v.state], action = rig.actions[v.state];
    let speed = 1;
    if (v.state === 'run') speed = runTimeScale(f.vx, rig.runSpeed, rig.model.scale.x);
    if (v.state === 'death') speed = 1.8;
    const releasing = v.state === 'shoot' && !f.charging && v.releaseTime > 0;
    if (releasing) speed = 2;
    // Clamp before mixer evaluation, not a frame after sampling beyond the window.
    if (v.state === 'shoot' && !releasing) {
      action.time = Math.min(action.time + dt, win.end - win.start);
      speed = 0;
    }
    action.setEffectiveTimeScale(speed);
    // Undo last frame's procedural pitch even when a paused/untracked spine is not rewritten by the mixer.
    for (const [bone, rotation] of rig.pitchBase) bone.quaternion.copy(rotation);
    const legsState = !f.grounded ? (f.vy < 0 ? 'jump' : 'fall') : Math.abs(f.vx) > .6 ? 'run' : 'idle';
    for (const [name, legs] of Object.entries(rig.aimLegs)) {
      if (v.state !== 'shoot' || name !== legsState) { legs.stop(); continue; }
      if (!legs.isScheduled()) legs.reset().play();
      legs.setEffectiveWeight(1);
      legs.setEffectiveTimeScale(name === 'run' ? runTimeScale(f.vx, rig.runSpeed, rig.model.scale.x) : 1);
    }
    rig.mixer.update(dt);
    for (const bone of [rig.spine1, rig.spine2]) if (bone) {
      const rotation = rig.pitchBase.get(bone) ?? new THREE.Quaternion();
      bone.quaternion.normalize(); rotation.copy(bone.quaternion); rig.pitchBase.set(bone, rotation);
    }
    // Aim offset: pitch the spine around the facing plane normal so the bow follows 8-way aim.
    const aimTarget = f.alive && (f.charging || v.releaseTime > 0) ? Math.atan2(-f.aimY, Math.abs(f.aimX)) : 0;
    v.aim += (THREE.MathUtils.clamp(aimTarget, -1.1, 1.1) - v.aim) * Math.min(1, dt * 18);
    if (Math.abs(v.aim) > 0.001) {
      v.pivot.updateWorldMatrix(true, false);
      // Pitch in the arena's XY plane, independent of the model's three-quarter yaw.
      axis.set(0, 0, Math.sign(f.aimX || f.facing));
      for (const bone of [rig.spine1, rig.spine2]) {
        if (!bone?.parent) continue;
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldQuaternion(tmpQ2);
        // local' = P^-1 · R · P · local, with R a world-space pitch about the facing-plane normal.
        tmpQ3.setFromAxisAngle(axis, v.aim * 0.5).multiply(tmpQ2);
        bone.quaternion.premultiply(tmpQ2.invert().multiply(tmpQ3)).normalize();
      }
    }
    // Death: dissolve to the character colour + fake ragdoll topple.
    const dissolve = f.alive ? 0 : THREE.MathUtils.clamp((dying - 0.18) / 0.6, 0, 1);
    v.root.rotation.z = f.alive ? 0 : -Math.min(dying * 2.2, 0.9) * (f.facing > 0 ? 1 : -1);
    const flash = f.alive ? 0 : Math.max(0, 1 - dying * 9);
    const protect = f.alive && f.invulnerable > 0 ? 0.08 + Math.sin(performance.now() * 0.02) * 0.04 : 0;
    for (const u of rig.uniforms) { u.uDissolve.value = dissolve; u.uFlash.value = flash; u.uRimStrength.value = RIM_STRENGTH + protect; }
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
  private updateAim(v: View, f: Fighter, w: World, x: number, y: number, feet: number, dt: number) {
    const charging = f.alive && f.charging;
    v.nock.visible = charging;
    v.aimFade = charging ? Math.min(1, v.aimFade + dt * 18) : Math.max(0, v.aimFade - dt * 14);
    v.aimPoint.visible = charging;
    if (!charging) { for (const d of v.aimDots) d.visible = false; return; }
    const angle = Math.atan2(-f.aimY, f.aimX), pull = Math.min(1, f.charge / 0.35);
    // Nock on the bow hand; the arc starts at the arrow tip and follows the arrow's real speed and gravity.
    if (v.rig?.bowHand) v.rig.bowHand.getWorldPosition(tmpV);
    else tmpV.set(x + Math.sign(f.aimX || f.facing) * 0.35, feet + VISUAL_HEIGHT * 0.5, 0.6);
    const dx = f.aimX, dy = -f.aimY;
    v.nock.position.set(tmpV.x - dx * 0.14 * pull, tmpV.y - dy * 0.14 * pull, 0.78);
    v.nock.rotation.set(0, 0, angle);
    // Start at the simulated projectile origin, not the decorative (taller) bow hand.
    const guide = aimGuide(w.level, x, y, f.aimX, f.aimY, f.inventory?.[0] === 'bolt');
    v.aimDots.forEach((dot, k) => {
      const point = guide.points[k]; dot.visible = !!point;
      if (!point) return;
      dot.position.set(point.x, HEIGHT - point.y, .8);
      const size = .13 - k * .01; dot.scale.set(size, size, 1);
      (dot.material as THREE.MeshBasicMaterial).opacity = .9 * v.aimFade;
    });
    v.aimPoint.position.set(guide.end.x, HEIGHT - guide.end.y, .82);
    (v.aimPoint.material as THREE.MeshBasicMaterial).color.set(guide.blocked ? 0xffc27a : 0xf5edcf);
    (v.aimPoint.material as THREE.MeshBasicMaterial).opacity = .95 * v.aimFade;
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
