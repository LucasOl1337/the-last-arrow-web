import type { Meta, StoryObj } from '@storybook/html-vite';
import { ArenaScene } from './scene.ts';
import { FightersView } from './fighters.ts';
import { Hud } from './hud.ts';
import { createWorld } from '../sim/world.ts';

/** Fixed cases use the production canvas, HUD and 16:9 viewport, not a facsimile. */
const meta = { title: 'Arena/Camera legibilidade', render: (args: { close?: boolean; four?: boolean }) => {
  const app = document.createElement('div'); app.id = 'app';
  const host = document.createElement('main'); host.id = 'game'; app.append(host);
  const canvas = document.createElement('canvas'); host.append(canvas);
  const arena = new ArenaScene(canvas), fighters = new FightersView(arena.arena), hud = new Hud(); host.append(hud.element);
  const world = createWorld({ humans: 1, bots: args.four ? 3 : 1, map: 'totem', seed: 42 }); world.phase = 'playing';
  world.fighters.forEach((f, i) => Object.assign(f, { character: i % 2, x: i ? 30 : 2, prevX: i ? 30 : 2,
    y: 15.45, prevY: 15.45, grounded: true, invulnerable: 0, facing: i ? -1 : 1 }));
  arena.closeCamera = args.close ?? true; arena.setLevel(world.level); fighters.reset(world); hud.reset(world);
  const toggle = document.createElement('button'); toggle.className = 'camera-toggle'; host.append(toggle);
  const label = () => { toggle.textContent = arena.closeCamera ? 'Câmera: próxima' : 'Câmera: ampla'; }; label();
  toggle.onclick = () => { arena.closeCamera = !arena.closeCamera; label(); };
  const resize = new ResizeObserver(() => arena.resizeToCanvas()); resize.observe(canvas);
  const probe = { world, fighters, arena, hud, time: 20 };
  Object.assign(window, { __cameraBench: probe });
  const draw = () => {
    if (!host.isConnected) { resize.disconnect(); arena.renderer.dispose(); return; }
    const f = world.fighters[0]; arena.cameraTarget = f.alive ? { x: f.x, y: 18 - f.y } : undefined;
    fighters.update(world, 1, probe.time, 0); arena.draw(probe.time, 0); hud.update(world, false, arena.camera, probe.time);
    host.dataset.models = String(fighters.usingModels); requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw); return app;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const ProximaExtremos: Story = { args: { close: true } };
export const AmplaExtremos: Story = { args: { close: false } };
export const QuatroRetrato: Story = { args: { close: true, four: true } };
