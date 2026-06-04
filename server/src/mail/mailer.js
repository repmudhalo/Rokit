import nodemailer from 'nodemailer'
import { config, mailConfigured } from '../config.js'

// Lazily-built transport. With SMTP configured, sends real email. Without it,
// a dev transport prints the message (and any links) to the server console so
// verification/reset flows are testable with zero setup.
let transport

function getTransport() {
  if (transport) return transport
  if (mailConfigured()) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  } else {
    transport = {
      sendMail: async (msg) => {
        console.log(
          `\n──────── DEV EMAIL (no SMTP configured) ────────\n` +
            `To:      ${msg.to}\n` +
            `Subject: ${msg.subject}\n\n` +
            `${msg.text}\n` +
            `────────────────────────────────────────────────\n`,
        )
        return { dev: true }
      },
    }
  }
  return transport
}

export async function sendMail({ to, subject, text, html }) {
  try {
    await getTransport().sendMail({ from: config.smtp.from, to, subject, text, html })
  } catch (err) {
    // Never let a mail failure crash a request; log it for ops.
    console.error('[mail] send failed:', err.message)
  }
}
