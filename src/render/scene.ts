import * as THREE from 'three';
import type { Level } from '../sim/level.ts';

/** Art boundary: the renderer only reads the simulation. Coordinates: sim y-down -> scene y-up. */
export class ArenaScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 160);
  private terrain = new THREE.Group();
  private layers: THREE.Mesh[] = [];
  private stone: THREE.Texture;
  private baseZ = 38;
  private matrix = new THREE.Matrix4();
  private loader = new THREE.TextureLoader();
  readonly arena = new THREE.Group();
  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x08151b);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera.position.set(16, 9, this.baseZ);
    this.scene.add(new THREE.HemisphereLight(0xc5e9ef, 0x314530, 2.6));
    const sun = new THREE.DirectionalLight(0xffdfab, 3.1); sun.position.set(-8, 22, 20); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6dd4e0, 1.5); rim.position.set(30, 8, -2); this.scene.add(rim);
    this.scene.add(this.arena); this.arena.add(this.terrain);
    this.stone = this.loader.load('/assets/tex/stone.jpg'); this.stone.colorSpace = THREE.SRGBColorSpace;
    this.stone.wrapS = this.stone.wrapT = THREE.RepeatWrapping;
    this.addBackground('/assets/bg/canopy.jpg', -12, 58, 0.6);
    this.addBackground('/assets/bg/ruins.jpg', -7, 48, 0.45);
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(60, 36), new THREE.MeshBasicMaterial({ color: 0x061a20, transparent: true, opacity: 0.35, depthWrite: false }));
    veil.position.set(16, 9, -5); this.scene.add(veil);
  }
  private addBackground(url: string, z: number, width: number, opacity: number) {
    const texture = this.loader.load(url); texture.colorSpace = THREE.SRGBColorSpace;
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 9 / 16), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false }));
    layer.position.set(16, 9, z); this.scene.add(layer); this.layers.push(layer);
  }
  setLevel(level: Level) {
    this.terrain.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); const materials = Array.isArray(obj.material) ? obj.material : [obj.material]; materials.forEach(m => m.dispose()); } });
    this.terrain.clear();
    let count = 0, tops = 0;
    level.rows.forEach((row, y) => [...row].forEach((tile, x) => { if (tile === '#') { count++; if (level.rows[(y + 17) % 18][x] !== '#') tops++; } }));
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.98, 1.2), new THREE.MeshStandardMaterial({ map: this.stone, color: 0x9fafa8, roughness: 0.95 }), count);
    const moss = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 0.16, 1.32), new THREE.MeshStandardMaterial({ color: 0x709c50, roughness: 1 }), tops);
    let block = 0, top = 0;
    level.rows.forEach((row, y) => [...row].forEach((tile, x) => {
      if (tile !== '#') return;
      this.matrix.makeTranslation(x + 0.5, 18 - y - 0.5, -0.22); blocks.setMatrixAt(block++, this.matrix);
      if (level.rows[(y + 17) % 18][x] !== '#') { this.matrix.makeTranslation(x + 0.5, 18 - y + 0.015, -0.2); moss.setMatrixAt(top++, this.matrix); }
    }));
    this.terrain.add(blocks, moss);
  }
  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height;
    this.baseZ = Math.max(19.4, 33.8 / this.camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
    this.camera.position.z = this.baseZ; this.camera.updateProjectionMatrix();
  }
  draw(time: number, shake: number) {
    this.camera.position.x = 16 + Math.sin(time * 91) * shake;
    this.camera.position.y = 9 + Math.cos(time * 77) * shake * 0.6;
    this.layers.forEach((layer, i) => { layer.position.x = 16 + Math.sin(time * 0.13) * (i + 1) * 0.14; });
    this.renderer.render(this.scene, this.camera);
  }
}
