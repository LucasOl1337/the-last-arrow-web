import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Level } from '../sim/level.ts';
import { asset } from '../paths.ts';
import { themeFor, themeForLevel } from './themes.ts';
import type { Theme } from './themes.ts';
import { buildTerrain } from './terrain.ts';
import type { TerrainBuild } from './terrain.ts';
import { blurredBackground, mist, ray } from './textures.ts';
import { lowPixelRatio } from './quality.ts';
import { cameraFrame, followCamera, backgroundMotion } from './camera-frame.ts';
import type { CameraFollow } from './camera-frame.ts';

/** Peak camera push-in during the kill slow-motion. */
const ZOOM = 0.05;

/** Art boundary: the renderer only reads the simulation. Coordinates: sim y-down -> scene y-up. */
export class ArenaScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  readonly arena = new THREE.Group();
  private atmosphere = new THREE.Group();
  private terrain: TerrainBuild | null = null;
  private layers: { mesh: THREE.Mesh; parallax: number; baseX: number; baseY: number }[] = [];
  private mists: THREE.Mesh[] = [];
  private rays: THREE.Mesh[] = [];
  private stone: THREE.Texture;
  private baseZ = 38;
  private followState: CameraFollow | undefined;
  private backgroundOffset = new THREE.Vector2();
  closeCamera = false;
  cameraTarget: { x: number; y: number } | undefined;
  private lowQuality = false;
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private rim = new THREE.DirectionalLight();
  private veil: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private bgCache = new Map<string, THREE.Texture>();
  private theme: Theme = themeFor('moss');
  /** Bloom can be turned off by the frame-time governor (or ?bloom=0). */
  bloomEnabled = new URLSearchParams(location.search).get('bloom') !== '0';
  constructor(readonly canvas: HTMLCanvasElement, private onAssetError: () => void = () => {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.info.autoReset = false; // composer renders several passes per frame; reset once in draw()
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft was folded into PCF (soft) in r18x.
    this.camera.position.set(16, 9, this.baseZ);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.rim);
    // Shadows only from fighters/tiles; the ortho frustum covers the 32×18 arena.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -20, right: 20, top: 14, bottom: -14, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    this.sun.target.position.set(16, 9, 0);
    this.scene.add(this.atmosphere, this.arena);
    this.stone = new THREE.TextureLoader().load(asset('tex/stone.jpg'), undefined, undefined, () => {
      // A white texel preserves the theme tint instead of sampling an incomplete black texture.
      const fallback = document.createElement('canvas'); fallback.width = fallback.height = 1;
      const g = fallback.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
      this.stone.image = fallback; this.stone.needsUpdate = true; this.onAssetError();
    });
    this.stone.colorSpace = THREE.SRGBColorSpace; this.stone.wrapS = this.stone.wrapT = THREE.RepeatWrapping; this.stone.anisotropy = 4;
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.veil.position.set(16, 9, -6); this.veil.renderOrder = -1; this.atmosphere.add(this.veil);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.5, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  private background(file: string, blur: number) {
    const key = `${file}:${blur}`;
    let texture = this.bgCache.get(key);
    if (!texture) { texture = blurredBackground(asset(file), blur, undefined, this.onAssetError); this.bgCache.set(key, texture); }
    return texture;
  }
  private applyTheme(theme: Theme) {
    this.theme = theme;
    for (const l of this.layers) { this.atmosphere.remove(l.mesh); l.mesh.geometry.dispose(); (l.mesh.material as THREE.Material).dispose(); }
    for (const m of [...this.mists, ...this.rays]) { this.atmosphere.remove(m); m.geometry.dispose(); const mat = m.material as THREE.MeshBasicMaterial; if (this.mists.includes(m)) mat.map?.dispose(); mat.dispose(); }
    this.layers = []; this.mists = []; this.rays = [];
    this.renderer.setClearColor(theme.clear);
    this.renderer.toneMappingExposure = theme.exposure;
    this.hemi.color.set(theme.hemi.sky); this.hemi.groundColor.set(theme.hemi.ground); this.hemi.intensity = theme.hemi.intensity;
    this.sun.color.set(theme.sun.color); this.sun.intensity = theme.sun.intensity;
    this.sun.position.set(16 + theme.sun.position[0], 9 + theme.sun.position[1], theme.sun.position[2]);
    this.rim.color.set(theme.rim.color); this.rim.intensity = theme.rim.intensity; this.rim.position.set(30, 12, -6);
    this.veil.material.color.set(theme.veil.color); this.veil.material.opacity = theme.veil.opacity;
    for (const bg of theme.backgrounds) {
      const material = new THREE.MeshBasicMaterial({ map: this.background(bg.file, bg.blur), transparent: bg.opacity < 1, opacity: bg.opacity, depthWrite: false, fog: false });
      material.color.setScalar(0.8);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(bg.width, bg.width * 9 / 16), material);
      mesh.position.set(16, bg.y ?? 9, bg.z); mesh.renderOrder = -3;
      this.atmosphere.add(mesh); this.layers.push({ mesh, parallax: bg.parallax, baseX: 16, baseY: bg.y ?? 9 });
    }
    // Mist bands: one behind the arena, one low in front of the background.
    const mistTex = mist();
    [{ y: 2.6, z: -4, h: 4.5, o: 0.8 }, { y: 10, z: -8, h: 6, o: 0.45 }, { y: -0.6, z: 1.6, h: 2.6, o: 0.7 }].forEach((band, i) => {
      const material = new THREE.MeshBasicMaterial({ map: mistTex.clone(), color: theme.mist.color, transparent: true, opacity: theme.mist.opacity * band.o, depthWrite: false, fog: false });
      material.map!.wrapS = THREE.RepeatWrapping; material.map!.repeat.set(2, 1); material.map!.needsUpdate = true;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(64, band.h), material);
      mesh.position.set(16, band.y, band.z); mesh.renderOrder = -1 + i; mesh.userData.speed = 0.006 + i * 0.004;
      this.atmosphere.add(mesh); this.mists.push(mesh);
    });
    // Light shafts.
    const rayTex = ray();
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicMaterial({ map: rayTex, color: theme.rays.color, transparent: true, opacity: theme.rays.opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2 + i * 0.9, 26), material);
      const from = theme.rays.from;
      const x = from === 'left' ? 3 + i * 4.5 : from === 'right' ? 29 - i * 4.5 : 8 + i * 5.5;
      mesh.position.set(x, 12, -3 - i * 0.6);
      mesh.rotation.z = from === 'left' ? 0.42 : from === 'right' ? -0.42 : (i - 1.5) * 0.12;
      mesh.userData.phase = i * 1.9; mesh.userData.base = theme.rays.opacity;
      this.atmosphere.add(mesh); this.rays.push(mesh);
    }
    this.bloom.strength = theme.bloom.strength; this.bloom.threshold = theme.bloom.threshold; this.bloom.radius = theme.bloom.radius;
  }
  setLevel(level: Level) {
    this.followState = undefined; this.backgroundOffset.set(0, 0);
    this.terrain?.dispose(); if (this.terrain) this.arena.remove(this.terrain.group);
    this.applyTheme(themeForLevel(level));
    this.terrain = buildTerrain(level, this.theme, this.stone);
    this.arena.add(this.terrain.group);
  }
  /** Pointer projection onto the fighters' plane, respecting canvas gutters and close camera. */
  pointerOnArena(clientX:number,clientY:number) {
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);
    const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-.55),new THREE.Vector3());
    return hit?{x:hit.x,y:18-hit.y}:null;
  }
  setLowQuality() {
    this.bloomEnabled = false; this.lowQuality = true;
    this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
  }
  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return; // hidden/minimized containers must not poison the camera matrix
    if (this.lowQuality) this.renderer.setPixelRatio(lowPixelRatio(devicePixelRatio, width, height));
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height;
    this.baseZ = Math.max(19.4, 33.8 / this.camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
    // draw() applies the close/wide distance atomically with the new framing.
    this.followState = undefined; this.camera.updateProjectionMatrix();
    const ratio = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(ratio); this.composer.setSize(width, height);
    // Bloom at half resolution is visually identical here and much cheaper.
    this.bloom.resolution.set(width / 2, height / 2);
  }
  /**
   * `focus`/`zoom`: push in up to ZOOM (5%) about a scene point, keeping that point fixed on screen;
   * the framing shift is clamped so the arena never slides more than the zoom margin.
   */
  draw(time: number, shake: number, focus?: { x: number; y: number }, zoom = 0) {
    const sx = Math.sin(time * 91) * shake, sy = Math.cos(time * 77) * shake * 0.6;
    const k = ZOOM * zoom;
    const frame = cameraFrame(this.camera.aspect, this.closeCamera, this.cameraTarget);
    const fx = focus ? THREE.MathUtils.clamp(focus.x - frame.x, -16, 16) * k : 0, fy = focus ? THREE.MathUtils.clamp(focus.y - frame.y, -9, 9) * k : 0;
    // Track the raw target, not clamped frame displacement: vertical wraps can move the frame <5 tiles.
    const dt = Math.min(.05, Math.max(0, time - (this.camera.userData.lastTime ?? time)));
    this.camera.userData.lastTime = time;
    this.followState = followCamera(this.followState, this.camera.aspect, this.closeCamera, this.cameraTarget, dt);
    const z = this.closeCamera ? frame.height / (2 * Math.tan(THREE.MathUtils.degToRad(15))) : this.baseZ;
    this.camera.position.set(this.followState.x + sx + fx, this.followState.y + sy + fy, z * (1 - k));
    // Slow, bounded parallax follows clean camera motion, not shake/impact. Ease seams/respawns too.
    const bgWeight = 1 - Math.exp(-dt * 2);
    this.backgroundOffset.x += (this.followState.x - 16 - this.backgroundOffset.x) * bgWeight;
    this.backgroundOffset.y += (this.followState.y - 9 - this.backgroundOffset.y) * bgWeight;
    for (const l of this.layers) {
      const offset = backgroundMotion(l.parallax, 16 + this.backgroundOffset.x, 9 + this.backgroundOffset.y, time);
      l.mesh.position.x = l.baseX + offset.x;
      l.mesh.position.y = l.baseY + offset.y;
    }
    for (const m of this.mists) (m.material as THREE.MeshBasicMaterial).map!.offset.x = time * m.userData.speed;
    for (const r of this.rays) (r.material as THREE.MeshBasicMaterial).opacity = r.userData.base * (0.65 + 0.35 * Math.sin(time * 0.5 + r.userData.phase));
    this.terrain?.update(time);
    this.renderer.info.reset();
    if (this.bloomEnabled) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
