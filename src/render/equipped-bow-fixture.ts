import * as THREE from 'three';
import { ArenaScene } from './scene.ts';
import { FightersView } from './fighters.ts';
import { ArrowsView } from './arrows.ts';
import { createWorld } from '../sim/world.ts';
import { updateBow } from '../sim/arrows.ts';
import { emptyIntent } from '../sim/input.ts';

// Canonical production renderer/GLBs. Baseline disables the authored bow and
// arm-only overlay, then resamples the same exact fixture; no duplicate renderer.
export function equippedBowFixture(character=0) {
  const host=document.createElement('main');host.style.cssText='width:100vw;height:100vh;overflow:hidden;background:#15202b';
  const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block';host.append(canvas);
  const legend=document.createElement('aside');legend.style.cssText='position:absolute;left:12px;top:12px;background:#101820dd;color:white;padding:8px;font:14px sans-serif';host.append(legend);
  const arena=new ArenaScene(canvas), fighters=new FightersView(arena.arena), arrows=new ArrowsView(arena.arena);
  const world=createWorld({humans:2,bots:0,map:'totem',seed:3});world.phase='playing';
  world.fighters.forEach((f,i)=>Object.assign(f,{character:i===0?character:1-character,x:13+i*6,prevX:13+i*6,y:15.45,prevY:15.45,grounded:true,invulnerable:0,aimX:1,aimY:0,facing:1}));
  arena.setLevel(world.level);fighters.reset(world);
  const camera=new THREE.PerspectiveCamera(30,1,.01,100);
  const fill=new THREE.HemisphereLight(0xffffff,0x697888,2.5),lamp=new THREE.DirectionalLight(0xffffff,3);lamp.position.set(1,6,5);arena.scene.add(fill,lamp);
  const p={ready:false,time:0,state:'idle',angle:Math.PI/2,before:false,game:false,
    views:()=> (fighters as any).views,
    character,
    advance(count:number){for(let i=0;i<count;i++){this.time+=1/60;fighters.update(world,1,this.time,1/60);}arrows.update(world,this.time);},
    pose(state:string,angle=Math.PI/2){
      this.state=state;this.angle=angle;this.time=0;world.arrows.length=0;world.events.length=0;
      world.fighters.forEach(f=>Object.assign(f,{charging:false,charge:0,shotCooldown:0,crouching:false,grounded:true,vy:0,aimX:1,aimY:0,facing:1}));
      fighters.reset(world);
      if(this.before) this.views()[0].rig.armIK=undefined;
      this.advance(30);
      if(state!=='idle'){
        world.fighters[0].charging=true;
        if(state==='draw'){world.fighters[0].charge=.175;this.advance(10);}
        else {world.fighters[0].charge=.35;this.advance(120);}
        if(state==='hold10s')this.advance(600);
        if(state==='inverted'){Object.assign(world.fighters[0],{aimX:-Math.SQRT1_2,aimY:-Math.SQRT1_2,facing:-1});this.advance(120);}
        if(state==='north-east-turn1'){Object.assign(world.fighters[0],{aimX:Math.SQRT1_2,aimY:-Math.SQRT1_2});this.advance(1);}
        if(state==='crouch'){Object.assign(world.fighters[0],{aimX:Math.SQRT1_2,aimY:Math.SQRT1_2});this.advance(120);world.fighters[0].crouching=true;this.advance(1);}
        if(state==='jump'){Object.assign(world.fighters[0],{grounded:false,vy:-5});this.advance(1);}
        if(state.startsWith('release')){updateBow(world,world.fighters[0],emptyIntent());world.events.filter(e=>e.type==='shoot').forEach(e=>fighters.event(e.type,e.actor!));this.advance(state==='release-ended'?25:state==='release5'?5:1);}
      }
      this.draw();
    },
    compare(before:boolean){this.before=before;this.pose(this.state,this.angle);},
    draw(){
      if(!fighters.usingModels)return;
      const views=this.views(),v=views[0];v.equippedBow.root.visible=!this.before;
      views.forEach((v:any,i:number)=>{v.root.visible=this.game||i===0;v.shadow.visible=this.game;v.backdrop.visible=this.game;v.nock.visible=i===0&&world.fighters[0].charging;v.aimPoint.visible=false;v.aimDots.forEach((o:any)=>o.visible=false);});
      (arena as any).terrain.group.visible=this.game;
      (arena as any).atmosphere.visible=this.game;(arena as any).veil.visible=this.game;
      fill.visible=lamp.visible=!this.game;
      legend.textContent=`${character===0?'Mizu':'Stormy'} · ${this.state} · ${this.before?'ANTES: pose/arte baked publicada':'ARCO AUTORADO + arte baked intacta'} · ${this.before?'sem nova IK':'IK somente braços, torso intacto'}`;
      if(this.game){arena.closeCamera=true;arena.cameraTarget={x:16,y:3};arena.draw(this.time,0);}
      else {
        arena.scene.background=new THREE.Color(0x15202b);
        const center=new THREE.Vector3(v.root.position.x,v.root.position.y+1.2,.55);
        camera.position.copy(center).add(new THREE.Vector3(Math.cos(this.angle)*5.8,.1,Math.sin(this.angle)*5.8));camera.lookAt(center);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();arena.renderer.render(arena.scene,camera);
      }
    },
    inspect(){arena.scene.updateMatrixWorld(true);const v=this.views()[0],b=v.equippedBow;const point=(o:THREE.Object3D)=>o.getWorldPosition(new THREE.Vector3()).toArray();const gl=arena.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {state:this.state,before:this.before,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,hand:point(v.rig.bowHand),rightHand:point(v.rig.model.getObjectByName('mixamorigRightHand')),grip:point(b.grip),upper:point(b.upperTip),lower:point(b.lowerTip),nock:point(b.nock),arrowTail:v.nock.localToWorld(new THREE.Vector3(-.19,0,0)).toArray(),arrowTip:v.nock.localToWorld(new THREE.Vector3(.54,0,0)).toArray()};},
  };
  Object.assign(window,{__mizuBow:p,__equippedBow:p});
  const resize=new ResizeObserver(()=>{arena.resize(host.clientWidth,host.clientHeight);arena.renderer.setSize(host.clientWidth,host.clientHeight,false);p.draw();});resize.observe(host);
  const ready=()=>{if(!host.isConnected){resize.disconnect();arena.renderer.dispose();return;}if(!fighters.usingModels){requestAnimationFrame(ready);return;}p.ready=true;p.pose('idle');host.dataset.models='true';};requestAnimationFrame(ready);
  return host;
}
