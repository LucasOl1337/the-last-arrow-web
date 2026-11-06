import {spawn} from 'node:child_process';
import {writeFile,appendFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
assert.equal(process.env.DISPLAY, ':80');
const out='evidence/rodada-9', report={owner:'tla-rodada-9-visibility',pid:process.pid,errors:[]};
const event=type=>appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:report.owner,pid:process.pid,bench:'tla',type})+'\n');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4176','--strictPort'],{stdio:'ignore'});
// Native CDP in tla's validated conventional Chromium. Only the new mission window is ours.
let ownedTarget;
let socket,sequence=0; const pending=new Map();
function send(method,params={},sessionId){const id=++sequence;return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},20000);
 pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params,sessionId}));
});}
try {
 let version;
 for(let n=0;n<100;n++){try {if((await fetch('http://127.0.0.1:4176/the-last-arrow-web/')).ok){version=await(await fetch('http://127.0.0.1:19080/json/version')).json();break;}}catch{} await delay(100);}
 assert.ok(version);
 socket=new WebSocket(version.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails);});
 const {targetInfos}=await send('Target.getTargets'); report.existingPages=targetInfos.filter(t=>t.type==='page').map(t=>t.targetId);assert.ok(report.existingPages.length<11);
 const {targetId}=await send('Target.createTarget',{url:'about:blank',newWindow:true});ownedTarget=targetId;
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(m,p={})=>send(m,p,sessionId);
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{const until=Date.now()+20000;while(Date.now()<until){if(await evaluate(expression))return;await delay(100);}throw new Error(`Wait failed: ${expression}`);};
 const shot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${name}.png`,Buffer.from(data,'base64'));};
 await call('Page.enable');await call('Runtime.enable');await event('open');
 await call('Page.navigate',{url:'http://127.0.0.1:4176/the-last-arrow-web/?seed=3'});
 await wait('!!window.__tla');
 await evaluate("document.querySelector('.match-config').requestSubmit()");
 await wait("window.__tla.diagnostics().models && window.__tla.world.phase==='playing'");
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'j',code:'KeyJ',windowsVirtualKeyCode:74});
 await delay(150);
 await evaluate("window.visibilityEvents=[];document.addEventListener('visibilitychange',()=>window.visibilityEvents.push({hidden:document.hidden,tick:window.__tla.world.tick}));true");
 const second=await send('Target.createTarget',{url:'data:text/html,<title>Outra aba da prova</title>',newWindow:false});await event('visibility-tab-open');
 try {
  await send('Target.activateTarget',{targetId:second.targetId});await wait('document.hidden');
  report.hidden=await evaluate('({hidden:document.hidden,state:window.__tla.state()})');await delay(1500);
  report.afterHidden=await evaluate('window.__tla.state()');assert.equal(report.hidden.state.tick,report.afterHidden.tick);assert.equal(report.afterHidden.paused,true);
 }finally{await send('Target.closeTarget',{targetId:second.targetId});await event('visibility-tab-close');}
 await send('Target.activateTarget',{targetId});await wait('!document.hidden');
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'j',code:'KeyJ',windowsVirtualKeyCode:74});
 await shot('aba-retomada-pausada');
 await evaluate("[...document.querySelectorAll('.overlay-panel button')].find(b=>b.textContent==='Continuar').click()");
 await wait(`window.__tla.world.tick>${report.afterHidden.tick+12}`);
 report.returned=await evaluate('({state:window.__tla.state(),events:window.visibilityEvents})');
 assert.equal(report.returned.state.fighters[0].ammo,3);assert.ok(report.returned.events.some(e=>e.hidden)&&report.returned.events.some(e=>!e.hidden));
 await shot('aba-retomada-jogando');assert.deepEqual(report.errors,[]);
} catch(e){report.failure=String(e.stack);throw e;}
finally{
 if(ownedTarget)await send('Target.closeTarget',{targetId:ownedTarget});
 if(socket){
  // closeTarget acknowledges the request before destruction appears in getTargets.
  for(let n=0;n<30;n++){
   report.remainingPages=(await send('Target.getTargets')).targetInfos.filter(t=>t.type==='page').map(t=>t.targetId);
   if(!report.remainingPages.includes(ownedTarget))break;await delay(100);
  }
  socket.close();
 }
 server.kill();await event('close');report.pagesAtEnd=report.remainingPages?.includes(ownedTarget)?1:0;await writeFile(`${out}/visibility-report.json`,JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));
