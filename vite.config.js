import { defineConfig } from 'vite';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import path from 'path';

export default defineConfig({
  root: './public',
  base: './',
  plugins: [
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html'],
      customWorkers: []
    })
  ],
  build: {
    outDir: '.',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    port: 3001,
    strictPort: false
  },
  resolve: {
    alias: {
      '/src': path.resolve(__dirname, 'src'),
      '/node_modules': path.resolve(__dirname, 'node_modules')
    }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  
  }
});