import type {Meta,StoryObj} from '@storybook/html-vite';
import {controlSettings} from './control-settings.ts';import {saveLayout} from './control-layouts.ts';
const meta={title:'Arena/Controles ergonomicos',render:(args:{layout:string})=>{saveLayout(args.layout);const layer=document.createElement('section');layer.className='menu-layer';const panel=document.createElement('div');panel.className='overlay-panel';const h=document.createElement('h2');h.textContent='Seu jeito de jogar';panel.append(h,controlSettings());layer.append(panel);return layer;},args:{layout:'mouse-space'}} satisfies Meta<{layout:string}>;
export default meta;
export const Plataforma:StoryObj={};export const Atirador:StoryObj={args:{layout:'mouse-q'}};export const Moba:StoryObj={args:{layout:'mouse-r'}};export const Alternativo:StoryObj={args:{layout:'mouse-h'}};export const Classico:StoryObj={args:{layout:'classic'}};
