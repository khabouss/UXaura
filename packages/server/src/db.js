import 'dotenv/config'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const { Pool } = pg

export const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: 'postgres',
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 10,
})

export function query(text, params) {
  return pool.query(text, params)
}

// Server-side only — used to verify a dashboard owner's session token.
// Never exposed to the browser; the dashboard uses the publishable key.
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
