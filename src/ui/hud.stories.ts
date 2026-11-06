import type { Meta, StoryObj } from '@storybook/html-vite';
import * as THREE from 'three';
import { Hud } from '../render/hud.ts';
import { createWorld } from '../sim/world.ts';

// Real production HUD, exact edge/crossing case found during rodada-4 autoplay.
const meta = { title: 'Arena/HUD real', render: () => {
  const host = document.createElement('main'); host.id = 'game';
  host.style.background = '#244049';
  const world = createWorld({ humans: 0, bots: 4, map: 'moss', seed: 3 }); world.phase = 'playing';
  const poses = [[0, .2], [16, 1.1], [16.1, 1.1], [32, 9]];
  world.fighters.forEach((f, id) => { f.x = poses[id][0]; f.y = poses[id][1]; });
  const camera = new THREE.OrthographicCamera(-.9, 32.9, 18.7, -.7, .1, 100);
  camera.position.z = 40; camera.updateMatrixWorld();
  const hud = new Hud(); hud.reset(world); host.append(hud.element);
  requestAnimationFrame(() => hud.update(world, false, camera, 10));
  return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const BordasENomesCruzados: Story = {};
