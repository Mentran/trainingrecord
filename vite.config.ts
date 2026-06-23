import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'app-data.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const BACKUP_INTERVAL_MS = 60 * 1000
const MAX_BACKUPS = 20

function sendJson(res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function backupName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${stamp}.json`
}

async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true })
}

async function getLatestBackupTime(): Promise<number> {
  const files = await fs.readdir(BACKUP_DIR).catch(() => [])
  let latest = 0
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const stat = await fs.stat(path.join(BACKUP_DIR, file)).catch(() => null)
    if (stat) latest = Math.max(latest, stat.mtimeMs)
  }
  return latest
}

async function backupExistingFile(nextContent: string): Promise<void> {
  try {
    const current = await fs.readFile(DATA_FILE, 'utf8')
    if (current === nextContent) return
    const latestBackupTime = await getLatestBackupTime()
    if (latestBackupTime > 0 && Date.now() - latestBackupTime < BACKUP_INTERVAL_MS) return
    await fs.writeFile(path.join(BACKUP_DIR, backupName()), current)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function pruneBackups(limit = 50): Promise<void> {
  const files = await fs.readdir(BACKUP_DIR).catch(() => [])
  const backups = files.filter(file => file.endsWith('.json')).sort().reverse()
  await Promise.all(backups.slice(limit).map(file => fs.unlink(path.join(BACKUP_DIR, file)).catch(() => undefined)))
}

function localFileStorePlugin(): Plugin {
  return {
    name: 'local-file-store',
    configureServer(server) {
      server.middlewares.use('/api/local-store', async (req, res) => {
        try {
          await ensureDataDirs()

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          if (req.method === 'GET') {
            try {
              const raw = await fs.readFile(DATA_FILE, 'utf8')
              sendJson(res, 200, {
                exists: true,
                data: JSON.parse(raw),
                path: DATA_FILE,
                backupsPath: BACKUP_DIR,
              })
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
              sendJson(res, 200, {
                exists: false,
                path: DATA_FILE,
                backupsPath: BACKUP_DIR,
              })
            }
            return
          }

          if (req.method === 'POST') {
            const body = await readBody(req)
            const parsed = JSON.parse(body) as Record<string, unknown>
            const nextContent = JSON.stringify(parsed, null, 2)
            await backupExistingFile(nextContent)
            await fs.writeFile(`${DATA_FILE}.tmp`, nextContent)
            await fs.rename(`${DATA_FILE}.tmp`, DATA_FILE)
            await pruneBackups(MAX_BACKUPS)
            sendJson(res, 200, {
              ok: true,
              savedAt: parsed.savedAt,
              path: DATA_FILE,
              backupsPath: BACKUP_DIR,
            })
            return
          }

          sendJson(res, 405, { error: 'Method not allowed' })
        } catch (error) {
          server.config.logger.error((error as Error).stack ?? String(error))
          sendJson(res, 500, { error: (error as Error).message })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [localFileStorePlugin(), react(), tailwindcss()],
})
