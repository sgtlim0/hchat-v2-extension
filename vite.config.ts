import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'

function copyStaticAssets(): Plugin {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      // Copy manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json')

      // Copy content.css
      if (existsSync('public/content.css')) {
        copyFileSync('public/content.css', 'dist/content.css')
      }

      // Copy icons
      const iconsDir = 'public/icons'
      const destDir = 'dist/icons'
      if (existsSync(iconsDir)) {
        mkdirSync(destDir, { recursive: true })
        for (const file of readdirSync(iconsDir)) {
          copyFileSync(resolve(iconsDir, file), resolve(destDir, file))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyStaticAssets()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'search-injector': resolve(__dirname, 'src/content/search-injector.ts'),
        'writing-assistant': resolve(__dirname, 'src/content/writing-assistant.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js'
          if (chunk.name === 'content') return 'content.js'
          if (chunk.name === 'search-injector') return 'search-injector.js'
          if (chunk.name === 'writing-assistant') return 'writing-assistant.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (info) => {
          if (info.name === 'content.css') return 'content.css'
          return 'assets/[name]-[hash].[ext]'
        },
      },
    },
  },

  define: { 'process.env': {} },
})
