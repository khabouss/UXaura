import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.jsx' },
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
  external: ['react', 'react-dom'],
  clean: true,
  sourcemap: true,
  minify: false,
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
