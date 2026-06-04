import { config } from '../config.js'
import { sendMail } from './mailer.js'

const link = (path, token) =>
  `${config.appUrl}${path}?token=${encodeURIComponent(token)}`

export function sendVerificationEmail(user, token) {
  const url = link('/verify-email', token)
  return sendMail({
    to: user.email,
    subject: 'Verify your Rokit email',
    text:
      `Hi ${user.display_name || ''},\n\n` +
      `Confirm your email for Rokit by opening this link (valid 24 hours):\n\n${url}\n\n` +
      `If you didn't create an account, you can ignore this email.`,
    html:
      `<p>Hi ${user.display_name || ''},</p>` +
      `<p>Confirm your email for Rokit (link valid 24 hours):</p>` +
      `<p><a href="${url}">Verify my email</a></p>` +
      `<p>If you didn't create an account, you can ignore this email.</p>`,
  })
}

export function sendPasswordResetEmail(user, token) {
  const url = link('/reset-password', token)
  return sendMail({
    to: user.email,
    subject: 'Reset your Rokit password',
    text:
      `Hi ${user.display_name || ''},\n\n` +
      `Reset your Rokit password using this link (valid 1 hour):\n\n${url}\n\n` +
      `If you didn't request this, you can ignore this email — your password won't change.`,
    html:
      `<p>Hi ${user.display_name || ''},</p>` +
      `<p>Reset your Rokit password (link valid 1 hour):</p>` +
      `<p><a href="${url}">Reset my password</a></p>` +
      `<p>If you didn't request this, ignore this email — your password won't change.</p>`,
  })
}
