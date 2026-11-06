import { proof, fingers, center, instrument } from './bench-rodada-8.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';

await proof('mobile', async ({ page, cdp, base, report, shot }) => {
  report.viewports = {};
  const touch = fingers(cdp);
  const events = () => page.evaluate(() => window.events8);
  for (const [width,height] of [[844,390],[932,430],[390,844]]) {
    await page.setViewportSize({ width,height });
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled:true });
    await page.goto(`${base}?seed=3`);
    const entry = { dimensions:`${width}x${height}`, clickCount:0 };
    await shot(`menu-${width}x${height}`);
    await page.getByRole('button', { name:'Começar partida' }).tap(); entry.clickCount++;
    await instrument(page);
    if (width < height) {
      await page.locator('.rotate-notice').waitFor({ state:'visible' });
      entry.portraitTick = await page.evaluate(() => window.__tla.state().tick);
      await delay(350); assert.equal(await page.evaluate(() => window.__tla.state().tick), entry.portraitTick);
      await shot('portrait-390x844'); await page.setViewportSize({ width:844,height:390 });
    }
    await page.locator('.controls-hint').waitFor();
    entry.hint = await page.locator('.controls-hint').textContent();
    if (width > height) await shot(`countdown-${width}x${height}`);
    await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.state().phase==='playing');
    entry.readyMs = await page.evaluate(() => performance.now());
    const shoot = await center(page.locator('.shoot'));
    await touch.down(2,shoot.x,shoot.y); entry.clickCount++; await delay(180); await touch.up(2);
    await page.waitForFunction(() => window.events8.some(e => e.actor===0 && e.type==='shoot'));
    entry.firstShotMs = await page.evaluate(() => window.events8.find(e => e.actor===0 && e.type==='shoot').at);
    assert.equal(entry.clickCount,2);
    assert.deepEqual(await page.evaluate(() => window.__tla.state().fighters.map(f => f.human)), [true,false,false,false]);
    // Pilot P1 at real speed in the unchanged match with stick + jump/shoot/dash.
    const walk = async (direction, action, ms) => {
      const stick = await center(page.locator('.touch-stick'));
      await touch.down(1,stick.x,stick.y); await touch.move(1,stick.x+direction*30,stick.y);
      if (action) { const b=await center(page.locator(`.${action}`)); await touch.down(2,b.x,b.y); }
      await delay(ms);
      if (action) await touch.up(2); await touch.up(1);
    };
    await walk(1,'jump',200); await walk(1,'shoot',320); await walk(-1,'dash',150); await walk(-1,null,500);
    await walk(-1,'jump',180); await walk(1,'shoot',350); await walk(1,null,800);
    await shot(`jogo-${width < height ? 'apos-girar-' : ''}${width}x${height}`);
    entry.events = await events(); entry.state = await page.evaluate(() => window.__tla.state());
    entry.layout = await page.evaluate(() => ({ width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollX,scrollY,scale:visualViewport.scale, font:getComputedStyle(document.querySelector('.score-card b')).fontSize }));
    assert.equal(entry.layout.scale,1); assert.equal(entry.layout.scrollX,0); assert.equal(entry.layout.scrollY,0); assert.equal(entry.layout.width,entry.layout.scrollWidth);
    const arena=await page.locator('#game').boundingBox(), stick=await page.locator('.touch-stick').boundingBox(), buttons=await page.locator('.touch-buttons').boundingBox();
    assert.ok(stick.x+stick.width<=arena.x+.5 && buttons.x>=arena.x+arena.width-.5, 'controls do not cover combat');
    entry.gate=await checkScreen(page,'#game'); assert.ok(entry.gate.passou);
    // Complete the same P1+3 bots match; acceleration only after real-time play.
    await page.evaluate(() => window.__tla.setTimeScale(24));
    await page.waitForFunction(() => window.__tla.state().phase==='matchover',null,{timeout:60000});
    entry.finish=await page.evaluate(() => window.__tla.state()); assert.equal(entry.finish.fighters[entry.finish.winner].score,5);
    await shot(`vitoria-${width < height ? 'apos-girar-' : ''}${width}x${height}`);
    report.viewports[`${width}x${height}`]=entry;
    console.log('mobile-match',width,height,entry.firstShotMs);
  }
  report.errorsFromAudio=await page.evaluate(()=>window.__tla.diagnostics().audioFailures); assert.deepEqual(report.errorsFromAudio,[]);
}, {mobile:true});
