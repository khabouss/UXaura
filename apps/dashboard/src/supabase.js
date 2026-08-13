import { createClient } from '@supabase/supabase-js'

// The publishable key only — safe in the browser. Session tokens it issues
// are what the dashboard sends as a Bearer token to our own server, which
// verifies them server-side with the secret key. See db.js on the server.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)
