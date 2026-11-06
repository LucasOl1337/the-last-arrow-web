import type { Intent } from '../sim/input.ts';
import type { ServerMessage } from './protocol.ts';
export class OnlineClient {
  private ws: WebSocket;
  private stopped = false;
  private lastSend = 0;
  private timeout: ReturnType<typeof setTimeout>;
  player = 0;
  room = '';
  constructor(room: string, onMessage: (m: ServerMessage)=>void, options: {map?:string;mode?:string}={}) {
    const url = new URL('ws',location.href);url.pathname='/ws';url.search='';url.protocol=location.protocol==='https:'?'wss:':'ws:';
    // Local proof proxies /ws through the preview's separate API port.
    if(location.hostname==='127.0.0.1') url.port='8890';
    this.ws=new WebSocket(url);
    this.timeout=setTimeout(()=>{if(!this.stopped){onMessage({type:'error',message:'A conexão demorou demais. Tente entrar novamente.'});this.close();}},10000);
    this.ws.onopen=()=>{this.ws.send(JSON.stringify({type:'join',room,...options}));};
    this.ws.onmessage=e=>{
      const m=JSON.parse(e.data) as ServerMessage;
      if(m.type==='joined') {clearTimeout(this.timeout);this.player=m.player;this.room=m.room;}
      onMessage(m);
    };
    this.ws.onclose=()=>{clearTimeout(this.timeout);if(!this.stopped)onMessage({type:'error',message:'Conexão encerrada. Volte a criar ou entrar numa sala.'});};
    this.ws.onerror=()=>{}; // close reports one recoverable error, not duplicate dialogs
  }
  send(input: Intent, now: number) {
    if(this.ws.readyState!==WebSocket.OPEN)return false;
    if(now-this.lastSend<1000/30 && !input.jump && !input.shoot && !input.dash)return false;
    this.lastSend=now;this.ws.send(JSON.stringify({type:'input',input}));return true;
  }
  ready() {if(this.ws.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'ready'}));}
  rematch() {if(this.ws.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'rematch'}));}
  close() {this.stopped=true;clearTimeout(this.timeout);this.ws.close();}
}
