import type { Meta, StoryObj } from '@storybook/html-vite';
import { ResourceNotice } from './resource-notice.ts';
const meta = { title: 'Arena/Recursos reais', render: () => {
  const root = document.createElement('main'); root.id = 'game';
  const notice = new ResourceNotice();
  notice.set('models', 'Modelos incompletos: visual alternativo');
  notice.set('textures', 'Texturas indisponíveis: cenário simplificado');
  notice.set('audio', 'Áudio incompleto: alguns efeitos sem som');
  root.append(notice.element); return root;
} } satisfies Meta;
export default meta;
export const AssetsIndisponiveis: StoryObj = {};
