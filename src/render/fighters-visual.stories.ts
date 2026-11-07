import type { Meta, StoryObj } from '@storybook/html-vite';
import { ArenaScene } from './scene.ts';
import { FightersView } from './fighters.ts';
import { createWorld } from '../sim/world.ts';

// The production renderer and simulation data, held still for like-for-like art reviews.
const meta = { title: 'Arena/Visual legivel', render: (args: { map?: string; aim?: boolean; close?: boolean; skills?: boolean }) => {
  const host = document.createElement('main');
  host.style.cssText = 'width:100vw;height:100vh;overflow:hidden';
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block'; host.append(canvas);
  const arena = new ArenaScene(canvas), fighters = new FightersView(arena.arena);
  const world = createWorld({ humans: 2, bots: 0, map: args.map ?? 'totem', seed: 3 }); world.phase = 'playing';
  world.fighters.forEach((f, i) => Object.assign(f, { character: i, x: 13 + i * 6, prevX: 13 + i * 6, y: 15.45, prevY: 15.45,
    grounded: true, invulnerable: 0, charging: args.aim ?? false, charge: .5, aimX: i ? -1 : 1, aimY: 0, facing: i ? -1 : 1 }));
  if (args.skills) world.fighters.forEach((f, i) => Object.assign(f, { skill: {
    kind: i ? 'storm-gust' : 'water-guard', time: i ? .12 : .5, x: f.x - 1, y: f.y, charges: i ? 0 : 1,
  } }));
  arena.closeCamera = args.close ?? true; arena.cameraTarget = { x: 16, y: 3 };
  arena.setLevel(world.level); fighters.reset(world);
  const resize = new ResizeObserver(() => arena.resize(host.clientWidth, host.clientHeight)); resize.observe(host);
  const probe = { world, fighters, arena, frozen: false, time: 0 };
  Object.assign(window, { __visualBench: probe });
  const draw = () => {
    if (!host.isConnected) { resize.disconnect(); arena.renderer.dispose(); return; }
    if (!probe.frozen) probe.time += 1 / 60;
    fighters.update(world, 1, probe.time, probe.frozen ? 0 : 1 / 60);
    arena.draw(probe.time, 0); host.dataset.models = String(fighters.usingModels);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw); return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const TexturaTotem: Story = { args: { map: 'totem' } };
export const TexturaMoss: Story = { args: { map: 'moss' } };
export const TexturaCanopy: Story = { args: { map: 'canopy' } };
export const Mira: Story = { args: { aim: true } };
export const Habilidades: Story = { args: { skills: true } };
