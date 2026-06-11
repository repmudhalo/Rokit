import { Router } from 'express'
import * as sourcesRepo from '../repos/sources.js'
import { getTwitchClips } from '../clips/twitch.js'
import { getKickClips } from '../clips/kick.js'
import { oauthEnabled } from '../config.js'

export const clipsRouter = Router()

// Recent clips aggregated across the user's connected channels.
clipsRouter.get('/', async (req, res) => {
  const sources = await sourcesRepo.listEnabled(req.user.id)
  const tasks = []
  for (const s of sources) {
    if (s.platform === 'twitch') tasks.push(getTwitchClips(s.channel))
    else if (s.platform === 'kick') tasks.push(getKickClips(s.channel))
  }
  const results = await Promise.all(tasks.map((p) => p.catch(() => [])))

  const seen = new Set()
  const clips = results
    .flat()
    .filter((c) => {
      const k = `${c.platform}:${c.id}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 80)

  res.json({
    clips,
    twitchConfigured: oauthEnabled(),
    hasTwitch: sources.some((s) => s.platform === 'twitch'),
    hasKick: sources.some((s) => s.platform === 'kick'),
  })
})
