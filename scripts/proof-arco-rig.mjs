// Run only through scripts/proof-arco-rig.sh (bench + GPU lease + owned tab).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const bench = process.env.ARCO_RIG_BENCH ?? 'arrow-arco-rig', mission = process.env.ARCO_RIG_MISSION ?? 'arco-rig-1107';
const [beforeURL, afterURL, out] = process.argv.slice(2);
assert.ok(beforeURL && afterURL && out, 'before URL, after URL, output directory required');
const cli = (...args) => JSON.parse(execFileSync('agent-bench', args, { encoding: 'utf8' }));
const web = (...args) => JSON.parse(execFileSync('agent-bench-web', ['--bench', bench, '--mission', mission, ...args], { encoding: 'utf8' }));
assert.ok(cli('fila').vagas.some(v => v.bench === bench), 'GPU lease required');
const status = cli('status', bench), browserStatus = cli('browser-status', bench);
assert.equal(status.control_mode, 'agente');
assert.ok(status.workspace >= 26 && status.workspace <= 30, 'reserved agent workspace required');
assert.equal(browserStatus.lives_in, bench);
const endpoint = cli('cdp', bench);
const report = { kind: 'actual WebGL/GLB render; screenshots still require human/agent visual critique', bench, mission, errors: [], before: {}, after: {} };
let browser;
try {
  report.hygieneBefore = web('hygiene');
  const owned = process.env.TLA_TAB ? { tab: process.env.TLA_TAB } : null;
  if (owned) {
    assert.ok(report.hygieneBefore.own_tabs.some(t => (t.tab ?? t) === owned.tab), 'reused tab must belong to this mission');
    web('navigate', '--tab', owned.tab, '--url', beforeURL);
  } else assert.equal(report.hygieneBefore.own_tabs.length, 0, 'reconcile any previous run before restarting');
  const target = owned ?? web('open', '--url', beforeURL);
  browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl ?? `http://127.0.0.1:${endpoint.port}`);
  // Resolve by registered target ID, never by guessed URL or another mission's page.
  let page;
  for (const candidate of browser.contexts()[0].pages()) {
    const cdp = await candidate.context().newCDPSession(candidate);
    const { targetInfo } = await cdp.send('Target.getTargetInfo'); await cdp.detach();
    if (targetInfo.targetId === target.tab) { page = candidate; break; }
  }
  assert.ok(page, 'registered target must exist');
  page.on('pageerror', e => report.errors.push(String(e)));
  for (const [revision, url] of [['before', beforeURL], ['after', afterURL]]) {
    await page.setViewportSize({ width: 1366, height: 768 });
    if (revision === 'after') web('navigate', '--tab', target.tab, '--url', url);
    await page.waitForURL(url);
    await page.waitForSelector('main[data-models=true]');
    const samples = report[revision];
    const capture = async (name, operation) => {
      assert.ok(cli('fila').vagas.some(v => v.bench === bench), 'stop render on lost GPU lease');
      assert.equal(cli('status', bench).control_mode, 'agente', 'human handover pauses proof');
      samples[name] = await page.evaluate(({ operation }) => {
        const b = window.__arcoRigBench;
        const set = props => b.world.fighters.forEach(f => Object.assign(f, props));
        if (operation === 'idle') b.advance(30);
        if (operation === 'draw') { set({ charging: true, charge: 0 }); b.advance(); }
        if (operation === 'hold') { set({ charge: .35 }); b.advance(120); }
        if (operation === '10s') b.advance(600);
        if (operation === 'diagonal') { set({ aimX: Math.SQRT1_2, aimY: -Math.SQRT1_2 }); b.advance(120); }
        if (operation === 'turn') { set({ aimX: -Math.SQRT1_2, facing: -1 }); b.advance(); }
        if (operation === 'settled') b.advance(119);
        if (operation === 'crouch') { set({ crouching: true }); b.advance(); }
        if (operation === 'jump') { set({ crouching: false, grounded: false, vy: -5 }); b.advance(); }
        if (operation === 'preRelease') { set({ grounded: true, vy: 0 }); b.advance(120); }
        if (operation === 'release') b.release();
        if (operation === 'projectile') b.stepProjectile();
        const gl = b.arena.renderer.getContext();
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const views = b.fighters.views.map(v => {
          v.root.updateWorldMatrix(true, true);
          // Reuse Vector3 from a real object; no alternate renderer/math implementation.
          const hand = v.rig.bowHand.getWorldPosition(v.nock.position.clone());
          const tip = v.nock.localToWorld(v.nock.position.clone().set(.54, 0, 0));
          const tail = v.nock.localToWorld(v.nock.position.clone().set(-.19, 0, 0));
          return { character: v.character, state: v.state, visible: v.nock.visible, hand: hand.toArray(), tip: tip.toArray(),
            axisError: hand.clone().sub(tail).cross(tip.clone().sub(tail).normalize()).length(),
            animationTime: v.rig.actions[v.state].time,
            pitch: [v.rig.spine1, v.rig.spine2].map(bone => bone.quaternion.angleTo(v.rig.pitchBase.get(bone))) };
        });
        return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), views,
          arrows: b.world.arrows.map(a => ({ ...a })) };
      }, { operation });
      assert.doesNotMatch(samples[name].renderer, /swiftshader|llvmpipe|software/i, 'real GPU required');
      await page.screenshot({ path: `${out}/${revision}-${name}.png` });
    };
    await capture('idle', 'idle'); await capture('draw', 'draw'); await capture('hold', 'hold');
    await capture('hold10s', '10s'); await capture('diagonal', 'diagonal');
    await capture('diagonal10s', '10s'); await capture('turn-first-frame', 'turn');
    await capture('turned', 'settled'); await capture('crouch', 'crouch'); await capture('jump', 'jump');
    await capture('pre-release', 'preRelease');
    samples.viewport = [];
    for (const size of [{ width: 1366, height: 768 }, { width: 900, height: 1000 }, { width: 360, height: 800 }]) {
      assert.ok(cli('fila').vagas.some(v => v.bench === bench), 'GPU lease required');
      assert.equal(cli('status', bench).control_mode, 'agente');
      await page.setViewportSize(size);
      const gate = await page.evaluate(() => {
        const b = window.__arcoRigBench; b.arena.resize(innerWidth, innerHeight); b.arena.draw(b.time, 0);
        const r = document.querySelector('canvas').getBoundingClientRect();
        return { area: r.width * r.height / innerWidth / innerHeight, top: r.top, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(gate.area >= .4 && gate.top < size.height * .85 && !gate.overflow);
      samples.viewport.push({ size, gate });
      await page.screenshot({ path: `${out}/${revision}-${size.width}x${size.height}.png` });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await capture('release', 'release'); await capture('projectile', 'projectile');
  }
  for (const id of [0, 1]) {
    assert.ok(report.before['turn-first-frame'].views[id].axisError > .4, 'baseline defect must be present');
    assert.ok(report.after['turn-first-frame'].views[id].axisError < 1e-6);
    assert.equal(report.after.release.views[id].visible, false);
    assert.ok(Math.abs(report.after.release.views[id].animationTime - (.18 + 2 / 60)) < 1e-6);
    assert.notEqual(report.after.release.arrows[id].x, report.after.projectile.arrows[id].x);
    assert.deepEqual(report.before.release.arrows[id], report.after.release.arrows[id]);
    for (const bone of [0, 1]) assert.ok(Math.abs(report.after.diagonal.views[id].pitch[bone] - report.after.diagonal10s.views[id].pitch[bone]) < 1e-6);
  }
  assert.deepEqual(report.errors, []); report.mechanicalPassed = true;
} finally {
  // The mission registry owns lifecycle; closing the connection never closes others.
  try { report.finish = process.env.TLA_KEEP_TAB ? { retainedForNextProof: process.env.TLA_TAB } : web('finish'); report.hygieneAfter = web('hygiene'); }
  finally { await browser?.close(); await writeFile(`${out}/render-report.json`, JSON.stringify(report, null, 2)); }
}
