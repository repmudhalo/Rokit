import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function run() {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await pool.query(sql)
  console.log('✓ migrations applied')
  await pool.end()
}

run().catch((err) => {
  console.error('migration failed:', err.message)
  process.exit(1)
})
