import type { Meta, StoryObj } from '@storybook/html-vite';
import { OnlinePanel } from './online.ts';
const meta={title:'Arena/Online real',render:(args:{waiting?:boolean;error?:boolean})=>{
  const p=new OnlinePanel({create:()=>p.waiting('12AB34CD'),join:()=>p.show('Conectando…'),back:()=>p.show('Voltar ao menu')});
  if(args.waiting)p.waiting('12AB34CD');else p.show(args.error?'Sala não encontrada ou já está cheia.':'');return p.element;
}} satisfies Meta;
export default meta;
export const Entrada: StoryObj={};
export const Esperando: StoryObj={args:{waiting:true}};
export const Erro: StoryObj={args:{error:true}};
