import type { Meta, StoryObj } from '@storybook/html-vite';
import { ArenaScene } from '../render/scene.ts';
import { FightersView } from '../render/fighters.ts';
import { createWorld } from '../sim/world.ts';

// Actual production renderer, same four models, deterministic poses (not a second implementation).
const meta = { title: 'Arena/Animacao real', render: () => {
  const host = document.createElement('main'); host.id = 'game';
  const canvas = document.createElement('canvas'); host.append(canvas);
  const arena = new ArenaScene(canvas), fighters = new FightersView(arena.arena);
  const world = createWorld({ humans: 1, bots: 3, map: 'totem', seed: 3 }); world.phase = 'playing';
  world.fighters.forEach((f, i) => Object.assign(f, { x: 8 + 5 * i, prevX: 8 + 5 * i, y: 15.45, prevY: 15.45, grounded: true, invulnerable: 0, charging: true, charge: .5, aimX: i % 2 ? -1 : 1, aimY: 0, facing: i % 2 ? -1 : 1 }));
  arena.setLevel(world.level); fighters.reset(world);
  const resize = new ResizeObserver(() => arena.resize(host.clientWidth, host.clientHeight)); resize.observe(host);
  let last = performance.now();
  const draw = (now: number) => {
    if (!host.isConnected) { resize.disconnect(); arena.renderer.dispose(); return; }
    fighters.update(world, 1, now / 1000, Math.min(.05, (now - last) / 1000)); last = now;
    arena.draw(now / 1000, 0, undefined, 0); host.dataset.models = String(fighters.usingModels);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const TiroEmPe: Story = {};
