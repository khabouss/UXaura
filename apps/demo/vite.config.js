import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // The demo imports the SDK the way a real customer would —
      // '@uxaura/sdk' — but points straight at source, no build step.
      { find: '@uxaura/sdk/styles.css', replacement: path.resolve(__dirname, '../../packages/sdk/src/styles.css') },
      { find: '@uxaura/sdk', replacement: path.resolve(__dirname, '../../packages/sdk/src/index.jsx') },
    ],
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, '../../')] },
  },
})
