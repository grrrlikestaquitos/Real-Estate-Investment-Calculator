// @vitest-environment node
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer } from './serve.mjs'

let server
let base

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'serve-'))
  await writeFile(join(root, 'index.html'), '<html>app</html>')
  await writeFile(join(root, 'zillow-extractor.js'), 'console.log("extractor")')
  await writeFile(join(root, 'style.css'), 'body{}')
  server = createAppServer(root)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

describe('createAppServer', () => {
  it('answers the health address', async () => {
    const res = await fetch(`${base}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('serves files with their content type', async () => {
    const html = await fetch(`${base}/`)
    expect(html.status).toBe(200)
    expect(html.headers.get('content-type')).toContain('text/html')
    expect(await html.text()).toContain('<html>app</html>')

    const js = await fetch(`${base}/zillow-extractor.js`)
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toContain('javascript')

    const css = await fetch(`${base}/style.css`)
    expect(css.headers.get('content-type')).toContain('text/css')
  })

  it('falls back to the app shell for unknown paths', async () => {
    const res = await fetch(`${base}/some/route`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<html>app</html>')
  })

  it('refuses path traversal outside the root', async () => {
    const res = await fetch(`${base}/..%2f..%2fetc%2fpasswd`)
    expect([403, 404]).toContain(res.status)
  })
})
