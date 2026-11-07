// Browser proof uses explicit SIMULATED Gamepad snapshots, never physical devices.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const out = process.env.TLA_OUT || '/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/evidencias/gamepad';
const browser = await chromium.connectOverCDP('http://127.0.0.1:19085');
const context = browser.contexts()[0];
// Only the page registered by bench_web for this mission.
let page;
for (const candidate of context.pages()) {
  const session = await context.newCDPSession(candidate);
  const { targetInfo } = await session.send('Target.getTargetInfo'); await session.detach();
  if (targetInfo.targetId === process.env.TLA_TAB) page = candidate;
}
assert.ok(page, 'mission page missing');
const results = [];
const errors = []; page.on('pageerror', e => errors.push(String(e)));
try {
  if (process.argv.includes('--story')) {
    const gateModule='/home/lol/.agents/skills/sitela/scripts/checa_tela.py';
    const measure=execFileSync('python',['-c',`import runpy;print(runpy.run_path('${gateModule}')['MEDIR_JS'])`],{encoding:'utf8'});
    for (const [width,height] of [[1366,768],[900,1000],[360,800]]) {
      await page.setViewportSize({width,height});
      await page.goto('http://127.0.0.1:6138/iframe.html?id=arena-controle-de-videogame--dois-controles-simulados&viewMode=story');
      await page.locator('.gamepad-status').waitFor(); await page.screenshot({path:`${out}/story-after-${width}.png`});
      const metrics = await page.evaluate(() => { const p=document.querySelector('.menu-content').getBoundingClientRect();return { horizontal:document.documentElement.scrollWidth>innerWidth, top:p.top, fraction:p.width*p.height/(innerWidth*innerHeight), status:document.querySelector('.gamepad-status').textContent }; });
      const gate=await page.evaluate(`(${measure.trim()})(['.menu-content',null,140])`);gate.largura=width;gate.rolagens_ate_principal=gate.principal_topo<height*.85?0:1;
      const failures=JSON.parse(execFileSync('python',['-c',`import runpy,json,sys;m=runpy.run_path('${gateModule}');print(json.dumps(m['julgar'](json.loads(sys.argv[1]),int(sys.argv[2]))))`,JSON.stringify(gate),String(height)],{encoding:'utf8'}));
      assert.equal(metrics.horizontal,false); results.push({width,height,...metrics,gate,failures});
    }
  } else { proof: {
    await page.setViewportSize({width:1366,height:768});
    await page.addInitScript(() => {
      window.simPads=[];
      Object.defineProperty(navigator,'getGamepads',{value:()=>window.simPads});
      window.setSimPad=(index,buttons=[],axes=[0,0])=>{window.simPads[index]={index,id:`SIMULATED-${index}`,connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,n)=>({pressed:buttons.includes(n),value:Number(buttons.includes(n))}))};};
    });
    await page.goto(process.env.TLA_PROOF_URL || 'http://127.0.0.1:5138/'); await page.locator('#mode').waitFor();
    await page.evaluate(()=>{window.setSimPad(3);window.setSimPad(6);window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>document.querySelector('.gamepad-status')?.textContent.includes('P1 + P2'));
    await page.evaluate(()=>document.querySelector('#mode').focus());
    await page.evaluate(()=>window.setSimPad(3,[15]));
    await page.waitForFunction(()=>document.querySelector('#mode').value==='2');
    await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(80);
    if (process.argv.includes('--menu-only')) {
      await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(80);
      await page.getByRole('button',{name:'Controles',exact:true}).focus();
      await page.evaluate(()=>window.setSimPad(3,[0]));
      await page.getByRole('heading',{name:'Controles',exact:true}).waitFor();
      await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(80);
      await page.evaluate(()=>window.setSimPad(3,[1])); await page.locator('#mode').waitFor();
      await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(80);
      await page.getByRole('button',{name:'Jogar online',exact:true}).focus();
      await page.evaluate(()=>window.setSimPad(3,[0])); await page.getByRole('heading',{name:'Duelo online'}).waitFor();
      await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(80);
      await page.evaluate(()=>window.setSimPad(3,[1])); await page.locator('#mode').waitFor();
      await page.evaluate(()=>window.setSimPad(3));
      await page.screenshot({path:`${out}/simulated-menu-desktop.png`});
      assert.deepEqual(errors,[]);writeFileSync(`${out}/menu-browser-results.json`,JSON.stringify({simulated:true,hardwareVerified:false,menuConfiguredTwoHumans:true,gamepadConfirmBackControls:true,gamepadConfirmBackOnline:true,errors},null,2));
      break proof;
    }
    // Two humans, no bot interference; no 3D until heavy slot is held.
    await page.evaluate(()=>{document.querySelector('#bots').value='0';document.querySelector('#bots').dispatchEvent(new Event('change')); document.querySelector('.menu-actions .primary').focus();window.setSimPad(3,[0]);});
    await page.waitForFunction(()=>window.__tla?.world.options.humans===2 && !document.querySelector('#game').hidden);
    await page.evaluate(()=>{window.setSimPad(3);window.setSimPad(6);});
    await page.waitForFunction(()=>window.__tla?.diagnostics().models);
    await page.waitForFunction(()=>window.__tla.world.phase==='playing' && window.__tla.world.fighters.slice(0,2).every(f=>f.grounded));
    const initial = await page.evaluate(()=>window.__tla.state());
    // P1/P2 isolated directions sampled using actual Controls, not physics test injection.
    await page.evaluate(()=>{window.setSimPad(3,[],[-1,0]);window.setSimPad(6,[],[1,0]);});
    await page.waitForTimeout(180);
    const moved=await page.evaluate(()=>window.__tla.state());
    assert.ok(moved.fighters[0].x<initial.fighters[0].x, 'P1 must move left after countdown');
    assert.ok(moved.fighters[1].x>initial.fighters[1].x, 'P2 must independently move right');
    assert.equal(await page.evaluate(()=>window.__tla.world.options.humans),2);
    results.push({case:'two simulated pads started and independently moved two humans',initial:initial.fighters.map(f=>({x:f.x,y:f.y})),moved:moved.fighters.map(f=>({x:f.x,y:f.y}))});
    await page.evaluate(()=>{window.setSimPad(3,[9]);window.setSimPad(6);});
    await page.waitForFunction(()=>window.__tla.state().paused);
    await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(80);
    await page.evaluate(()=>window.setSimPad(3,[0])); await page.waitForFunction(()=>!window.__tla.state().paused);
    await page.evaluate(()=>window.setSimPad(3)); await page.waitForTimeout(100);
    await page.evaluate(()=>window.setSimPad(3,[2]));
    await page.waitForFunction(()=>window.__tla.world.fighters[0].charging);
    const before=await page.evaluate(()=>({arrows:window.__tla.world.arrows.filter(a=>a.owner===0).length,ammo:window.__tla.world.fighters[0].ammo}));
    await page.evaluate(()=>{window.simPads[3]=null;});
    await page.waitForFunction(()=>!window.__tla.world.fighters[0].charging);
    const after=await page.evaluate(()=>({arrows:window.__tla.world.arrows.filter(a=>a.owner===0).length,ammo:window.__tla.world.fighters[0].ammo}));
    assert.deepEqual(after,before); results.push({case:'disconnect cancelled held draw without shooting',before,after});
    await page.evaluate(()=>window.setSimPad(8)); await page.waitForTimeout(80);
    await page.evaluate(()=>{window.setSimPad(8,[9]);}); await page.waitForFunction(()=>window.__tla.state().paused);
    await page.screenshot({path:`${out}/simulated-pause-desktop.png`});
    await page.evaluate(()=>window.setSimPad(8)); await page.waitForTimeout(80);
    await page.evaluate(()=>window.setSimPad(8,[1])); await page.waitForFunction(()=>!window.__tla.state().paused);
    await page.evaluate(()=>window.setSimPad(8)); await page.waitForTimeout(80);
    await page.evaluate(()=>window.setSimPad(8,[2]));
    await page.waitForFunction(()=>window.__tla.world.fighters[0].charging);
    const blurAmmo=await page.evaluate(()=>window.__tla.world.fighters[0].ammo);
    await page.evaluate(()=>{window.setSimPad(8,[2],[1,0]);window.dispatchEvent(new Event('blur'));});
    await page.waitForFunction(()=>window.__tla.state().paused && !window.__tla.world.fighters[0].charging);
    assert.equal(await page.evaluate(()=>window.__tla.world.fighters[0].ammo),blurAmmo);
    results.push({case:'blur pauses and cancels held draw without spending ammo',paused:true,ammo:blurAmmo});
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    // Pointer and persisted keyboard bindings remain available after gamepad.
    await page.getByRole('button',{name:'Controles',exact:true}).click();
    await page.screenshot({path:`${out}/controls-desktop.png`});
    await page.getByRole('button',{name:'Voltar',exact:true}).click();
    await page.getByRole('button',{name:'Voltar ao menu',exact:true}).click();
    await page.getByRole('button',{name:'Jogar online',exact:true}).click();
    await page.evaluate(()=>{window.setSimPad(8);window.setSimPad(6);}); await page.waitForTimeout(80);
    await page.evaluate(()=>window.setSimPad(8,[1]));
    await page.waitForFunction(()=>!document.querySelector('.full-menu').hidden);
    results.push({case:'online menu B/○ back preserves pointer navigation',passed:true});
    await page.screenshot({path:`${out}/connected-menu-desktop.png`});
  }}
  assert.deepEqual(errors,[]);
  if (!process.argv.includes('--menu-only')) writeFileSync(`${out}/${process.argv.includes('--story')?'story':'browser'}-results.json`,JSON.stringify({simulated:true,hardwareVerified:false,results,errors},null,2));
} finally { await browser.close(); }
