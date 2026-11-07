import type { Meta, StoryObj } from '@storybook/html-vite';
import * as THREE from 'three';
import { Hud } from '../render/hud.ts';
import { createWorld } from '../sim/world.ts';

// Real production HUD, exact edge/crossing case found during rodada-4 autoplay.
const meta = { title: 'Arena/HUD real', render: () => {
  const host = document.createElement('main'); host.id = 'game';
  host.style.background = '#244049';
  const world = createWorld({ humans: 0, bots: 4, map: 'moss', seed: 3 }); world.phase = 'playing';
  const poses = [[0, .2], [16, 1.1], [16.1, 1.1], [32, 9]];
  world.fighters.forEach((f, id) => { f.x = poses[id][0]; f.y = poses[id][1]; });
  const camera = new THREE.OrthographicCamera(-.9, 32.9, 18.7, -.7, .1, 100);
  camera.position.z = 40; camera.updateMatrixWorld();
  const hud = new Hud(); hud.reset(world); host.append(hud.element);
  requestAnimationFrame(() => hud.update(world, false, camera, 10));
  return host;
} } satisfies Meta;
export default meta;
type Story = StoryObj;
export const BordasENomesCruzados: Story = {};
export const HabilidadesAutoritativas: Story = {render:()=>{
  const host=document.createElement('main');host.id='game';host.style.background='#244049';
  const w=createWorld({humans:2,bots:2});w.phase='playing';
  w.fighters[0].skill={kind:'water-guard',time:.5,x:8,y:8,charges:1,pending:false};w.fighters[0].dashCooldown=1.6;
  w.fighters[1].dashCooldown=1.23;
  const camera=new THREE.OrthographicCamera(-.9,32.9,18.7,-.7,.1,100);camera.position.z=40;camera.updateMatrixWorld();
  const hud=new Hud();hud.reset(w);host.append(hud.element);requestAnimationFrame(()=>hud.update(w,false,camera,10));return host;
}};
export const WrapComDirecao: Story = { render: () => {
  const host = document.createElement('main'); host.id = 'game'; host.style.background = '#244049';
  const w = createWorld({ humans: 1, bots: 3 }); w.phase = 'playing'; w.roundTime = 6;
  const poses = [[0.05,9], [31.95,9], [13,0.05], [19,17.95]];
  w.fighters.forEach((f,i) => { f.x=poses[i][0]; f.y=poses[i][1]; });
  const camera = new THREE.OrthographicCamera(-.9,32.9,18.7,-.7,.1,100);camera.position.z=40;camera.updateMatrixWorld();
  const hud=new Hud();hud.reset(w);host.append(hud.element);
  const resize = new ResizeObserver(()=>hud.update(w,false,camera,10));resize.observe(host);
  requestAnimationFrame(()=>hud.update(w,false,camera,10));return host;
} };
export const HeadhunterLeve: Story = { render: () => {
  const host = document.createElement('main'); host.id = 'game'; host.style.background = '#244049';
  const w = createWorld({ humans: 1, bots: 3, mode: 'headhunter' }); w.phase = 'playing'; w.matchTime = w.roundTime = 26;
  w.fighters[0].score = 7;
  const camera = new THREE.OrthographicCamera(-.9, 32.9, 18.7, -.7, .1, 100); camera.position.z = 40; camera.updateMatrixWorld();
  const hud = new Hud(); hud.reset(w); hud.setLowQuality(true); host.append(hud.element);
  requestAnimationFrame(() => hud.update(w, false, camera, 10)); return host;
} };
