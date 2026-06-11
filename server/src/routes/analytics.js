import { Router } from 'express'
import { manager } from '../hub/manager.js'
import * as markersRepo from '../repos/markers.js'

export const analyticsRouter = Router()

// Live session stats + recent hype clip markers.
analyticsRouter.get('/', async (req, res) => {
  const session = manager.analyticsFor(req.user.id)
  const markers = await markersRepo.recent(req.user.id, 60)
  res.json({ session, markers })
})

analyticsRouter.delete('/markers/:id', async (req, res) => {
  await markersRepo.remove(req.user.id, req.params.id)
  res.json({ ok: true })
})

analyticsRouter.delete('/markers', async (req, res) => {
  await markersRepo.clear(req.user.id)
  res.json({ ok: true })
})
