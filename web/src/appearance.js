// Map an overlay-settings object (from the server config frame OR the local
// dashboard editor) to concrete render props. One source of truth so the OBS
// overlay and the dashboard preview look identical.
export function appearanceFrom(s = {}) {
  const fontSize = s.font_size || 18
  // platform_style supersedes the legacy show_platform boolean.
  const platformStyle = s.platform_style || (s.show_platform === false ? 'hidden' : 'label')
  const opacity = Math.max(0, Math.min(100, s.bg_opacity ?? 0)) / 100

  const containerStyle = { fontSize: `${fontSize}px` }
  if (opacity > 0) containerStyle.background = `rgba(0, 0, 0, ${opacity})`

  const listClassName = [
    s.text_shadow !== false ? 'fx-shadow' : '',
    s.message_bg === 'plate' ? 'fx-plate' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    fontSize,
    maxMessages: s.max_messages || 60,
    containerStyle,
    listClassName,
    options: {
      platformStyle, // 'label' | 'logo' | 'hidden'
      showPlatform: platformStyle !== 'hidden',
      platformPlain: !!s.platform_plain,
      showBadges: s.show_badges !== false,
      showChannel: !!s.show_channel,
    },
  }
}
