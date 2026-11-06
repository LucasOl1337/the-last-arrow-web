import type { Meta, StoryObj } from '@storybook/html-vite';
import { Menu } from './menu.ts';
import type { Screen } from './menu.ts';
const meta = { title: 'Arena/Menu real', render: (args: { screen: Screen }) => {
  let muted = false;
  const menu = new Menu({ start: () => menu.show('pause'), resume: () => menu.show('menu'), rematch: () => menu.show('menu'), home: () => menu.show('menu'), mute: () => (muted = !muted), online:()=>{} });
  menu.show(args.screen, 'Stormdragon'); return menu.element;
}, args: { screen: 'menu' as Screen } } satisfies Meta<{ screen: Screen }>;
export default meta;
type Story = StoryObj<{ screen: Screen }>;
export const Configuracao: Story = { args: { screen: 'menu' } };
export const Controles: Story = { args: { screen: 'controls' } };
export const Pausa: Story = { args: { screen: 'pause' } };
export const Vitoria: Story = { args: { screen: 'victory' } };
export const ErroGrafico: Story = { args: { screen: 'error' } };
export const ContextoPerdido: Story = { args: { screen: 'recovering' } };
export const PausaOnline: Story = { render:()=>{const menu=new Menu({start:()=>{},resume:()=>menu.hide(),rematch:()=>{},home:()=>menu.show('menu'),mute:()=>false});menu.online=true;menu.show('pause');return menu.element;} };
const headhunterResult = (draw: boolean) => {
  const menu = new Menu({ start: () => {}, resume: () => {}, rematch: () => menu.show('menu'), home: () => menu.show('menu'), mute: () => false });
  menu.show('victory', draw ? undefined : 'Akane', { score: 18, kills: 18, catches: 14, stomps: 6, mode: 'headhunter' });
  return menu.element;
};
export const VitoriaHeadhunter: Story = { render: () => headhunterResult(false) };
export const EmpateHeadhunter: Story = { render: () => headhunterResult(true) };
export const SomSilenciadoExternamente: Story = { render: () => {
  let muted = true;
  const menu = new Menu({ start: () => menu.show('pause'), resume: () => menu.show('menu'), rematch: () => menu.show('menu'), home: () => menu.show('menu'), mute: () => (muted = !muted) });
  menu.show('pause'); menu.setMuted(muted); return menu.element;
} };
