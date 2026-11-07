// CPU-only production renderer harness. No browser, WebGL or screenshot.
// Only Vite's URL boundary and raster texture decoding are replaced. GLB vertices,
// skeletons, clips, materials and all renderer/simulation transforms are real.
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const project = new URL('../../', import.meta.url);
registerHooks({
  load(url, context, nextLoad) {
    if (url === new URL('src/paths.ts', project).href) return {
      format: 'module', shortCircuit: true,
      source: 'export function asset(path) { return `http://arco-rig.invalid/assets/${path}`; }',
    };
    if (url === new URL('src/render/textures.ts', project).href) return {
      format: 'module', shortCircuit: true,
      source: "import { Texture } from 'three'; export const blob = () => new Texture(); export const softDot = blob;",
    };
    const loaded = nextLoad(url, context);
    if (url.startsWith(project.href) && url.endsWith('.ts')) return {
      ...loaded, format: 'module', source: transformSync(fileURLToPath(url), String(loaded.source), { lang: 'ts' }).code,
    };
    return loaded;
  },
});
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'arco-rig.invalid') {
    if (url.protocol === 'blob:') return nativeFetch(input, init);
    throw new Error(`CPU rig fixture forbids network: ${url}`);
  }
  if (!/^\/assets\/models\/[a-z_]+\.glb$/.test(url.pathname)) throw new Error(`Unexpected asset ${url}`);
  const bytes = await readFile(fileURLToPath(new URL(`public${url.pathname}`, project)));
  return new Response(bytes, { headers: { 'Content-Length': String(bytes.length) } });
};
Object.assign(globalThis, {
  self: globalThis,
  // GLTFLoader only needs an image object here; pixels are not tested in CPU proof.
  createImageBitmap: async () => ({ width: 1, height: 1, close() {} }),
  ProgressEvent: class { type: string; init: unknown; constructor(type: string, init: unknown) { this.type = type; this.init = init; } },
});

export async function rigRuntime() {
  const THREE = await import('three');
  const { loadCharacterKits } = await import('../../src/render/characters.ts');
  const { FightersView } = await import('../../src/render/fighters.ts');
  const { ArrowsView } = await import('../../src/render/arrows.ts');
  const { createWorld } = await import('../../src/sim/world.ts');
  const kits = await loadCharacterKits();
  if (!kits.mizu || !kits.storm) throw new Error('Both actual GLBs required; no procedural fallback');
  const world = createWorld({ humans: 2, bots: 0, map: 'totem', seed: 3 });
  world.phase = 'playing';
  world.fighters.forEach((f, i) => Object.assign(f, {
    character: i, x: 13 + i * 6, prevX: 13 + i * 6, y: 15.45, prevY: 15.45,
    grounded: true, invulnerable: 0, aimX: 1, aimY: 0, facing: 1,
  }));
  const scene = new THREE.Group(), fighters = new FightersView(scene), arrows = new ArrowsView(scene);
  await Promise.resolve();
  fighters.reset(world);
  if (!fighters.usingModels) throw new Error('Production FightersView did not use GLBs');
  let time = 0;
  const frames = (count: number) => {
    for (let i = 0; i < count; i++) { time += 1 / 60; fighters.update(world, 1, time, 1 / 60); }
  };
  return { THREE, kits, world, fighters, arrows, scene, frames };
}
