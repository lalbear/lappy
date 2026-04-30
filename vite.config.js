import { defineConfig } from 'vite';

export default defineConfig({
  // Base must be './' so Electron can load built files from disk
  base: './',
  server: {
    port: 5174,
    strictPort: true,
  },
});
