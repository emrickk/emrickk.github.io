// Dev-only post editor, mounted at /_edit on the Astro dev server. The only
// hook is astro:server:setup, which never fires during astro build, so
// nothing here can reach dist/ or the deployed site (public repo, GitHub
// Pages). All file logic lives in api.mjs; this file is HTTP plumbing.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApiRequest } from './api.mjs'

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), 'ui')
const UI_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/editor.css': ['editor.css', 'text/css; charset=utf-8'],
  '/editor.js': ['editor.js', 'text/javascript; charset=utf-8'],
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function handle(root, req, res) {
  const url = req.url === '' ? '/' : req.url
  if (url.startsWith('/api/')) {
    let result
    try {
      const body = req.method === 'PUT' ? await readBody(req) : null
      result = handleApiRequest(root, { method: req.method, url, body })
    } catch (err) {
      // Keep API responses JSON even when a handler throws (disk errors);
      // Vite's HTML error page would break the UI's res.json() calls.
      result = { status: 500, body: { error: String(err && err.message ? err.message : err) } }
    }
    res.statusCode = result.status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(result.body))
    return
  }
  const uiFile = UI_FILES[url.split('?')[0]]
  if (req.method === 'GET' && uiFile) {
    res.statusCode = 200
    res.setHeader('content-type', uiFile[1])
    res.end(await readFile(join(UI_DIR, uiFile[0])))
    return
  }
  res.statusCode = 404
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'not found' }))
}

export default function postEditor() {
  return {
    name: 'post-editor',
    hooks: {
      'astro:server:setup': ({ server }) => {
        const root = server.config.root
        server.middlewares.use('/_edit', (req, res, next) => {
          handle(root, req, res).catch(next)
        })
      },
    },
  }
}
