import { Router } from 'express'
import * as sourcesRepo from '../repos/sources.js'
import { manager } from '../hub/manager.js'
import { config } from '../config.js'
import { SUPPORTED_PLATFORMS } from '../sources/factory.js'
import { parseBroadcastId } from '../sources/x.js'

export const sourcesRouter = Router()

// Normalize a channel handle: strip url/@/#, lowercase.
function cleanChannel(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com)\//i, '')
    .replace(/[/#@].*$/, '')
    .replace(/^[#@]/, '')
    .toLowerCase()
}

// X broadcast ids are case-sensitive — extract the id, preserve case.
function cleanForPlatform(platform, raw) {
  return platform === 'x' ? parseBroadcastId(raw) : cleanChannel(raw)
}

sourcesRouter.get('/', async (req, res) => {
  res.json({ sources: await sourcesRepo.list(req.user.id) })
})

sourcesRouter.post('/', async (req, res) => {
  const platform = String(req.body?.platform || '').toLowerCase()
  const channel = cleanForPlatform(platform, req.body?.channel)
  const chatroomId = req.body?.chatroomId ? String(req.body.chatroomId).trim() : null

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `unsupported platform (use one of: ${SUPPORTED_PLATFORMS.join(', ')})` })
  }
  if (!channel) {
    return res.status(400).json({
      error: platform === 'x' ? 'paste a live broadcast URL (x.com/i/broadcasts/…)' : 'channel is required',
    })
  }

  if ((await sourcesRepo.countForUser(req.user.id)) >= config.maxSourcesPerUser)
    return res.status(403).json({ error: `source limit reached (${config.maxSourcesPerUser})` })

  try {
    const source = await sourcesRepo.create(req.user.id, { platform, channel, chatroomId })
    await manager.reload(req.user.id)
    res.status(201).json({ source })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'you already added that channel' })
    throw err
  }
})

sourcesRouter.patch('/:id', async (req, res) => {
  const enabled = Boolean(req.body?.enabled)
  const source = await sourcesRepo.setEnabled(req.user.id, req.params.id, enabled)
  if (!source) return res.status(404).json({ error: 'not found' })
  await manager.reload(req.user.id)
  res.json({ source })
})

sourcesRouter.delete('/:id', async (req, res) => {
  const ok = await sourcesRepo.remove(req.user.id, req.params.id)
  if (!ok) return res.status(404).json({ error: 'not found' })
  await manager.reload(req.user.id)
  res.json({ ok: true })
})
