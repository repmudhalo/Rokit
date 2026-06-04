import pg from 'pg'
import { config } from '../config.js'

// Single shared connection pool for the whole server.
export const pool = new pg.Pool({ connectionString: config.databaseUrl })

pool.on('error', (err) => console.error('[db] idle client error:', err.message))

export const query = (text, params) => pool.query(text, params)
