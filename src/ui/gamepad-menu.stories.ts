import type { Meta, StoryObj } from '@storybook/html-vite';
import { Menu } from './menu.ts';
const meta = { title: 'Arena/Controle de videogame', render: (args: { connected: boolean; unsupported: boolean }) => {
  const menu = new Menu({ start: () => {}, resume: () => {}, rematch: () => {}, home: () => {}, mute: () => false });
  menu.updateGamepads(args.connected ? [0, 3, null, null] : [null, null, null, null], Number(args.unsupported));
  return menu.element;
}, args: { connected: false, unsupported: false } } satisfies Meta<{ connected: boolean; unsupported: boolean }>;
export default meta;
type Story = StoryObj<{ connected: boolean; unsupported: boolean }>;
export const Desconectado: Story = {};
export const DoisControlesSimulados: Story = { args: { connected: true } };
export const SemMappingStandard: Story = { args: { unsupported: true } };
