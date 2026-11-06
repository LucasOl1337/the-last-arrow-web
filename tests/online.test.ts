import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createOnlineServer} from '../server/index.ts';
import {parseIntent} from '../src/net/protocol.ts';
import {emptyIntent} from '../src/sim/input.ts';
function client(url:string) {
  const ws=new WebSocket(url),messages:any[]=[];
  ws.on('message',v=>messages.push(JSON.parse(v.toString())));
  const wait=async(type:string)=>{const end=Date.now()+5000;while(Date.now()<end){const i=messages.findIndex(m=>m.type===type);if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error('missing '+type);};
  return {ws,wait,messages,send:(m:unknown)=>ws.send(JSON.stringify(m))};
}
test('input cannot inject speed, coordinates or malformed axes',()=>{
 assert.equal(parseIntent({...emptyIntent(),moveX:99}),null);assert.equal(parseIntent({...emptyIntent(),moveY:null}),null);
 assert.deepEqual(parseIntent({...emptyIntent(),x:999,score:100}),emptyIntent());
});
test('two remote players share authoritative world, full rooms reject, disconnect closes room',async()=>{
 const app=createOnlineServer();await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 const port=(app.server.address() as {port:number}).port, url=`ws://127.0.0.1:${port}/ws`;
 const a=client(url),b=client(url),c=client(url);
 try {
   await Promise.all([a,b,c].map(p=>new Promise<void>(r=>p.ws.once('open',r))));
   a.send({type:'join',map:'totem',mode:'headhunter',characters:['akane','kaze']});const joined=await a.wait('joined');assert.equal(joined.player,0);await a.wait('waiting');
   b.send({type:'join',room:joined.room});assert.equal((await b.wait('joined')).player,1);
   await Promise.all([a.wait('start'),b.wait('start')]);
   c.send({type:'join',room:joined.room});assert.match((await c.wait('error')).message,/cheia/);
   const first=await a.wait('state');assert.equal(first.world.fighters.length,2);
   assert.equal(first.world.options.map,'totem');assert.equal(first.world.options.mode,'headhunter');assert.deepEqual(first.world.options.characters.slice(0,2),['akane','kaze']);
   const r=app.rooms.get(joined.room)!;
   await new Promise(r=>setTimeout(r,60));assert.equal(r.world.tick,0,'wait until both assets are ready');
   a.send({type:'ready'});b.send({type:'ready'});r.world.phase='playing';r.world.fighters.forEach(f=>f.invulnerable=10);
   const x=r.world.fighters[1].x;b.send({type:'input',input:{...emptyIntent(),moveX:-1,aimX:.6,aimY:-.8,crouch:true}});
   await new Promise(r=>setTimeout(r,180));assert.ok(r.world.fighters[1].x<x);assert.equal(r.world.fighters[1].aimX,.6);assert.equal(r.world.fighters[1].aimY,-.8);
   a.messages.length=b.messages.length=0;
   const [sa,sb]=await Promise.all([a.wait('state'),b.wait('state')]);assert.deepEqual(sa.world,sb.world);
   r.world.phase='matchover';r.world.fighters[0].score=5;
   a.send({type:'rematch'});await new Promise(r=>setTimeout(r,40));assert.equal(r.world.phase,'matchover','one vote cannot reset opponent');
   b.send({type:'rematch'});await a.wait('start');await b.wait('start');assert.equal(r.world.phase,'countdown');assert.equal(r.world.fighters[0].score,0);assert.equal(r.loaded.size,0);
   a.ws.close();await b.wait('left');assert.equal(app.rooms.size,0);
 }finally{a.ws.terminate();b.ws.terminate();c.ws.terminate();await app.close();}
});
