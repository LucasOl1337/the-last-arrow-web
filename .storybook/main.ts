import type { StorybookConfig } from '@storybook/html-vite';
const config: StorybookConfig = {
  framework: '@storybook/html-vite', stories: ['../src/ui/**/*.stories.ts', '../src/render/**/*.stories.ts'],
  staticDirs: ['../public'], addons: [],
};
export default config;
