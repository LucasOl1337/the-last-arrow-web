import {chromium} from '/home/lol/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const [name='before']=process.argv.slice(2),out=new URL('./evidence-clean/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const b=await chromium.connectOverCDP('http://127.0.0.1:19087');
try{
 let page;for(const p of b.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const{targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId==='52A30C6DAE0172CB2CD7F8BF469B48CE')page=p;}
 if(!page)throw Error('owned tab missing');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.bringToFront();await page.setViewportSize({width:1366,height:768});
 await page.goto('http://127.0.0.1:6146/iframe.html?id=arena-visual-legivel--protecao-com-hud&viewMode=story');
 await page.waitForFunction(()=>document.querySelector('main')?.dataset.models==='true',{},{timeout:60000});
 await page.evaluate(()=>{const p=window.__visualBench;p.frozen=true;p.time=1;p.fighters.update(p.world,1,1,0);p.arena.draw(1,0);p.hud.update(p.world,false,p.arena.camera,1)});
 await page.screenshot({path:out+name+'.png',timeout:60000});
 const proof=await page.evaluate(()=>{const p=window.__visualBench;const views=p.fighters.views;return{world:JSON.stringify(p.world),halos:views.map(v=>v.halo.visible),rims:views.map(v=>v.rig?.uniforms.map(u=>u.uRimStrength.value)),outlines:views.map(v=>v.rig?.outlines.map(m=>m.visible)),labels:[...document.querySelectorAll('.fighter-label')].map(e=>({text:e.textContent,hidden:e.hidden})),viewport:[innerWidth,innerHeight]}});
 proof.errors=errors;await writeFile(out+name+'.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,world:'saved'}));
}finally{await b.close()}
