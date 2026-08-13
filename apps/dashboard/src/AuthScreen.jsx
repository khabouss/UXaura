import { useState } from 'react'
import { supabase } from './supabase.js'

export function AuthScreen() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // Called as supabase.auth.X(...), not extracted to a variable first —
    // these methods rely on `this`, and a bare reference silently drops it.
    const { data, error: authError } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (authError) return setError(authError.message)
    if (mode === 'signup' && !data.session) setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="muted">We sent a confirmation link to {email}.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>UXaura</h1>
        <p className="muted">{mode === 'login' ? 'Sign in to your dashboard.' : 'Create an account.'}</p>

        {error && <div className="banner-error">{error}</div>}

        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Sign up'}
        </button>

        <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
