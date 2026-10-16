// Production static server for the built app (dist/), answering the platform's
// health address. The lab's Dockerfile runs it (`node serve.mjs`, PORT from
// compose.yaml); locally `yarn dev` / `yarn preview` cover it.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

/** Build the request handler + server for a built app directory. */
export function createAppServer(rootDir) {
  const root = normalize(rootDir)

  return createServer((req, res) => {
    void (async () => {
      try {
        if (req.url?.split('?')[0] === '/healthz') {
          res.writeHead(200, { 'content-type': 'text/plain' })
          res.end('ok')
          return
        }
        const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
        const file = normalize(join(root, pathname))
        if (!file.startsWith(root)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        let served = file
        let body
        try {
          body = await readFile(served)
        } catch {
          // SPA fallback: unknown paths get the app shell.
          served = join(root, 'index.html')
          body = await readFile(served)
        }
        res.writeHead(200, {
          'content-type': TYPES[extname(served)] ?? 'application/octet-stream',
        })
        res.end(body)
      } catch {
        res.writeHead(500)
        res.end('internal error')
      }
    })()
  })
}

// Start only when run directly (not when imported by the tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8000)
  const server = createAppServer(fileURLToPath(new URL('./dist', import.meta.url)))
  server.listen(port, () => {
    console.log(`serving dist/ on :${port}`)
  })
}
