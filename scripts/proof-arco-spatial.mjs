// One-shot diagnostic render. Never declares the unresolved spatial gap fixed.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bench = 'arrow-arco-espacial', mission = 'arco-espacial-1107';
const [url, out, cpuPath] = process.argv.slice(2);
assert.ok(url && out && cpuPath);
const cli = (...args) => JSON.parse(execFileSync('agent-bench', args, { encoding: 'utf8' }));
const web = (...args) => JSON.parse(execFileSync('agent-bench-web', ['--bench', bench, '--mission', mission, ...args], { encoding: 'utf8' }));
const guard = () => {
  assert.ok(cli('fila').vagas.some(v => v.bench === bench), 'GPU lease required');
  const status = cli('status', bench); assert.equal(status.control_mode, 'agente');
  assert.ok(status.workspace >= 26 && status.workspace <= 30);
};
guard(); assert.equal(cli('browser-status', bench).lives_in, bench);
const endpoint = cli('cdp', bench);
const cpu = JSON.parse(await readFile(cpuPath, 'utf8'));
const report = { kind: 'diagnosis of published runtime, no product correction', errors: [], cases: {}, viewport: [] };
let browser;
try {
  report.hygieneBefore = web('hygiene'); assert.equal(report.hygieneBefore.own_tabs.length, 0);
  const owned = web('open', '--url', url);
  browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl ?? `http://127.0.0.1:${endpoint.port}`);
  let page;
  for (const candidate of browser.contexts()[0].pages()) {
    const session = await candidate.context().newCDPSession(candidate);
    const { targetInfo } = await session.send('Target.getTargetInfo'); await session.detach();
    if (targetInfo.targetId === owned.tab) { page = candidate; break; }
  }
  assert.ok(page); page.on('pageerror', e => report.errors.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForSelector('main[data-models=true]');
  const sample = async (name, operation, screenshot = true) => {
    guard();
    report.cases[name] = await page.evaluate(operation => {
      const b = window.__arcoRigBench, set = p => b.world.fighters.forEach(f => Object.assign(f, p));
      if (operation === 'idle') b.advance(30);
      if (operation === 'draw') { set({ charging: true, charge: 0 }); b.advance(); }
      if (operation === 'hold') { set({ charge: .35 }); b.advance(120); }
      if (operation === '10s') b.advance(600);
      if (operation === 'diagonal') { set({ aimX: Math.SQRT1_2, aimY: -Math.SQRT1_2 }); b.advance(120); }
      if (operation === 'turn') { set({ aimX: -Math.SQRT1_2, facing: -1 }); b.advance(); }
      if (operation === 'settled') b.advance(119);
      if (operation === 'crouch') { set({ crouching: true }); b.advance(); }
      if (operation === 'jump') { set({ crouching: false, grounded: false, vy: -5 }); b.advance(); }
      if (operation === 'preRelease') { set({ grounded: true, vy: 0, vx: 0 }); b.advance(120); }
      if (operation === 'markers') b.showSpatialMarkers(true);
      if (operation === 'release') { b.showSpatialMarkers(false); b.release(); }
      if (operation === 'projectile') b.stepProjectile();
      const gl = b.arena.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        spatial: b.spatial(), visual: b.fighters.inspect(), arrows: structuredClone(b.world.arrows) };
    }, operation);
    assert.doesNotMatch(report.cases[name].renderer, /swiftshader|llvmpipe|software/i);
    if (screenshot) await page.screenshot({ path: `${out}/${name}.png` });
  };
  await sample('idle', 'idle', false); await sample('draw', 'draw', false); await sample('hold', 'hold', false);
  await sample('hold10s', '10s'); await sample('diagonal', 'diagonal', false); await sample('diagonal10s', '10s', false);
  await sample('turn-first', 'turn'); await sample('turned', 'settled', false);
  await sample('crouch', 'crouch'); await sample('jump', 'jump');
  await sample('case-clean', 'preRelease'); await sample('case-diagnostic', 'markers');
  for (const i of [0, 1]) {
    const probe = report.cases['case-clean'].spatial[i], expected = cpu.characters[i].probe;
    for (const key of ['gap', 'armReachBound', 'withClavicleBound', 'minErrorFixedClavicle', 'targetAboveFeet']) {
      assert.ok(Math.abs(probe[key] - expected[key]) < 1e-6, `${i}/${key}: GPU fixture matches CPU case`);
    }
    assert.ok(probe.minErrorFixedClavicle > .4);
  }
  for (const size of [{ width: 900, height: 1000 }, { width: 360, height: 800 }]) {
    guard(); await page.setViewportSize(size);
    const result = await page.evaluate(() => {
      const b = window.__arcoRigBench; b.showSpatialMarkers(false); b.arena.resize(innerWidth, innerHeight); b.arena.draw(b.time, 0);
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { area: r.width * r.height / innerWidth / innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(result.area >= .4 && !result.overflow); report.viewport.push({ size, result });
    await page.screenshot({ path: `${out}/case-${size.width}x${size.height}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await sample('release', 'release'); await sample('projectile-next-step', 'projectile');
  for (const i of [0, 1]) {
    assert.equal(report.cases.release.visual[i].nock, null);
    assert.notEqual(report.cases.release.arrows[i].x, report.cases['projectile-next-step'].arrows[i].x);
  }
  assert.deepEqual(report.errors, []); report.diagnosisConfirmed = true; report.spatialCorrectionApproved = false;
} finally {
  try { report.finish = web('finish'); report.hygieneAfter = web('hygiene'); }
  finally { await browser?.close(); await writeFile(`${out}/render-report.json`, JSON.stringify(report, null, 2)); }
}
