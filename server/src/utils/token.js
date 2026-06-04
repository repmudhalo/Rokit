import { randomBytes } from 'node:crypto'

// URL-safe random token (base64url). Used for overlay tokens and OAuth state.
export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url')
}
