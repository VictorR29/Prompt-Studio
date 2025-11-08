import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // This line corrects the base path for GitHub Pages deployment.
  base: '/Prompt-Studio/', 
  
  plugins: [react()],
})
