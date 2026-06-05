import { Router } from 'express'
import * as settingsRepo from '../repos/settings.js'

export const settingsRouter = Router()

const clampInt = (v, min, max, dflt) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, Math.round(n)))
}

settingsRouter.get('/', async (req, res) => {
  res.json({ settings: await settingsRepo.get(req.user.id) })
})

const oneOf = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt)

const clampNum = (v, min, max, dflt) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

// Sanitize the Hype Meter config so only well-formed, bounded data is stored.
function cleanWords(arr) {
  if (!Array.isArray(arr)) return []
  const out = []
  for (const it of arr) {
    const word = String(it?.word ?? '').trim().slice(0, 24)
    if (!word) continue
    out.push({ word, weight: clampNum(it?.weight, 0.1, 5, 1) })
    if (out.length >= 40) break
  }
  return out
}

function cleanHype(h) {
  const o = h && typeof h === 'object' ? h : {}
  return {
    style: oneOf(o.style, ['bar', 'vertical', 'gauge', 'segments'], 'bar'),
    label: String(o.label ?? 'CHAT HYPE').slice(0, 24),
    color: /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#8cd1ff',
    sensitivity: clampInt(o.sensitivity, 1, 10, 5),
    decay: clampInt(o.decay, 1, 10, 5),
    show_value: o.show_value !== false,
    dynamic_color: o.dynamic_color !== false,
    bg_opacity: clampInt(o.bg_opacity, 0, 100, 0),
    boost: cleanWords(o.boost),
    drain: cleanWords(o.drain),
  }
}

settingsRouter.put('/', async (req, res) => {
  const b = req.body || {}
  const patch = {}
  if (b.font_size !== undefined) patch.font_size = clampInt(b.font_size, 10, 64, 18)
  if (b.max_messages !== undefined) patch.max_messages = clampInt(b.max_messages, 5, 200, 60)
  if (b.theme !== undefined) patch.theme = oneOf(b.theme, ['shadow', 'plate'], 'shadow')
  if (b.show_badges !== undefined) patch.show_badges = Boolean(b.show_badges)
  if (b.show_platform !== undefined) patch.show_platform = Boolean(b.show_platform)
  if (b.platform_style !== undefined) patch.platform_style = oneOf(b.platform_style, ['label', 'logo', 'hidden'], 'label')
  if (b.platform_plain !== undefined) patch.platform_plain = Boolean(b.platform_plain)
  if (b.show_channel !== undefined) patch.show_channel = Boolean(b.show_channel)
  if (b.message_bg !== undefined) patch.message_bg = oneOf(b.message_bg, ['none', 'plate'], 'none')
  if (b.text_shadow !== undefined) patch.text_shadow = Boolean(b.text_shadow)
  if (b.bg_opacity !== undefined) patch.bg_opacity = clampInt(b.bg_opacity, 0, 100, 0)
  if (b.hype !== undefined) patch.hype = cleanHype(b.hype)
  res.json({ settings: await settingsRepo.update(req.user.id, patch) })
})
