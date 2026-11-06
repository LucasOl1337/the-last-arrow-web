import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createWorld, step, DT, CHARACTERS } from '../src/sim/world.ts';
import type { World, MatchOptions, SimEvent } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { parseIntent } from '../src/net/protocol.ts';

type Peer = { ws: WebSocket; input: ReturnType<typeof emptyIntent>; seen: number; messages: number; window: number };
type Room = { code: string; peers: Peer[]; world: World; events: SimEvent[]; ready: Set<WebSocket>; loaded: Set<WebSocket>; lastActive: number };
export function createOnlineServer() {
  const rooms = new Map<string, Room>();
  const server = createServer((req,res) => {
    if (req.url !== '/health') { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ok:true,rooms:rooms.size}));
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  const send = (ws: WebSocket, value: unknown) => { if(ws.readyState===WebSocket.OPEN) { if(ws.bufferedAmount>256_000) ws.close(1013,'Conexão lenta'); else ws.send(JSON.stringify(value)); } };
  const broadcast = (r: Room, value: unknown) => r.peers.forEach(p=>send(p.ws,value));
  server.on('upgrade',(req,socket,head)=> {
    const origin = req.headers.origin;
    if(req.url !== '/ws' || (origin && ![process.env.PUBLIC_ORIGIN, 'http://127.0.0.1:4176','http://127.0.0.1:4177'].filter(Boolean).includes(origin))) { socket.destroy(); return; }
    sockets.handleUpgrade(req,socket,head,ws=>sockets.emit('connection',ws));
  });
  sockets.on('connection', ws => {
    if(sockets.clients.size>100) { ws.close(1013,'Servidor ocupado'); return; }
    let room: Room | undefined;
    const peer: Peer = {ws,input:emptyIntent(),seen:Date.now(),messages:0,window:Date.now()};
    const joinedDeadline = setTimeout(()=>{if(!room) ws.close(1008,'Entre numa sala');},10000);
    const restart = (r: Room) => { r.world=createWorld({...r.world.options,seed:randomBytes(4).readUInt32LE()}); r.ready.clear();r.loaded.clear();r.events=[];r.peers.forEach(p=>{p.input=emptyIntent();});broadcast(r,{type:'start',options:r.world.options}); };
    ws.on('message', bytes => {
      const now=Date.now();
      if(now-peer.window>=1000) {peer.window=now;peer.messages=0;}
      if(++peer.messages>150) {ws.close(1008,'Mensagens em excesso');return;}
      let m; try {m=JSON.parse(bytes.toString());} catch {ws.close(1008,'Mensagem inválida');return;}
      if(!m || typeof m !== 'object') {ws.close(1008);return;}
      if(m.type==='join' && !room) {
        const code = typeof m.room==='string' ? m.room.toUpperCase() : '';
        if(code && !/^[A-F0-9]{8}$/.test(code)) {send(ws,{type:'error',message:'Código de sala inválido.'});return;}
        if(code) room=rooms.get(code);
        if(code && (!room || room.peers.length>=2)) {room=undefined;send(ws,{type:'error',message:'Sala não encontrada ou já está cheia.'});return;}
        if(!room) {
          if(rooms.size>=40) {send(ws,{type:'error',message:'Servidor cheio. Tente de novo mais tarde.'});return;}
          const characters=CHARACTERS.map((c,i)=>Array.isArray(m.characters)&&CHARACTERS.some(valid=>valid.id===m.characters[i])?m.characters[i]:c.id);
          const opts: MatchOptions = {humans:2,bots:0,map:typeof m.map==='string'?m.map:'moss',mode:m.mode==='headhunter'?'headhunter':'versus',characters,seed:randomBytes(4).readUInt32LE()};
          room={code:randomBytes(4).toString('hex').toUpperCase(),peers:[],world:createWorld(opts),events:[],ready:new Set(),loaded:new Set(),lastActive:now}; rooms.set(room.code,room);
        }
        clearTimeout(joinedDeadline);room.peers.push(peer);room.lastActive=now;
        send(ws,{type:'joined',room:room.code,player:room.peers.length-1});
        if(room.peers.length===2) restart(room); else send(ws,{type:'waiting'});
      } else if(m.type==='ready' && room) {room.loaded.add(ws);
      } else if(m.type==='input' && room) {
        const input=parseIntent(m.input);if(!input){ws.close(1008,'Controles inválidos');return;}
        // Never lose a press followed by release between simulation ticks.
        input.jump ||= peer.input.jump;input.shoot ||= peer.input.shoot;input.dash ||= peer.input.dash;
        peer.input=input;peer.seen=now;room.lastActive=now;
      } else if(m.type==='rematch' && room && room.world.phase==='matchover') {
        room.ready.add(ws);if(room.ready.size===2) restart(room);
      }
    });
    ws.on('error',()=>{});
    ws.on('close',()=> {clearTimeout(joinedDeadline);if(!room)return;const old=room;room=undefined;rooms.delete(old.code);old.peers=old.peers.filter(p=>p!==peer);broadcast(old,{type:'left'});old.peers.forEach(p=>p.ws.close(1000,'O outro jogador saiu'));});
  });
  let last=performance.now(),accumulator=0,broadcastElapsed=0;
  const timer=setInterval(()=> {
    const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;accumulator+=dt;broadcastElapsed+=dt;
    while(accumulator>=DT) {
      accumulator-=DT;
      for(const r of rooms.values()) {
        if(r.peers.length!==2 || r.loaded.size!==2 || r.world.phase==='matchover') continue;
        for(const p of r.peers) if(Date.now()-p.seen>500) p.input={...emptyIntent(),cancelShot:true};
        step(r.world,r.peers.map(p=>p.input));r.events.push(...r.world.events);
        for(const p of r.peers) p.input.jump=p.input.shoot=p.input.dash=false;
      }
    }
    if(broadcastElapsed>=1/30) {broadcastElapsed=0;for(const r of rooms.values()) {
      if(Date.now()-r.lastActive>10*60_000) {r.peers.forEach(p=>p.ws.close(1000,'Sala expirada'));continue;}
      if(r.peers.length===2) {broadcast(r,{type:'state',world:r.world,events:r.events});r.events=[];}
    }}
  },8);
  return {server,rooms,close: async()=>{clearInterval(timer);for(const ws of sockets.clients) ws.terminate();await new Promise<void>(resolve=>sockets.close(()=>resolve()));await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const app=createOnlineServer();app.server.listen(Number(process.env.PORT??8890),'127.0.0.1',()=>console.log('The Last Arrow online pronto'));
  for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>void app.close().then(()=>process.exit(0)));
}
