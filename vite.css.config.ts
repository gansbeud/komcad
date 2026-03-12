/**
 * Phase-1 build: compile Tailwind CSS and emit it to dist/static/style.css
 *
 * Cloudflare Pages routes exclude /static/* from the Worker (_routes.json),
 * so files in dist/static/ are served directly from the CDN without hitting
 * the Hono Worker at all. This solves the 302/404 loop caused by the auth
 * guard intercepting CSS requests in the SSR Worker bundle.
 */
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist/static',
    emptyOutDir: false,
    rollupOptions: {
      input: ['src/style.css'],
      output: {
        // Stable filename so renderer.tsx can reference /static/style.css
        assetFileNames: '[name][extname]',
        // The tiny JS shim Rollup emits alongside the CSS is harmless; prefix
        // it with _ so it is easy to identify and ignored by the Worker.
        entryFileNames: '_css-build.[hash].js',
      },
    },
  },
})
