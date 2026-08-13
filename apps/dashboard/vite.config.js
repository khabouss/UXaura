import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  // Vite's dependency pre-bundling was mangling @supabase/supabase-js in
  // this workspace (fine when loaded unbundled) — force a clean re-optimize
  // instead of excluding it, since excluding breaks its own sub-imports.
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
    force: true,
  },
})
