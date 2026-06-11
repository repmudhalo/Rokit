// Kick clips — unofficial endpoint (no official API). Best-effort: may 403 from
// servers behind Cloudflare. Clips play via HLS (.m3u8). Cached briefly.

const BROWSERY = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

const cache = new Map() // slug -> { at, clips }
const TTL = 3 * 60 * 1000

export async function getKickClips(channel) {
  const slug = channel.toLowerCase()
  const cached = cache.get(slug)
  if (cached && Date.now() - cached.at < TTL) return cached.clips
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${slug}/clips?sort=date&time=all`, {
      headers: BROWSERY,
    })
    if (!res.ok) return cached?.clips || []
    const d = await res.json()
    const list = Array.isArray(d?.clips) ? d.clips : Array.isArray(d?.data) ? d.data : []
    const clips = list
      .map((c) => ({
        id: String(c.id),
        platform: 'kick',
        channel: slug,
        title: c.title || 'Clip',
        url: `https://kick.com/${slug}?clip=${c.id}`,
        video: c.video_url || c.clip_url || null, // HLS m3u8
        thumbnail: c.thumbnail_url || '',
        views: c.view_count ?? c.views ?? 0,
        creator: c.creator?.username || '',
        createdAt: c.created_at || c.started_at || null,
        duration: Math.round(c.duration || 0),
      }))
      .filter((c) => c.thumbnail || c.video)
    cache.set(slug, { at: Date.now(), clips })
    return clips
  } catch {
    return cached?.clips || []
  }
}
