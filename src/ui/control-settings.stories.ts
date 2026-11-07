import type {Meta,StoryObj} from '@storybook/html-vite';
import {controlSettings} from './control-settings.ts';
import {saveBinding,saveLayout} from './control-layouts.ts';
const meta={title:'Arena/Controles ergonomicos',render:(args:{layout:string;custom:boolean})=>{
  saveLayout(args.layout);if(args.custom)saveBinding('jump','KeyV');
  const layer=document.createElement('section');layer.className='menu-layer';
  const panel=document.createElement('div');panel.className='overlay-panel controls-panel';
  const h=document.createElement('h2');h.textContent='Controles';panel.append(h,controlSettings());layer.append(panel);return layer;
},args:{layout:'mouse-space',custom:false}} satisfies Meta<{layout:string;custom:boolean}>;
export default meta;
export const Plataforma:StoryObj={};
export const Atirador:StoryObj={args:{layout:'mouse-q'}};
export const Moba:StoryObj={args:{layout:'mouse-r'}};
export const Alternativo:StoryObj={args:{layout:'mouse-h'}};
export const Classico:StoryObj={args:{layout:'classic'}};
export const Personalizado:StoryObj={args:{custom:true}};
// Capture, conflict and cancellation are exercised on these real production buttons by proof-custom-controls.mjs.
