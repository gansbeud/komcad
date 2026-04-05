import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

export default defineConfig({
  plugins: [
    tailwindcss(),
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})


