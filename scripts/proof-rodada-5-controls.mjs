import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { proof } from './bench-rodada-5.mjs';

await proof('controls', async ({ page, report, base, shot }) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models);
  const keys = page.keyboard;
  const fighter = () => page.evaluate(() => {
    const f = window.__tla.world.fighters[0];
    return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, aimX: f.aimX, aimY: f.aimY, ammo: f.ammo, grounded: f.grounded, charging: f.charging };
  });
  // Explicit checkpoint fixtures on shipped maps; only starting placement changes.
  // Actual actions use Playwright keyboard and the normal 120 Hz loop, with 3 active bots.
  const setup = async (map, placement, target = null) => {
    await page.evaluate(({ map, placement, target }) => {
      window.__tla.startMatch({ humans: 1, bots: 3, map, seed: 3 });
      const w = window.__tla.world; w.phase = 'playing'; w.countdown = 0;
      Object.assign(w.fighters[0], placement);
      if (target) Object.assign(w.fighters[1], target);
      window.controlEvents = [];
      const push = w.events.push;
      w.events.push = function (...events) { window.controlEvents.push(...events.map(e => ({ ...e, tick: w.tick }))); return push.apply(this, events); };
    }, { map, placement, target });
  };
  const events = () => page.evaluate(() => window.controlEvents);
  await setup('moss', { x: 5, prevX: 5, y: 15.45, prevY: 15.45, grounded: true });
  await keys.down('KeyJ');
  report.directions = [];
  // The eight named product directions, not generated input variations.
  for (const [names, x, y] of [
    [['KeyD'], 1, 0], [['KeyD', 'KeyW'], 1, -1], [['KeyW'], 0, -1], [['KeyW', 'KeyA'], -1, -1],
    [['KeyA'], -1, 0], [['KeyA', 'KeyS'], -1, 1], [['KeyS'], 0, 1], [['KeyS', 'KeyD'], 1, 1],
  ]) {
    for (const k of names) await keys.down(k);
    await delay(65); const f = await fighter();
    assert.equal(Math.sign(f.aimX), x); assert.equal(Math.sign(f.aimY), y);
    assert.ok(Math.abs(Math.hypot(f.aimX, f.aimY) - 1) < 1e-8);
    for (const k of names) await keys.up(k);
    await delay(25); const retained = await fighter();
    assert.equal(retained.aimX, f.aimX); assert.equal(retained.aimY, f.aimY, 'draw retains aim after releasing direction');
    report.directions.push({ names, aim: [f.aimX, f.aimY] });
  }
  await shot('p1-mira-diagonal'); await keys.up('KeyJ');
  await delay(30); assert.ok((await events()).some(e => e.actor === 0 && e.type === 'shoot'));

  await setup('moss', { x: 9.95, prevX: 9.95, y: 15.45, prevY: 15.45, grounded: true });
  await keys.down('KeyD');
  await page.waitForFunction(() => { const f = window.__tla.world.fighters[0]; return !f.grounded && f.x > 10.32; }, undefined, { polling: 'raf' });
  report.ledgeBefore = await fighter();
  await keys.down('KeyK'); await delay(35); report.ledgeJump = await fighter();
  assert.ok(report.ledgeJump.vy < -10, 'coyote jump after leaving bottom platform');
  await keys.up('KeyK'); await keys.up('KeyD');

  await setup('moss', { x: 5, prevX: 5, y: 14.8, prevY: 14.8, vy: 12 });
  await keys.down('Space');
  await delay(90); report.bufferedJump = await fighter();
  assert.ok((await events()).some(e => e.type === 'jump' && e.actor === 0), 'jump queued shortly before landing');
  assert.ok(report.bufferedJump.vy < -10); await keys.up('Space');

  report.wrap = {};
  for (const [name, placement, held, done] of [
    ['right', { x: 31.8, y: 4, vx: 7.8 }, ['KeyD'], 'right'],
    ['left', { x: .2, y: 4, vx: -7.8 }, ['KeyA'], 'left'],
    ['bottom', { x: 16, y: 17.8, vy: 19 }, ['KeyS'], 'bottom'],
    ['top', { x: 1, y: .15, vy: -16 }, ['KeyK'], 'top'],
  ]) {
    await setup('falls', { ...placement, prevX: placement.x, prevY: placement.y });
    for (const k of held) await keys.down(k);
    await page.waitForFunction(side => { const f = window.__tla.world.fighters[0]; return side === 'right' ? f.x < 2 : side === 'left' ? f.x > 30 : side === 'bottom' ? f.y < 2 : f.y > 16; }, done, { timeout: 1000 });
    report.wrap[name] = await fighter();
    for (const k of held) await keys.up(k);
  }

  await setup('moss', { x: 5, prevX: 5, y: 15.45, prevY: 15.45, grounded: true });
  await keys.down('KeyS'); await keys.down('KeyJ'); await delay(45); await keys.up('KeyJ');
  await delay(75); await keys.up('KeyS'); report.pickup = { events: await events(), fighter: await fighter() };
  assert.ok(report.pickup.events.some(e => e.actor === 0 && e.type === 'pickup'), 'recover arrow fired into the floor');
  assert.equal(report.pickup.fighter.ammo, 3);

  await setup('moss', { x: 5, prevX: 5, y: 14.25, prevY: 14.25, vy: 6 },
    { x: 5, prevX: 5, y: 15.45, prevY: 15.45, grounded: true, invulnerable: 0 });
  await keys.down('KeyS');
  await page.waitForFunction(() => window.controlEvents.some(e => e.type === 'kill' && e.actor === 0 && e.target === 1));
  await keys.up('KeyS'); report.stomp = { events: await events(), fighter: await fighter() };
  assert.ok(report.stomp.fighter.vy < 0, 'stomp bounces P1'); await shot('p1-pisao');

  // Controller API simulation, not a physical controller test.
  await page.evaluate(() => {
    window.testPad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testPad] });
  });
  await setup('moss', { x: 5, prevX: 5, y: 15.45, prevY: 15.45, grounded: true });
  await page.evaluate(() => { window.testPad.axes = [1, -1]; window.testPad.buttons[0].pressed = true; window.testPad.buttons[2].pressed = true; });
  await delay(80); report.padAimJump = await fighter();
  assert.ok(report.padAimJump.vy < -10 && report.padAimJump.charging && report.padAimJump.aimX > .7 && report.padAimJump.aimY < -.7);
  await page.evaluate(() => { window.testPad.buttons[0].pressed = false; window.testPad.buttons[2].pressed = false; window.testPad.buttons[1].pressed = true; });
  await delay(50); report.padEvents = await events();
  assert.ok(report.padEvents.some(e => e.actor === 0 && e.type === 'dash'));
  assert.ok(report.padEvents.some(e => e.actor === 0 && e.type === 'shoot'));
  await page.evaluate(() => { window.testPad = null; });
});
