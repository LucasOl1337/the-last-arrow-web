import type { Meta, StoryObj } from '@storybook/html-vite';
import * as THREE from 'three';
import { ArenaScene } from './scene.ts';
import { FightersView } from './fighters.ts';
import { createWorld } from '../sim/world.ts';
import { BOW_LANDMARKS, skinnedLandmark } from './bow-landmarks.ts';

const meta = { title: 'Arena/Bow sockets', render: () => {
  const host = document.createElement('main'); host.style.cssText = 'width:100vw;height:100vh;overflow:hidden;background:#15202b';
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block'; host.append(canvas);
  const arena = new ArenaScene(canvas), fighters = new FightersView(arena.arena);
  const world = createWorld({ humans: 2, bots: 0, map: 'totem', seed: 3 }); world.phase = 'playing';
  world.fighters.forEach((f, i) => Object.assign(f, { character: i, x: i * 4, prevX: i * 4, y: 17.45, prevY: 17.45, grounded: true, invulnerable: 0, aimX: 1, aimY: 0, facing: 1 }));
  fighters.reset(world);
  arena.scene.background = new THREE.Color(0x15202b);
  // Remove only the empty arena backdrop/veil in this isolated inspector, never model art.
  (arena as any).atmosphere.visible = false; (arena as any).veil.visible = false;
  arena.scene.add(new THREE.HemisphereLight(0xffffff, 0x697888, 2.5));
  const lamp = new THREE.DirectionalLight(0xffffff, 3); lamp.position.set(1, 6, 5); arena.scene.add(lamp);
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 100);
  const markers = new THREE.Group(); arena.arena.add(markers);
  const legend = document.createElement('aside');
  legend.style.cssText = 'position:absolute;left:12px;top:12px;padding:8px;color:white;background:#101820dd;font:14px sans-serif;pointer-events:none'; host.append(legend);
  const controls = { character: 0, mode: 'rest', angle: 0, time: 0, markerVertices: [] as number[], ready: false, skinBefore: false,
    /** A/B only: use the untouched cached kit geometry without changing pose/material. */
    compareSkin(before: boolean) {
      this.skinBefore = before;
      let source: THREE.BufferGeometry | undefined;
      (fighters as any).kits.storm.template.traverse((o: any) => { if (o.isSkinnedMesh) source = o.geometry; });
      this.views()[1].rig.model.traverse((o: any) => {
        if (!o.isSkinnedMesh) return;
        o.userData.correctedSkin ??= o.geometry;
        o.geometry = before ? source : o.userData.correctedSkin;
      });
      this.draw();
    },
    views() { return (fighters as any).views; },
    rendererInfo() { const gl = arena.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); },
    mesh() { let found: THREE.SkinnedMesh | undefined; this.views()[this.character].rig.model.traverse((o: any) => { if (o.isSkinnedMesh && o.material.userData.uniforms) found = o; }); return found!; },
    pose(character: number, mode = 'rest', angle = 0) {
      if (character !== this.character) this.markerVertices = [];
      this.character = character; this.mode = mode; this.angle = angle;
      this.compareSkin(false);
      world.fighters.forEach(f => Object.assign(f, { crouching: false, grounded: true, vy: 0, aimX: 1, aimY: 0, facing: 1 }));
      if (mode === 'rest') {
        for (const v of this.views()) { v.rig.mixer.stopAllAction(); v.rig.pitchBase.clear(); v.rig.model.traverse((o: any) => { if (o.isSkinnedMesh) o.skeleton.pose(); }); v.pivot.rotation.set(0, 0, 0); }
      } else {
        fighters.reset(world);
        world.fighters.forEach(f => Object.assign(f, { charging: true, charge: .35 }));
        for (let i = 0; i < 120; i++) fighters.update(world, 1, i / 60, 1 / 60);
        if (mode === 'hold10s') for (let i = 0; i < 600; i++) fighters.update(world, 1, 2 + i / 60, 1 / 60);
        if (mode === 'inverted') {
          world.fighters.forEach(f => Object.assign(f, { aimX: -Math.SQRT1_2, aimY: -Math.SQRT1_2, facing: -1 }));
          for (let i = 0; i < 120; i++) fighters.update(world, 1, 2 + i / 60, 1 / 60);
        }
        if (mode === 'crouch' || mode === 'jump') {
          world.fighters.forEach(f => Object.assign(f, { crouching: mode === 'crouch', grounded: mode !== 'jump', vy: mode === 'jump' ? -5 : 0 }));
          fighters.update(world, 1, 3, 1 / 60);
        }
        if (mode === 'release') {
          world.fighters.forEach(f => { f.charging = false; fighters.event('shoot', f.id); }); fighters.update(world, 1, 3, 1 / 60);
        }
      }
      this.draw();
    },
    vertex(index: number) {
      const mesh = this.mesh();
      if (!Number.isInteger(index) || index < 0 || index >= mesh.geometry.getAttribute('position').count) throw new Error(`Vertex ${index} is not in selected character ${this.character}`);
      arena.scene.updateMatrixWorld(true); mesh.skeleton.update();
      const g = mesh.geometry, j = g.getAttribute('skinIndex'), w = g.getAttribute('skinWeight'), uv = g.getAttribute('uv');
      const p = skinnedLandmark(mesh, index);
      return { index, world: p.toArray(), uv: [uv.getX(index), uv.getY(index)], weights: [0,1,2,3].map(k => ({ bone: mesh.skeleton.bones[j.getComponent(index,k)].name, weight: w.getComponent(index,k) })).filter(x => x.weight > 0) };
    },
    mark(vertices: number[]) { this.markerVertices = vertices; this.draw(); },
    verified(show = true) {
      const definition = this.character === 0 ? BOW_LANDMARKS.mizu : BOW_LANDMARKS.storm;
      this.markerVertices = show ? definition.points.map(p => p.vertex) : [];
      this.draw();
    },
    highlight(triangles: number[]) {
      const mesh = this.mesh();
      if (!mesh.geometry.getAttribute('color')) mesh.geometry = mesh.geometry.clone();
      const colors = new Float32Array(mesh.geometry.getAttribute('position').count * 3); colors.fill(1);
      const indices = mesh.geometry.index!;
      for (const t of triangles) for (let k = 0; k < 3; k++) { const v = indices.getX(t * 3 + k); colors.set([1, .1, .6], v * 3); }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      (mesh.material as THREE.MeshStandardMaterial).vertexColors = true; (mesh.material as THREE.Material).needsUpdate = true;
      this.draw();
    },
    nearestVertex(x: number, y: number) {
      const mesh = this.mesh(); arena.scene.updateMatrixWorld(true); mesh.skeleton.update();
      let nearest = -1, pixels = Infinity;
      for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) {
        const p = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())).project(camera);
        const d = Math.hypot((p.x + 1) * host.clientWidth / 2 - x, (1 - p.y) * host.clientHeight / 2 - y);
        if (d < pixels) { pixels = d; nearest = i; }
      }
      return { pixels, vertex: this.vertex(nearest) };
    },
    pick(x: number, y: number) {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / host.clientWidth * 2 - 1, 1 - y / host.clientHeight * 2), camera);
      const hit = ray.intersectObject(this.mesh(), false)[0]; if (!hit?.face) return null;
      return { triangle: hit.faceIndex, point: hit.point.toArray(), uv: hit.uv?.toArray(), vertices: [hit.face.a, hit.face.b, hit.face.c].map(v => this.vertex(v)) };
    },
    draw() {
      if (!fighters.usingModels) return;
      this.views().forEach((v: any, i: number) => { v.root.visible = i === this.character; v.shadow.visible = false; v.backdrop.visible = false; v.nock.visible = !['rest', 'release'].includes(this.mode) && i === this.character; for (const d of v.aimDots) d.visible = false; v.aimPoint.visible = false; });
      legend.textContent = `${this.character === 0 ? 'Mizu: arco guardado nas costas' : 'Stormy: fragmento superior separado do grip'} · ${this.mode} · ${this.skinBefore ? 'ANTES: Middle3' : 'ATUAL: skin por instância'} · ${this.markerVertices.length ? `landmarks: ${this.markerVertices.join(', ')} (não sockets funcionais)` : 'asset limpo'}`;
      const v = this.views()[this.character], center = new THREE.Vector3(v.root.position.x, v.root.position.y + 1.2, .55);
      // Inspect from front (+X in normalized GLB), then orbit around Y; no game camera mutation.
      camera.position.copy(center).add(new THREE.Vector3(Math.cos(this.angle) * 5.4, .1, Math.sin(this.angle) * 5.4)); camera.lookAt(center);
      camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
      while (markers.children.length) { const child = markers.children[0] as THREE.Mesh; markers.remove(child); child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
      for (const index of this.markerVertices) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4aa6, depthTest: false }));
        dot.position.fromArray(this.vertex(index).world); dot.renderOrder = 100; markers.add(dot);
      }
      arena.renderer.render(arena.scene, camera);
    },
  };
  Object.assign(window, { __bowSockets: controls });
  const resize = new ResizeObserver(() => { arena.renderer.setSize(host.clientWidth, host.clientHeight, false); controls.draw(); }); resize.observe(host);
  const ready = () => {
    if (!host.isConnected) { resize.disconnect(); arena.renderer.dispose(); return; }
    if (!fighters.usingModels) { requestAnimationFrame(ready); return; }
    fighters.update(world, 1, 0, 0); controls.ready = true; controls.pose(0); host.dataset.models = 'true';
  }; requestAnimationFrame(ready);
  return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const Inspecao: Story = {};
