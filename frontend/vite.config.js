import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom simule un navigateur (DOM, localStorage...) pour tester des
    // composants React sans avoir besoin d'un vrai navigateur.
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})
