import type { Meta, StoryObj } from '@storybook/html-vite';
import { ArenaScene } from '../render/scene.ts';
import { FightersView } from '../render/fighters.ts';
import { Effects } from '../render/fx.ts';
import { Hud } from '../render/hud.ts';
import { createWorld } from '../sim/world.ts';

// Production views consume a frozen, explicitly authored catch, not a second implementation.
const meta = { title: 'Arena/Juice real', render: () => {
  const host = document.createElement('main'); host.id = 'game';
  const canvas = document.createElement('canvas'); host.append(canvas);
  const arena = new ArenaScene(canvas), fighters = new FightersView(arena.arena), fx = new Effects(arena.arena), hud = new Hud();
  const w = createWorld({ humans: 1, bots: 3, map: 'totem', seed: 3 }); w.phase = 'playing'; w.roundTime = 6;
  w.fighters.forEach((f,i) => Object.assign(f,{x:8+i*5,prevX:8+i*5,y:15.45,prevY:15.45,invulnerable:0,grounded:true}));
  const catchEvent = { type:'catch' as const, actor:0, x:8, y:15.45 };
  arena.setLevel(w.level);fighters.reset(w);hud.reset(w);host.append(hud.element);
  const resize=new ResizeObserver(()=>arena.resize(host.clientWidth,host.clientHeight));resize.observe(host);
  let emitted=false;
  const draw=(now:number)=>{
    if(!host.isConnected){resize.disconnect();arena.renderer.dispose();return;}
    if(fighters.usingModels&&!emitted){fx.event(catchEvent,w);emitted=true;}
    fighters.update(w,1,now/1000,1/60);
    // Fixed event age makes the same production feedback inspectable at every viewport.
    if(emitted)hud.event(catchEvent,now/1000);
    fx.update(0,0,w);arena.draw(now/1000,0);hud.update(w,false,arena.camera,now/1000);
    host.dataset.models=String(fighters.usingModels);requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);return host;
} } satisfies Meta;
export default meta;
type Story=StoryObj;
export const Catch:Story={};
