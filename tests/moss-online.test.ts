import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createOnlineServer} from '../server/index.ts';
import {LEVELS} from '../src/sim/level.ts';

test('online Musgo sends the same expanded collision rows as local play',async()=>{
 const app=createOnlineServer();await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 const url=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}/ws`;
 const sockets=[new WebSocket(url),new WebSocket(url)];
 const queues:any[][]=[[],[]];sockets.forEach((s,i)=>s.on('message',m=>queues[i].push(JSON.parse(m.toString()))));
 const wait=async(i:number,type:string)=>{const end=Date.now()+3000;while(Date.now()<end){const n=queues[i].findIndex(m=>m.type===type);if(n>=0)return queues[i].splice(n,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error(`missing ${type}`);};
 try{
  await Promise.all(sockets.map(s=>new Promise<void>(r=>s.once('open',r))));
  sockets[0].send(JSON.stringify({type:'join',map:'moss'}));const joined=await wait(0,'joined');
  sockets[1].send(JSON.stringify({type:'join',room:joined.room}));await wait(1,'joined');
  const state=await wait(1,'state');const level=LEVELS.find(l=>l.id==='moss')!;
  assert.deepEqual(state.world.level.rows,level.rows);assert.equal(state.world.level.rows[8],'....########........########....');
  assert.deepEqual(app.rooms.get(joined.room)!.world.level.rows,level.rows);
 }finally{sockets.forEach(s=>s.terminate());await app.close();}
});
