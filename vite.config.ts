import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Add import for fileURLToPath to resolve paths in ES modules
import { fileURLToPath } from 'url';

export default defineConfig(({ mode }) => {
    // FIX: Pass empty string to loadEnv to use default process.cwd() and avoid TypeScript type error for 'cwd'.
    const env = loadEnv(mode, '', '');
    return {
      // Set base path for GitHub Pages
      base: '/Prompt-Studio/', 
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // FIX: __dirname is not defined in ES module scope, use import.meta.url to get the current directory.
          '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.'),
        }
      }
    };
});