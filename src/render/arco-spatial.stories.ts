import type { Meta, StoryObj } from '@storybook/html-vite';
import * as THREE from 'three';
import RigMeta from './arco-rig.stories.ts';
import { HEIGHT } from '../sim/level.ts';
import { spatialProbe } from './arco-spatial-probe.ts';

// Same production story. Markers are explicitly diagnostic and never imported by the game.
const meta = { title: 'Arena/Arco espacial', render: () => {
  const host = RigMeta.render();
  const bench = (window as any).__arcoRigBench;
  const points = new THREE.Group(); points.name = 'DIAGNOSTIC ONLY: arrow tip / physical spawn';
  bench.arena.arena.add(points); points.visible = false;
  const materials = [new THREE.MeshBasicMaterial({ color: 0xffba55, depthTest: false }), new THREE.MeshBasicMaterial({ color: 0xff4ac8, depthTest: false })];
  const geometry = new THREE.SphereGeometry(.045, 8, 6);
  const markers = [0, 1].map(() => materials.map(material => {
    const dot = new THREE.Mesh(geometry, material); dot.renderOrder = 100; points.add(dot); return dot;
  }));
  const lines = [0, 1].map(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffba55, depthTest: false }));
    line.renderOrder = 100; points.add(line); return line;
  });
  Object.assign(bench, {
    spatial() {
      return bench.fighters.views.map((v: any, i: number) => {
        const f = bench.world.fighters[i];
        const spawn = new THREE.Vector3(f.x + f.aimX * .22, HEIGHT - (f.y + f.aimY * .22), .8);
        return spatialProbe(v.rig.model, v.nock, v.root, f.aimX, f.aimY, spawn);
      });
    },
    showSpatialMarkers(show = true) {
      points.visible = show;
      if (show) bench.spatial().forEach((p: ReturnType<typeof spatialProbe>, i: number) => {
        markers[i][0].position.fromArray(p.tip); markers[i][1].position.fromArray(p.spawn);
        const attr = lines[i].geometry.getAttribute('position') as THREE.BufferAttribute;
        attr.setXYZ(0, ...p.tip as [number, number, number]); attr.setXYZ(1, ...p.spawn as [number, number, number]); attr.needsUpdate = true;
      });
      bench.arena.draw(bench.time, 0);
    },
  });
  // Legend appears only in the diagnostic capture, not the clean production view.
  const legend = document.createElement('aside');
  legend.textContent = 'DIAGNÓSTICO — âmbar: ponta empunhada · rosa: origem física · linha: distância (não é trajetória)';
  legend.style.cssText = 'position:absolute;left:12px;top:12px;background:#111d;color:white;padding:8px;font:14px sans-serif;pointer-events:none;display:none';
  host.append(legend);
  const original = bench.showSpatialMarkers;
  bench.showSpatialMarkers = (show: boolean) => { legend.style.display = show ? 'block' : 'none'; original.call(bench, show); };
  return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const Diagnostico: Story = {};
