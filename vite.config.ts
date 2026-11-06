import { defineConfig } from 'vite';

// GitHub Pages serves the project at /the-last-arrow-web/. TLA_BASE=/ keeps a root build possible.
export default defineConfig({
  base: process.env.TLA_BASE ?? '/the-last-arrow-web/',
  build: { chunkSizeWarningLimit: 900 },
});
