import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed under the GitHub Pages project path:
// https://sonalhirusha.github.io/ZER-CLOTHING/
// Built JS/CSS go into a dedicated `vanguard/` folder so they never
// collide with the existing storefront's `assets/` directory.
// https://vite.dev/config/
export default defineConfig({
  base: '/ZER-CLOTHING/',
  plugins: [react()],
  build: {
    assetsDir: 'vanguard',
  },
})
