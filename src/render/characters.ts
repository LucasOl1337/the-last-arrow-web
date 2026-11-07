import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { asset } from '../paths.ts';
import { rootSpeed } from './animation.ts';
import { bindStormOrnament } from './storm-ornament.ts';

/** Clip names used by the renderer. Each model gets every one (Storm has no victory: idle stands in). */
export type ClipName = 'idle' | 'run' | 'jump' | 'shoot' | 'fall' | 'victory';
export interface ModelKit { template: THREE.Object3D; clips: Record<ClipName, THREE.AnimationClip>; height: number; floor: number; runSpeed: number; sourceSha256?: string }
/** One kit per character id; null when that model failed (renderer picks a fallback). */
export type CharacterKits = Record<'mizu' | 'storm' | 'kaze' | 'akane', ModelKit | null>;

const HIPS = 'mixamorigHips';

/**
 * Remove root motion: Hips keeps its Y (crouch/bob) but X/Z are pinned to the rest pose,
 * otherwise run/shoot clips walk the mesh away from the simulated position.
 */
function pinRoot(clip: THREE.AnimationClip, rest: THREE.Vector3, name: string): THREE.AnimationClip {
  const tracks = clip.tracks.map(track => {
    if (track.name !== `${HIPS}.position`) return track;
    const values = track.values.slice();
    for (let i = 0; i < values.length; i += 3) { values[i] = rest.x; values[i + 2] = rest.z; }
    return new THREE.VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
  });
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

function prepareTemplate(scene: THREE.Object3D) {
  scene.traverse(obj => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.roughness = 0.78; material.metalness = 0;
    if (material.map) { material.map.anisotropy = 4; }
  });
}

const SOURCES: Record<keyof CharacterKits, { model: string; anims: string[] }> = {
  mizu: { model: 'mizu.glb', anims: ['mizu_anims.glb', 'mizu_run.glb', 'mizu_extra.glb'] },
  storm: { model: 'storm.glb', anims: ['storm_anims.glb', 'storm_extra.glb'] },
  kaze: { model: 'kaze.glb', anims: ['kaze_anims.glb', 'kaze_extra.glb'] },
  akane: { model: 'akane.glb', anims: ['akane_anims.glb', 'akane_extra.glb'] },
};
function buildKit(model: THREE.Object3D, sources: THREE.AnimationClip[]): ModelKit {
  prepareTemplate(model);
  const hips = model.getObjectByName(HIPS);
  if (!hips) throw new Error('Esqueleto sem mixamorig:Hips');
  const rest = hips.position.clone();
  const find = (name: string) => sources.find(c => c.name === name);
  const pick = (name: string, fallback?: string) => {
    const clip = find(name) ?? (fallback ? find(fallback) : undefined);
    if (!clip) throw new Error(`Clip ausente: ${name}`);
    return pinRoot(clip, rest, name);
  };
  const box = new THREE.Box3().setFromObject(model);
  return {
    template: model, height: box.max.y - box.min.y, floor: box.min.y, runSpeed: rootSpeed(find('run')!),
    clips: { idle: pick('idle'), run: pick('run'), jump: pick('jump'), shoot: pick('fire'), fall: pick('fall'), victory: pick('victory_celebration', 'idle') },
  };
}
let pending: Promise<CharacterKits> | null = null;
/** Load only the active roster; archived assets remain on disk, not in every match. */
export function loadCharacterKits(): Promise<CharacterKits> {
  pending ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const load = (file: string) => loader.loadAsync(asset(`models/${file}`));
    const names: (keyof CharacterKits)[] = ['mizu', 'storm'];
    const results = await Promise.allSettled(names.map(async name => {
      const src = SOURCES[name];
      // Hash the exact same bytes we parse, rather than trusting a file name or
      // fetching an unverified second copy. Other character loading is unchanged.
      const stormSource = name === 'storm' ? await fetch(asset(`models/${src.model}`)).then(r => {
        if (!r.ok) throw new Error(`Modelo Storm HTTP ${r.status}`);
        return r.arrayBuffer();
      }) : undefined;
      const modelLoad = stormSource ? loader.parseAsync(stormSource, asset('models/')) : load(src.model);
      const [model, ...anims] = await Promise.all([modelLoad, ...src.anims.map(load)]);
      const kit = buildKit(model.scene, anims.flatMap(a => a.animations));
      // In a non-secure legacy context, keep the original asset, never guess.
      if (stormSource && globalThis.crypto?.subtle) kit.sourceSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', stormSource)), b => b.toString(16).padStart(2, '0')).join('');
      return kit;
    }));
    // Keep legacy fallback keys for older renderer consumers without loading retired models.
    const kits: CharacterKits = { mizu: null, storm: null, kaze: null, akane: null };
    results.forEach((r, i) => {
      kits[names[i]] = r.status === 'fulfilled' ? r.value : null;
      if (r.status === 'rejected') console.warn(`Modelo ${names[i]} indisponível`, r.reason);
    });
    if (names.every(n => !kits[n])) throw new Error('Nenhum modelo 3D carregou');
    return kits;
  })();
  return pending;
}

/** Independent skinned copy (own skeleton). Material is cloned so tint/opacity stay per fighter. */
export function instantiate(kit: ModelKit, tint?: THREE.ColorRepresentation): THREE.Object3D {
  const copy = cloneSkinned(kit.template);
  bindStormOrnament(copy, kit.sourceSha256);
  copy.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    if (tint !== undefined) material.color.set(tint);
    mesh.material = material;
  });
  return copy;
}
