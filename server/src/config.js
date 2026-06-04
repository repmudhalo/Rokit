import 'dotenv/config'

const num = (v, d) => (v === undefined || v === '' ? d : Number(v))

export const config = {
  port: num(process.env.PORT, 8080),
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://chataggr:chataggr@localhost:5432/chataggr',
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-change-me',
  cookieName: 'chataggr_session',
  cookieSecure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  backlogSize: num(process.env.BACKLOG_SIZE, 50),
  idleMs: num(process.env.HUB_IDLE_MS, 60000),
  maxSourcesPerUser: num(process.env.MAX_SOURCES_PER_USER, 25),
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    redirectBase: process.env.OAUTH_REDIRECT_BASE || `http://localhost:${num(process.env.PORT, 8080)}`,
  },
  // Public base URL used to build links in emails (verify/reset). In dev where
  // the frontend runs on Vite, set APP_URL=http://localhost:5173.
  appUrl:
    process.env.APP_URL ||
    process.env.OAUTH_REDIRECT_BASE ||
    `http://localhost:${num(process.env.PORT, 8080)}`,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Rokit <no-reply@rokit.app>',
  },
}

// When no SMTP host is configured, emails are logged to the console instead of
// sent — so local testing works without a mail provider.
export const mailConfigured = () => Boolean(config.smtp.host)

// Twitch OAuth login is only offered when credentials are configured.
export const oauthEnabled = () =>
  Boolean(config.twitch.clientId && config.twitch.clientSecret)
