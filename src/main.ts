import './style.css';
import { createWorld, step, snapshot, DT, CHARACTERS } from './sim/world.ts';
import type { MatchOptions } from './sim/world.ts';
import { ArenaScene } from './render/scene.ts';
import { FightersView } from './render/fighters.ts';
import { ArrowsView } from './render/arrows.ts';
import { Effects } from './render/fx.ts';
import { ChestsView } from './render/chests.ts';
import { Hud } from './render/hud.ts';
import { Menu } from './ui/menu.ts';
import { Controls } from './ui/controls.ts';
import { TouchControls } from './ui/touch.ts';
import { AudioEngine } from './audio.ts';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? '1');
const app = document.querySelector<HTMLDivElement>('#app')!;
const game = document.createElement('main'); game.id = 'game'; game.setAttribute('aria-label', 'Arena de combate'); game.hidden = true;
const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'The Last Arrow — arena 3D'); game.append(canvas); app.append(game);
const flash = document.createElement('div'); flash.className = 'flash'; game.append(flash);
const audio = new AudioEngine(), hud = new Hud(); game.append(hud.element);
/** Per-fighter match stats for the victory screen (catches and stomps come from sim events). */
let stats: { kills: number; catches: number; stomps: number }[] = [];
let wasCharging: boolean[] = [];
function toggleMute() { audio.setMuted(!audio.muted); hud.setMuted(audio.muted); return audio.muted; }
hud.onMute = toggleMute;
let world = createWorld({ seed }), running = false, paused = false, timeScale = 1, accumulator = 0;
let arena: ArenaScene | null = null, fighters: FightersView, arrows: ArrowsView, fx: Effects, chests: ChestsView;
let lastTime = performance.now(), shownVictory = false, seenRound = 0;
let frames = 0, measuredSeconds = 0, frameMsTotal = 0, maxFrameMs = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const menu = new Menu({
  start: opts => startMatch(opts), resume: () => setPaused(false), rematch: () => startMatch(world.options),
  home: () => { running = false; paused = false; controls.active = false; controls.reset(); audio.setPaused(true); game.hidden = true; menu.show('menu'); },
  mute: toggleMute,
});
app.append(menu.element);
const controls = new Controls(() => { if (running && world.phase !== 'matchover') setPaused(!paused); }, () => { if (running && world.phase !== 'matchover') setPaused(true); });
window.addEventListener('keydown', event => {
  if (event.code !== 'KeyM' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if ((event.target as HTMLElement | null)?.closest?.('input, select, textarea')) return;
  if (!game.hidden) toggleMute();
});
// Touch layer only on coarse pointers (phones/tablets); keyboard and gamepad keep working alongside.
if (matchMedia('(pointer: coarse)').matches) { const touch = new TouchControls(); controls.touch = touch.state; game.append(touch.element); game.classList.add('touch'); }
function setPaused(value: boolean) {
  if (!running) return;
  paused = value; accumulator = 0; controls.reset(); controls.active = !paused; audio.setPaused(paused);
  if (paused) menu.show('pause'); else menu.hide();
}
function startMatch(opts: MatchOptions = {}) {
  try {
    if (!arena) {
      arena = new ArenaScene(canvas); fighters = new FightersView(arena.arena); arrows = new ArrowsView(arena.arena); fx = new Effects(arena.arena); chests = new ChestsView(arena.arena);
      fighters.onLand = (x, y, strength) => fx.land(x, y, strength);
      new ResizeObserver(() => { if (!game.hidden) arena!.resize(game.clientWidth, game.clientHeight); }).observe(game);
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); running = false; controls.active = false; menu.show('error'); });
    }
    world = createWorld({ ...opts, seed: opts.seed ?? seed });
    arena.setLevel(world.level); fighters.reset(world); hud.reset(world); fx.reset(); chests.reset();
    stats = world.fighters.map(() => ({ kills: 0, catches: 0, stomps: 0 })); wasCharging = world.fighters.map(() => false);
    seenRound = world.round; shownVictory = false; paused = false; running = true; timeScale = 1; accumulator = 0;
    frames = measuredSeconds = frameMsTotal = maxFrameMs = 0;
    controls.reset(); controls.active = true; menu.hide(); game.hidden = false;
    arena.resize(game.clientWidth, game.clientHeight); audio.setPaused(false); void audio.unlock().catch(() => {});
  } catch (error) { console.error(error); running = false; menu.show('error'); }
}
/** Stomp kills reset the killer's vy to exactly −10 while standing just above the victim (rules.checkStomps). */
function record(e: (typeof world.events)[number]) {
  const s = stats[e.actor];
  if (!s) return;
  if (e.type === 'catch') s.catches++;
  if (e.type === 'kill' && e.target !== undefined && e.target !== e.actor) {
    s.kills++;
    const killer = world.fighters[e.actor], victim = world.fighters[e.target];
    if (killer.vy === -10 && victim.y - killer.y > 0.5 && victim.y - killer.y < 1.2) s.stomps++;
  }
}
// Audio is unlocked by a real gesture; autoplay remains silent until the first interaction.
window.addEventListener('pointerdown', () => { void audio.unlock().catch(() => {}); }, { once: true });
window.addEventListener('keydown', () => { void audio.unlock().catch(() => {}); }, { once: true });
function frame(now: number) {
  const elapsed = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
  if (running && arena) {
    const start = performance.now();
    const intents = controls.sample();
    if (paused) controls.consumeEdges();
    if (!paused && world.phase !== 'matchover') {
      // Kill juice: 80 ms hitstop, then 0.3 s at 30% speed (skipped with reduced motion).
      const speed = timeScale * (reducedMotion ? 1 : fx.hitstop > 0 ? 0 : fx.slow > 0 ? 0.3 : 1);
      accumulator += elapsed * speed;
      let steps = 0;
      // At most 240 ticks/frame, enough for the 24x testing hook without a spiral of death.
      while (accumulator >= DT && steps++ < 240) {
        step(world, intents); controls.consumeEdges(); accumulator -= DT;
        if (world.round !== seenRound) { seenRound = world.round; fx.reset(); }
        for (const event of world.events) { fx.event(event, world); audio.event(event, world); fighters.event(event.type, event.actor); record(event); }
        world.fighters.forEach((f, id) => { if (f.charging && !wasCharging[id]) audio.draw(); wasCharging[id] = f.charging; });
        if (world.winner !== null && world.fighters[world.winner].score >= 5) { accumulator = 0; break; }
      }
    }
    // Test hook timeScale 0 freezes the sim only; poses keep animating so frozen states can be inspected.
    const animDt = paused ? 0 : elapsed * (timeScale || 1) * (!reducedMotion && fx.slow > 0 ? 0.3 : 1) * (!reducedMotion && fx.hitstop > 0 ? 0 : 1);
    fighters.update(world, paused || world.phase !== 'playing' ? 1 : accumulator / DT, now / 1000, animDt);
    arrows.update(world, now / 1000); chests.update(world, now / 1000); fx.update(paused ? 0 : elapsed, paused ? 0 : elapsed * timeScale, world);
    flash.style.opacity = reducedMotion ? '0' : String(fx.flash * 0.7);
    arena.draw(now / 1000, reducedMotion ? 0 : fx.shake, fx.focus, reducedMotion ? 0 : fx.zoom); hud.update(world, paused, arena.camera, now / 1000);
    if (world.phase === 'matchover' && !shownVictory) {
      shownVictory = true; controls.active = false;
      const winner = world.winner === null ? null : world.fighters[world.winner];
      menu.show('victory', winner ? CHARACTERS[winner.character].name : undefined, winner ? { ...stats[winner.id], score: winner.score } : undefined);
    }
    if (!paused && timeScale === 1) {
      frames++; measuredSeconds += elapsed; const cost = performance.now() - start;
      frameMsTotal += cost; maxFrameMs = Math.max(maxFrameMs, cost);
    }
  }
  requestAnimationFrame(frame);
}
window.__tla = {
  get world() { return world; },
  setTimeScale(value: number) { if (!Number.isFinite(value) || value < 0 || value > 24) throw new RangeError('Escala deve estar entre 0 e 24'); timeScale = value; accumulator = 0; },
  startMatch,
  state: () => ({ ...snapshot(world), paused, timeScale }),
  diagnostics: () => ({ frames, fps: measuredSeconds ? frames / measuredSeconds : 0, averageFrameWorkMs: frames ? frameMsTotal / frames : 0, maxFrameWorkMs: maxFrameMs,
    drawCalls: arena?.renderer.info.render.calls ?? 0, triangles: arena?.renderer.info.render.triangles ?? 0,
    geometries: arena?.renderer.info.memory.geometries ?? 0, textures: arena?.renderer.info.memory.textures ?? 0,
    models: fighters?.usingModels ?? false, modelError: fighters?.loadError ? String(fighters.loadError) : null,
    audioFailures: audio.failures, renderer: arena?.renderer.getContext().getParameter(arena.renderer.getContext().RENDERER) ?? null }),
};
if (params.get('autoplay') === 'bots4') startMatch({ humans: 0, bots: 4, seed, map: params.get('map') ?? undefined });
requestAnimationFrame(frame);
declare global {
  interface Window {
    __tla: {
      readonly world: ReturnType<typeof createWorld>;
      setTimeScale: (value: number) => void; startMatch: (opts?: MatchOptions) => void;
      state: () => ReturnType<typeof snapshot> & { paused: boolean; timeScale: number };
      diagnostics: () => { frames: number; fps: number; averageFrameWorkMs: number; maxFrameWorkMs: number; drawCalls: number; triangles: number; geometries: number; textures: number; models: boolean; modelError: string | null; audioFailures: string[]; renderer: unknown };
    };
  }
}
