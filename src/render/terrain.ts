import * as THREE from 'three';
import type { Level } from '../sim/level.ts';
import { WIDTH, HEIGHT } from '../sim/level.ts';
import type { Theme } from './themes.ts';
import { rng, fern, grass, vines, wood, runes, flame, flower, mossTex, softDot } from './textures.ts';

/** Block depth: front face at z=FRONT, back at FRONT-DEPTH. Fighters stand at z≈0.55. */
const FRONT = 0.42, DEPTH = 1.5;
const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), euler = new THREE.Euler(), color = new THREE.Color();

/** World-space UVs (front: xy, top: xz, sides: zy) so the stone texture flows across adjacent tiles. */
function worldUv(material: THREE.MeshStandardMaterial, scale: [number, number], key: string) {
  material.customProgramCacheKey = () => `tla-worlduv-${key}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  {
    vec4 tlaWp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = abs(normal);
    vec2 w = n.z > 0.5 ? tlaWp.xy : (n.y > 0.5 ? vec2(tlaWp.x, tlaWp.z * 0.7) : vec2(tlaWp.z * 0.7, tlaWp.y));
    vMapUv = w * vec2(${scale[0].toFixed(3)}, ${scale[1].toFixed(3)});
  }
#endif`);
    // Darken the lower part of each block slightly: ambient-occlusion feel under the moss lip.
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vTlaShade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTlaShade = 0.78 + 0.22 * clamp(position.y + 0.5, 0.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTlaShade;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vTlaShade;');
  };
}

/** Moss cap: front profile with a bumpy top and drippy bottom edge, extruded through the block depth. */
function mossCapGeometry(seed: number) {
  const r = rng(seed), shape = new THREE.Shape(), steps = 10;
  shape.moveTo(-0.54, 0.02);
  for (let i = 0; i <= steps; i++) { const x = -0.54 + 1.08 * i / steps; shape.lineTo(x, 0.05 + r() * 0.07); }
  for (let i = steps; i >= 0; i--) {
    const x = -0.54 + 1.08 * i / steps, drip = r() < 0.3 ? 0.12 + r() * 0.16 : r() * 0.06;
    shape.lineTo(x, -0.07 - drip);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: DEPTH + 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 1, curveSegments: 2 });
  geometry.translate(0, 0, -DEPTH - 0.04);
  return geometry;
}

function billboardGeometry(width: number, height: number, uv?: [number, number, number, number]) {
  const g = new THREE.PlaneGeometry(width, height); g.translate(0, height / 2, 0);
  if (uv) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1])); }
  return g;
}

export interface TerrainBuild { group: THREE.Group; update: (time: number) => void; dispose: () => void; lights: THREE.PointLight[] }

