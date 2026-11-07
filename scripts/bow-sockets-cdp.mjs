// Interactive bounded inspection on an already-registered mission tab; no new pages.
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = '/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/evidencias/arco-sockets';
const [action, ...args] = process.argv.slice(2);
const cli = (...args) => JSON.parse(execFileSync('agent-bench', args, { encoding: 'utf8' }));
assert.ok(cli('fila').vagas.some(v => v.bench === 'arrow-arco-sockets'));
assert.equal(cli('status', 'arrow-arco-sockets').control_mode, 'agente');
assert.equal(cli('browser-status', 'arrow-arco-sockets').lives_in, 'arrow-arco-sockets');
const { tab } = JSON.parse(await readFile(`${root}/tab.json`, 'utf8'));
const endpoint = JSON.parse(await readFile(`${root}/cdp.json`, 'utf8'));
const browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl);
try {
 let page;
 for (const candidate of browser.contexts()[0].pages()) { const s = await candidate.context().newCDPSession(candidate); const {targetInfo} = await s.send('Target.getTargetInfo'); await s.detach(); if (targetInfo.targetId === tab) page=candidate; }
 assert.ok(page); await page.setViewportSize({width:1366,height:768}); await page.waitForSelector('main[data-models=true]');
 if (action === 'capture') {
  const [name, character, mode, angle] = args;
  await page.evaluate(({ character, mode, angle }) => window.__bowSockets.pose(character, mode, angle), {character:Number(character),mode,angle:Number(angle)});
  await page.screenshot({path:`${root}/${name}.png`,timeout:90000});
 } else if (action === 'pick') {
  const result = await page.evaluate(([x,y]) => window.__bowSockets.pick(x,y), args.map(Number)); console.log(JSON.stringify(result,null,2));
 } else if (action === 'mark') {
  const [name,...vertices] = args;
  const result = await page.evaluate(vertices => { const b=window.__bowSockets;b.mark(vertices);return vertices.map(v=>b.vertex(v)); },vertices.map(Number));
  await writeFile(`${root}/${name}.json`,JSON.stringify(result,null,2)); await page.screenshot({path:`${root}/${name}.png`,timeout:90000});
 } else if (action === 'component') {
  const [name, model, component] = args;
  const data = JSON.parse(await readFile(`${root}/${model}-topology.json`,'utf8'));
  const triangles = data.meshes[0].components[Number(component)].triangles;
  await page.evaluate(triangles=>window.__bowSockets.highlight(triangles),triangles);
  await page.screenshot({path:`${root}/${name}.png`,timeout:90000});
 } else if (action === 'eval') {
  const result=await page.evaluate(args[0]); console.log(JSON.stringify(result,null,2));
 } else throw new Error('Unknown action');
} finally { await browser.close(); }
