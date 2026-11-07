import type { Meta, StoryObj } from '@storybook/html-vite';
import { ArenaScene } from './scene.ts';
import { FightersView } from './fighters.ts';
import { ArrowsView } from './arrows.ts';
import { createWorld } from '../sim/world.ts';
import { updateBow, stepArrows } from '../sim/arrows.ts';
import { emptyIntent } from '../sim/input.ts';

// Production renderers + real GLBs, deterministic controls, no fake bow or projectile.
const meta = { title: 'Arena/Arco rig', render: () => {
  const host = document.createElement('main'); host.style.cssText = 'width:100vw;height:100vh;overflow:hidden';
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block'; host.append(canvas);
  const arena = new ArenaScene(canvas), fighters = new FightersView(arena.arena), arrows = new ArrowsView(arena.arena);
  const world = createWorld({ humans: 2, bots: 0, map: 'totem', seed: 3 }); world.phase = 'playing';
  world.fighters.forEach((f, i) => Object.assign(f, { character: i, x: 13 + i * 6, prevX: 13 + i * 6,
    y: 15.45, prevY: 15.45, grounded: true, invulnerable: 0, aimX: 1, aimY: 0, facing: 1 }));
  arena.closeCamera = true; arena.cameraTarget = { x: 16, y: 3 };
  arena.setLevel(world.level); fighters.reset(world);
  const resize = new ResizeObserver(() => arena.resize(host.clientWidth, host.clientHeight)); resize.observe(host);
  const probe = { world, fighters, arrows, arena, time: 0,
    advance(count = 1) {
      for (let i = 0; i < count; i++) { this.time += 1 / 60; fighters.update(world, 1, this.time, 1 / 60); }
      arrows.update(world, this.time); arena.draw(this.time, 0);
    },
    release() {
      world.events.length = 0;
      world.fighters.forEach(f => updateBow(world, f, emptyIntent()));
      world.events.filter(e => e.type === 'shoot').forEach(e => fighters.event(e.type, e.actor!));
      this.advance();
    },
    stepProjectile() { stepArrows(world); this.advance(); },
  };
  Object.assign(window, { __arcoRigBench: probe });
  const draw = () => {
    if (!host.isConnected) { resize.disconnect(); arena.renderer.dispose(); return; }
    host.dataset.models = String(fighters.usingModels);
    // Frozen by default; all pose/time transitions are explicit through the probe.
    fighters.update(world, 1, probe.time, 0); arrows.update(world, probe.time); arena.draw(probe.time, 0);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw); return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const HoldRelease: Story = {};