export function buildTerrain(level: Level, theme: Theme, stone: THREE.Texture): TerrainBuild {
  const group = new THREE.Group(), r = rng(level.id.length * 977 + level.rows.join('').length);
  const disposables: { dispose: () => void }[] = [];
  const animated: ((time: number) => void)[] = [];
  const lights: THREE.PointLight[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  const solidAt = (x: number, y: number) => level.rows[((y % HEIGHT) + HEIGHT) % HEIGHT][((x % WIDTH) + WIDTH) % WIDTH] === '#';
  const tiles: { x: number; y: number; top: boolean; bottom: boolean; left: boolean; right: boolean }[] = [];
  level.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '#') return;
    tiles.push({ x, y, top: !solidAt(x, y - 1), bottom: !solidAt(x, y + 1), left: !solidAt(x - 1, y), right: !solidAt(x + 1, y) });
  }));
  const tops = tiles.filter(t => t.top), bottoms = tiles.filter(t => t.bottom);
  const sceneY = (y: number) => HEIGHT - y; // top edge of tile row y in scene units

  // --- Blocks -------------------------------------------------------------------------------
  const wooden = theme.block === 'wood';
  const blockMaterial = own(new THREE.MeshStandardMaterial({ map: wooden ? wood() : stone, color: theme.stoneTint, roughness: wooden ? 0.8 : 0.95 }));
  worldUv(blockMaterial, wooden ? [0.5, 0.75] : [0.25, 0.25], wooden ? 'wood' : 'stone');
  const blockGeometry = own(new THREE.BoxGeometry(1.0, 1.0, DEPTH));
  const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, tiles.length);
  blocks.castShadow = blocks.receiveShadow = true;
  tiles.forEach((t, i) => {
    // Wood: platforms are thick plank decks, slightly inset so seams read; stone keeps full tiles.
    pos.set(t.x + 0.5, sceneY(t.y) - 0.5, FRONT - DEPTH / 2);
    scl.set(1.002, 1, 1);
    matrix.compose(pos, quat.identity(), scl); blocks.setMatrixAt(i, matrix);
  });
  group.add(blocks);

  // Wooden decks: support brackets under platform ends and rope rails.
  if (wooden) {
    const beamMaterial = own(new THREE.MeshStandardMaterial({ map: wood(), color: 0x8a5a34, roughness: 0.85 }));
    const beamGeometry = own(new THREE.BoxGeometry(0.16, 1.5, 0.16));
    const ends = bottoms.filter(t => t.left || t.right);
    const beams = new THREE.InstancedMesh(beamGeometry, beamMaterial, ends.length * 2);
    beams.castShadow = true;
    let b = 0;
    for (const t of ends) {
      const side = t.left ? 1 : -1;
      for (const z of [FRONT - 0.15, FRONT - DEPTH + 0.15]) {
        pos.set(t.x + 0.5 + side * 0.25, sceneY(t.y) - 1.45, z);
        quat.setFromEuler(euler.set(0, 0, side * 0.55)); matrix.compose(pos, quat, scl.set(1, 1, 1)); beams.setMatrixAt(b++, matrix);
      }
    }
    beams.count = b; group.add(beams);
    const ropeMaterial = own(new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1 }));
    const postGeometry = own(new THREE.CylinderGeometry(0.035, 0.045, 0.55, 5)); postGeometry.translate(0, 0.27, 0);
    const posts = new THREE.InstancedMesh(postGeometry, beamMaterial, tops.length);
    let p = 0;
    for (const t of tops) if (t.left || t.right || (t.x % 2 === 0)) { pos.set(t.x + (t.left ? 0.12 : t.right ? 0.88 : 0.5), sceneY(t.y), FRONT - DEPTH + 0.1); matrix.compose(pos, quat.identity(), scl.set(1, 1, 1)); posts.setMatrixAt(p++, matrix); }
    posts.count = p; group.add(posts);
    // Rails: one sagging rope per platform run, at the back edge (keeps the play line clean).
    const runs: { a: number; b: number; y: number }[] = [];
    for (const t of tops) { const last = runs[runs.length - 1]; if (last && last.y === t.y && last.b === t.x) last.b = t.x + 1; else runs.push({ a: t.x, b: t.x + 1, y: t.y }); }
    for (const run of runs) {
      if (run.b - run.a < 2) continue;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) { const s = i / 12; pts.push(new THREE.Vector3(run.a + 0.12 + (run.b - run.a - 0.24) * s, sceneY(run.y) + 0.5 - Math.sin(Math.PI * s) * 0.14, FRONT - DEPTH + 0.1)); }
      const rope = new THREE.Mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 4)), ropeMaterial);
      group.add(rope);
    }
  }

  // --- Moss caps (irregular top, drips over the front edge) ---------------------------------
  if (theme.mossAmount > 0) {
    const capMaterial = own(new THREE.MeshStandardMaterial({ map: mossTex(), color: theme.mossColor, roughness: 1 }));
    const variants = [1, 2, 3].map(s => own(mossCapGeometry(s * 31 + level.id.length)));
    const mossy = tops.filter(() => r() < theme.mossAmount);
    variants.forEach((geometry, v) => {
      const list = mossy.filter((_, i) => i % 3 === v);
      const caps = new THREE.InstancedMesh(geometry, capMaterial, Math.max(1, list.length));
      caps.receiveShadow = true; caps.castShadow = true;
      list.forEach((t, i) => { pos.set(t.x + 0.5, sceneY(t.y), FRONT); matrix.compose(pos, quat.identity(), scl.set(1, 1, 1)); caps.setMatrixAt(i, matrix); });
      caps.count = list.length; group.add(caps);
    });
  }

  // --- Grass tufts on top edges (alpha-tested billboards) ------------------------------------
  const tuftMaterial = own(new THREE.MeshStandardMaterial({ map: grass(), alphaTest: 0.45, side: THREE.DoubleSide, color: theme.mossColor, roughness: 1 }));
  const tuftGeometry = own(billboardGeometry(0.9, 0.38));
  const tuftCount = Math.round(tops.length * (wooden ? 0.6 : 1.6));
  const tufts = new THREE.InstancedMesh(tuftGeometry, tuftMaterial, tuftCount);
  for (let i = 0; i < tuftCount; i++) {
    const t = tops[Math.floor(r() * tops.length)];
    // Mostly at the back of the deck; a few short ones on the lip.
    const back = r() < 0.7;
    pos.set(t.x + r(), sceneY(t.y) + 0.03, back ? FRONT - 0.5 - r() * 0.8 : FRONT - 0.02);
    quat.setFromEuler(euler.set(0, (r() - 0.5) * 0.6, 0));
    const s = back ? 0.7 + r() * 0.6 : 0.35 + r() * 0.3;
    matrix.compose(pos, quat, scl.set(s, s, s)); tufts.setMatrixAt(i, matrix);
  }
  group.add(tufts);

  // --- Hanging moss & vines under platforms --------------------------------------------------
  const vineMaterial = own(new THREE.MeshStandardMaterial({ map: vines(), alphaTest: 0.4, side: THREE.DoubleSide, color: theme.vineColor, roughness: 1 }));
  const vineGeometry = own(new THREE.PlaneGeometry(1.1, 1)); vineGeometry.translate(0, -0.5, 0);
  const hanging = bottoms.filter(() => r() < (wooden ? 0.55 : 0.8));
  const vineMesh = new THREE.InstancedMesh(vineGeometry, vineMaterial, Math.max(1, hanging.length));
  hanging.forEach((t, i) => {
    pos.set(t.x + 0.5 + (r() - 0.5) * 0.2, sceneY(t.y) - 0.92, FRONT + 0.03);
    matrix.compose(pos, quat.identity(), scl.set(r() < 0.5 ? 1 : -1, 0.35 + r() * 0.9, 1)); vineMesh.setMatrixAt(i, matrix);
  });
  vineMesh.count = hanging.length; group.add(vineMesh);

  // --- Ferns (behind the play line, framing platforms) --------------------------------------
  const fernMaterial = own(new THREE.MeshStandardMaterial({ map: fern(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: 0xb8d8a0 }));
  const fernGeometry = own(billboardGeometry(1.1, 1.0));
  const ferns = new THREE.InstancedMesh(fernGeometry, fernMaterial, theme.props.ferns);
  for (let i = 0; i < theme.props.ferns; i++) {
    const t = tops[Math.floor(r() * tops.length)];
    pos.set(t.x + r(), sceneY(t.y), FRONT - 0.9 - r() * 0.5);
    quat.setFromEuler(euler.set(0, (r() - 0.5) * 0.8, 0)); const s = 0.6 + r() * 0.7;
    matrix.compose(pos, quat, scl.set(s, s, s)); ferns.setMatrixAt(i, matrix);
  }
  group.add(ferns);

  // --- Glowing mushrooms --------------------------------------------------------------------
  if (theme.props.mushrooms > 0) {
    const capGeo = own(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)); capGeo.scale(1, 0.7, 1);
    const stemGeo = own(new THREE.CylinderGeometry(0.025, 0.035, 0.14, 6)); stemGeo.translate(0, -0.07, 0);
    const capMat = own(new THREE.MeshStandardMaterial({ color: 0x9ffcff, emissive: 0x2fe6e0, emissiveIntensity: 2.4, roughness: 0.4 }));
    const stemMat = own(new THREE.MeshStandardMaterial({ color: 0xd9f5ee, emissive: 0x2a8f88, emissiveIntensity: 0.6 }));
    const count = theme.props.mushrooms * 3;
    const caps = new THREE.InstancedMesh(capGeo, capMat, count), stems = new THREE.InstancedMesh(stemGeo, stemMat, count);
    for (let c = 0, i = 0; c < theme.props.mushrooms; c++) {
      const t = tops[Math.floor(r() * tops.length)], cx = t.x + 0.2 + r() * 0.6, cz = FRONT - 0.25 - r() * 0.9;
      for (let k = 0; k < 3; k++, i++) {
        const s = 0.6 + r() * 0.9;
        pos.set(cx + (r() - 0.5) * 0.35, sceneY(t.y) + 0.14 * s, cz + (r() - 0.5) * 0.3);
        matrix.compose(pos, quat.identity(), scl.set(s, s, s)); caps.setMatrixAt(i, matrix); stems.setMatrixAt(i, matrix);
      }
    }
    group.add(caps, stems);
  }

  // --- Flowers (unlit, tinted per instance; read as bioluminescent) --------------------------
  if (theme.props.flowers.length) {
    const flowerMat = own(new THREE.MeshBasicMaterial({ map: flower(), alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false }));
    const flowerGeo = own(new THREE.PlaneGeometry(0.28, 0.28));
    const count = 18;
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, count);
    for (let i = 0; i < count; i++) {
      const t = tops[Math.floor(r() * tops.length)];
      pos.set(t.x + r(), sceneY(t.y) + 0.14 + r() * 0.12, FRONT - 0.2 - r() * 1.1);
      quat.setFromEuler(euler.set(-0.5, 0, r() * 3)); const s = 0.7 + r() * 0.8;
      matrix.compose(pos, quat, scl.set(s, s, s)); flowers.setMatrixAt(i, matrix);
      flowers.setColorAt(i, color.set(theme.props.flowers[i % theme.props.flowers.length]).multiplyScalar(1.4));
    }
    group.add(flowers);
  }

  // --- Temple runes on some front faces ------------------------------------------------------
  if (theme.props.runes) {
    const runeTex = runes();
    const runeMat = own(new THREE.MeshBasicMaterial({ map: runeTex, color: 0x3ff5dc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const faces = tiles.filter(t => !t.top && r() < 0.5).concat(tiles.filter(t => t.top && r() < 0.18));
    for (let g = 0; g < 4; g++) {
      const list = faces.filter((_, i) => i % 4 === g);
      if (!list.length) continue;
      const geo = own(new THREE.PlaneGeometry(0.5, 0.5));
      const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setX(i, (g + a.getX(i)) / 4);
      const mesh = new THREE.InstancedMesh(geo, runeMat, list.length);
      list.forEach((t, i) => { pos.set(t.x + 0.5, sceneY(t.y) - 0.55, FRONT + 0.005); matrix.compose(pos, quat.identity(), scl.set(1, 1, 1)); mesh.setMatrixAt(i, matrix); });
      group.add(mesh);
    }
    animated.push(time => { runeMat.opacity = 0.55 + Math.sin(time * 1.7) * 0.25; });
  }

  // --- Torches (Templo) / lanterns (Copas) with real point lights ---------------------------
  const flames: THREE.Sprite[] = [];
  const flameMat = own(new THREE.SpriteMaterial({ map: flame(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xffffff }));
  if (theme.props.torches) {
    const wide = tops.filter(t => t.left || t.right);
    const picks = [...new Set([0, Math.floor(wide.length / 3), Math.floor(wide.length * 2 / 3), wide.length - 1])].map(i => wide[i]).filter(Boolean).slice(0, 4);
    const postMat = own(new THREE.MeshStandardMaterial({ map: stone, color: 0x8b9a92, roughness: 0.9 }));
    const bowlMat = own(new THREE.MeshStandardMaterial({ color: 0x3b2f22, roughness: 0.7 }));
    const postGeo = own(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6)); postGeo.translate(0, 0.35, 0);
    const bowlGeo = own(new THREE.CylinderGeometry(0.17, 0.09, 0.12, 8));
    for (const t of picks) {
      const x = t.x + (t.left ? 0.3 : 0.7), y = sceneY(t.y), z = FRONT - DEPTH + 0.35;
      const post = new THREE.Mesh(postGeo, postMat); post.position.set(x, y, z); post.castShadow = true;
      const bowl = new THREE.Mesh(bowlGeo, bowlMat); bowl.position.set(x, y + 0.75, z);
      const sprite = new THREE.Sprite(flameMat); sprite.position.set(x, y + 1.0, z + 0.05); sprite.scale.set(0.42, 0.7, 1);
      const light = new THREE.PointLight(0xff9a40, 4.5, 5.5, 1.6); light.position.set(x, y + 1.05, z + 0.5);
      group.add(post, bowl, sprite, light); flames.push(sprite); lights.push(light);
    }
  }
  if (theme.props.lanterns) {
    const lanternMat = own(new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a30, emissiveIntensity: 2.2, roughness: 0.5 }));
    const capMat = own(new THREE.MeshStandardMaterial({ color: 0x4a2d18, roughness: 0.8 }));
    const ropeMat = own(new THREE.MeshBasicMaterial({ color: 0x3a2412 }));
    const bodyGeo = own(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 8));
    const capGeo = own(new THREE.CylinderGeometry(0.06, 0.2, 0.08, 8));
    const ropeGeo = own(new THREE.CylinderGeometry(0.01, 0.01, 1, 3)); ropeGeo.translate(0, 0.5, 0);
    // Hang from the screen top between platforms; positions avoid the main jump lanes.
    const xs = [4.5, 12.5, 19.5, 27.5];
    xs.forEach((x, i) => {
      const len = 1.2 + (i % 2) * 1.1, y = HEIGHT - len, z = FRONT - DEPTH + 0.2;
      const holder = new THREE.Group(); holder.position.set(x, HEIGHT + 0.3, z);
      const rope = new THREE.Mesh(ropeGeo, ropeMat); rope.scale.y = len + 0.1; rope.position.y = -len - 0.1; holder.add(rope);
      const body = new THREE.Mesh(bodyGeo, lanternMat); body.position.y = -len - 0.25; holder.add(body);
      const top = new THREE.Mesh(capGeo, capMat); top.position.y = -len - 0.04; holder.add(top);
      const bottom = new THREE.Mesh(capGeo, capMat); bottom.position.y = -len - 0.45; bottom.rotation.x = Math.PI; holder.add(bottom);
      const light = new THREE.PointLight(0xffa850, 3.2, 6, 1.6); light.position.set(0, -len - 0.25, 0.4); holder.add(light);
      group.add(holder); lights.push(light);
      animated.push(time => { holder.rotation.z = Math.sin(time * 0.9 + i * 1.7) * 0.05; });
      void y;
    });
  }
  const baseIntensity = lights.map(l => l.intensity);
  animated.push(time => {
    lights.forEach((l, i) => { l.intensity = baseIntensity[i] * (0.85 + Math.sin(time * 9 + i * 3) * 0.08 + Math.sin(time * 23 + i) * 0.05); });
    flames.forEach((s, i) => { s.scale.set(0.42 + Math.sin(time * 13 + i) * 0.03, 0.7 + Math.sin(time * 17 + i * 2) * 0.08, 1); });
  });

  // --- Fireflies: GPU-animated points ---------------------------------------------------------
  const count = theme.fireflies.count, positions = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions.set([r() * WIDTH, 1 + r() * (HEIGHT - 2), -1.2 + r() * 2.6], i * 3); seeds[i] = r() * 100; }
  const flyGeo = own(new THREE.BufferGeometry());
  flyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); flyGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const flyMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(theme.fireflies.color) }, uMap: { value: softDot() }, uScale: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.31 + seed) * 0.8, sin(uTime * 0.47 + seed * 1.7) * 0.5, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 2.3 + seed * 3.1), 3.0);
        gl_PointSize = uScale * (2.0 + 3.5 * vA) * (40.0 / -mv.z);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform sampler2D uMap; varying float vA;
      void main() { float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(uColor * 1.6, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const flies = new THREE.Points(flyGeo, flyMat); flies.frustumCulled = false; group.add(flies);
  animated.push(time => { flyMat.uniforms.uTime.value = time; });

  return {
    group, lights,
    update: time => { for (const fn of animated) fn(time); },
    dispose: () => { for (const d of disposables) d.dispose(); group.clear(); },
  };
}
