import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const apiKey = env.VITE_ANTHROPIC_API_KEY || ''

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
        },
      }),
      {
        name: 'anthropic-proxy',
        configureServer(server) {
          server.middlewares.use('/anthropic', (req: any, res: any) => {
            let body = ''
            req.on('data', (chunk: any) => { body += chunk })
            req.on('end', () => {
              const options = {
                hostname: 'api.anthropic.com',
                path: (req.url || '').replace(/^\/anthropic/, '') || '/v1/messages',
                method: req.method || 'POST',
                headers: {
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                  'content-type': 'application/json',
                  'content-length': Buffer.byteLength(body),
                },
              }
              const proxyReq = https.request(options, proxyRes => {
                res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
                proxyRes.pipe(res)
              })
              proxyReq.on('error', (e: Error) => { res.writeHead(500); res.end(e.message) })
              proxyReq.write(body)
              proxyReq.end()
            })
          })
        },
      },
    ],
  }
})
