import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'src': path.resolve(__dirname, './'),
      '/src': path.resolve(__dirname, './'),
      'components': path.resolve(__dirname, './components'),
      'integrations': path.resolve(__dirname, './'),
      '@/integrations/supabase/client': path.resolve(__dirname, './client.ts')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  build: {
    outDir: 'dist',
  }
});
