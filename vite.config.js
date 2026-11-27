import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import genplan from './tools/vite-plugin-genplan.mjs';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: false,
  plugins: [genplan(), viteSingleFile({ removeViteModuleLoader: true })],
  optimizeDeps: { noDiscovery: true, include: [] },   // внешних npm-зависимостей у приложения нет
  server: {
    host: true,          // доступ с телефона в той же сети: http://<ip-компьютера>:5173
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: false,  // в dist/ лежит и эталонная сборка
    target: 'es2020',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 20000,
  },
});
