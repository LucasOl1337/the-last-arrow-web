import type { Meta, StoryObj } from '@storybook/html-vite';
import * as THREE from 'three';
import { TouchControls } from './touch.ts';
import { Hud } from '../render/hud.ts';
import { createWorld } from '../sim/world.ts';

// Production pad + HUD, no duplicate UI. Synthetic world, no render loop/GPU.
const meta = { title: 'Arena/Toque real', render: () => {
  const host = document.createElement('main'); host.id = 'game'; host.className = 'touch'; host.style.background = '#244049';
  const world = createWorld({ humans: 1, bots: 3 });
  const camera = new THREE.OrthographicCamera(-.9, 32.9, 18.7, -.7, .1, 100); camera.position.z = 40; camera.updateMatrixWorld();
  const hud = new Hud(); hud.reset(world);
  const touch = new TouchControls(); host.append(hud.element, touch.element);
  requestAnimationFrame(() => hud.update(world, false, camera, 10));
  const app = document.createElement('div'); app.id = 'app'; app.append(host); return app;
} } satisfies Meta;
export default meta;
export const Countdown: StoryObj = {};
