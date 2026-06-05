import { useEffect, useRef, useState } from 'react'
import { wsUrl } from './apiBase.js'

// Connects to the server's /ws hub for a given overlay token, applies the
// initial backlog, then appends live messages. Auto-reconnects with backoff.
//
// Design notes:
//  • High-volume channels fire many messages/sec. Incoming messages are
//    buffered and flushed on a short timer (FLUSH_MS) so React re-renders a few
//    times/sec instead of per-message — no main-thread thrashing.
//  • ALL mutation (dedup set, stats, the message list) happens in `flush`, a
//    timer callback. We hand React a fresh immutable snapshot via setState.
//    The updater is therefore PURE — critical because React StrictMode
//    double-invokes state updaters in dev, and an impure updater (mutating a
//    dedup Set inside it) silently drops messages on the second pass.
const FLUSH_MS = 100

export function useChatSocket({ token, max = 200 } = {}) {
  const [messages, setMessages] = useState([])
  const [config, setConfig] = useState(null) // overlay appearance settings
  const [status, setStatus] = useState('connecting') // connecting | open | closed
  const [stats, setStats] = useState({ total: 0, byPlatform: {}, perMin: 0 })

  const wsRef = useRef(null)
  const retryRef = useRef(1000)
  const listRef = useRef([]) // authoritative message list (mutated only in flush)
  const seenRef = useRef(new Set())
  const bufferRef = useRef([])
  const flushTimerRef = useRef(null)
  const totalRef = useRef(0)
  const byPlatformRef = useRef({})
  const timesRef = useRef([]) // receipt times (ms) within a rolling 60s window

  useEffect(() => {
    if (!token) {
      setStatus('closed')
      return
    }
    let stopped = false

    // Runs on a timer (never inside render/updater), so it's safe to mutate
    // refs here. We snapshot into React state at the end.
    const flush = () => {
      flushTimerRef.current = null
      const incoming = bufferRef.current
      if (!incoming.length) return
      bufferRef.current = []

      const now = Date.now()
      const list = listRef.current
      let added = 0
      for (const m of incoming) {
        if (!m || seenRef.current.has(m.id)) continue
        seenRef.current.add(m.id)
        list.push(m)
        added++
        totalRef.current++
        byPlatformRef.current[m.platform] = (byPlatformRef.current[m.platform] || 0) + 1
        timesRef.current.push(now)
      }
      if (!added) return

      if (list.length > max) {
        const removed = list.splice(0, list.length - max)
        for (const m of removed) seenRef.current.delete(m.id)
      }

      const cutoff = now - 60000
      while (timesRef.current.length && timesRef.current[0] < cutoff) timesRef.current.shift()

      setMessages(list.slice()) // immutable snapshot → pure update
      setStats({ total: totalRef.current, byPlatform: { ...byPlatformRef.current }, perMin: timesRef.current.length })
    }

    const queue = (incoming) => {
      if (!incoming || !incoming.length) return
      for (const m of incoming) bufferRef.current.push(m)
      if (flushTimerRef.current == null) flushTimerRef.current = setTimeout(flush, FLUSH_MS)
    }

    const connect = () => {
      if (stopped) return
      const ws = new WebSocket(wsUrl(`/ws?token=${encodeURIComponent(token)}`))
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('open')
        retryRef.current = 1000
      }

      ws.onmessage = (ev) => {
        let frame
        try {
          frame = JSON.parse(ev.data)
        } catch {
          return
        }
        if (frame.type === 'backlog') queue(frame.messages || [])
        else if (frame.type === 'message') queue([frame.message])
        else if (frame.type === 'config') setConfig(frame.settings || null)
      }

      ws.onclose = () => {
        setStatus('closed')
        if (stopped) return
        setTimeout(connect, retryRef.current)
        retryRef.current = Math.min(retryRef.current * 2, 15000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      stopped = true
      if (flushTimerRef.current != null) clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
      bufferRef.current = []
      wsRef.current?.close()
    }
  }, [token, max])

  return { messages, config, status, stats }
}
