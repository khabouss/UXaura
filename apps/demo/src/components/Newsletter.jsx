import { useState } from 'react'

// A real <form>, on purpose — this is what makes errorClickTrigger and
// formAbandonTrigger demoable. Submit something without an "@" to see the
// error-click trigger fire; focus the field, type nothing useful, then
// click away and wait a few seconds to see form-abandon fire.
export function Newsletter() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setError(null)
    setDone(true)
  }

  return (
    <form
      id="newsletter-form"
      className="newsletter"
      aria-label="Newsletter signup"
      onSubmit={handleSubmit}
    >
      <h3>Get 10% off your first order</h3>
      {done ? (
        <p className="newsletter-done">You're on the list.</p>
      ) : (
        <>
          <div className="newsletter-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={error ? 'true' : 'false'}
            />
            <button type="submit">Subscribe</button>
          </div>
          {error && (
            <div role="alert" className="newsletter-error">
              {error}
            </div>
          )}
        </>
      )}
    </form>
  )
}
