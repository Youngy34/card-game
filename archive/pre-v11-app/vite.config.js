import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'Character JSON')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'character-data-api',
      configureServer(server) {
        server.middlewares.use('/api/data/list', (_req, res) => {
          try {
            const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(files))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
        })

        server.middlewares.use('/api/data', (req, res, next) => {
          const filename = decodeURIComponent(req.url.replace(/^\//, ''))
          if (!filename || !filename.endsWith('.json')) return next()
          const filepath = path.join(DATA_DIR, filename)
          if (!fs.existsSync(filepath)) return next()
          try {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(fs.readFileSync(filepath, 'utf-8'))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      }
    }
  ]
})
