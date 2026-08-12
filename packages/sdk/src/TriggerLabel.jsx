import { useEffect, useRef, useState } from 'react'
import { useUXaura } from './UXauraProvider.jsx'

const defaultClassNames = {
  root: 'uxa-trigger',
  closeButton: 'uxa-trigger-close',
  prompt: 'uxa-trigger-prompt',
  thread: 'uxa-trigger-thread',
  message: 'uxa-trigger-msg',
  messageUser: 'uxa-trigger-msg-user',
  messageAssistant: 'uxa-trigger-msg-assistant',
  form: 'uxa-trigger-row',
  input: '',
  submitButton: '',
}

// The label that appears at the point of trouble. Not a chat window — a
// short prompt anchored to where the behavior happened, with room for one
// small back-and-forth if the first answer needs following up (reusing the
// server's own conversation memory), then it gets out of the way on its own.
//
// Pass `classNames` to restyle any part without forking this file, or swap
// the whole thing out via <UXauraWatcher components={{ TriggerLabel: Mine }} />
// — build your own from scratch using the exported useUXaura() hook, which
// gives you the same sendMessage() this default implementation uses.
export function TriggerLabel({ trigger, onDone, classNames = {} }) {
  const c = { ...defaultClassNames, ...classNames }
  const { sendMessage } = useUXaura()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [thread, setThread] = useState([])
  const boxRef = useRef(null)
  const idleTimer = useRef(null)

  function resetIdle() {
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(onDone, 8000)
  }

  useEffect(() => {
    resetIdle()
    return () => idleTimer.current && window.clearTimeout(idleTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) onDone()
    }
    // Skip the click that opened this label in the first place.
    const t = window.setTimeout(() => document.addEventListener('mousedown', handleOutside), 50)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [onDone])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = value.trim()
    if (!text || sending) return

    setThread((prev) => [...prev, { role: 'user', text }])
    setValue('')
    setSending(true)
    resetIdle()

    try {
      // Only the first message carries the click's anchor — it's the
      // context for the trigger itself, not for whatever comes after.
      const clickedAnchor = thread.length === 0 ? trigger.anchorId : undefined
      const res = await sendMessage(text, clickedAnchor)
      setThread((prev) => [...prev, { role: 'assistant', text: res.reply }])
    } catch {
      setThread((prev) => [...prev, { role: 'assistant', text: "Couldn't reach the server just now." }])
    } finally {
      setSending(false)
      resetIdle()
    }
  }

  // Some triggers (a window-level navigation pattern, for instance) have no
  // click position at all — fall back to a fixed, sensible spot.
  const hasPosition = typeof trigger.x === 'number' && typeof trigger.y === 'number'
  const left = hasPosition
    ? Math.min(Math.max(trigger.x - 140, 12), window.innerWidth - 292)
    : window.innerWidth / 2 - 140
  const top = hasPosition ? Math.min(trigger.y + 18, window.innerHeight - 180) : 24

  return (
    <div className={c.root} style={{ left, top }} ref={boxRef} data-uxa-ui="true">
      <button type="button" className={c.closeButton} onClick={onDone} aria-label="Dismiss">
        ×
      </button>

      {thread.length === 0 && <div className={c.prompt}>{trigger.prompt}</div>}

      {thread.length > 0 && (
        <div className={c.thread}>
          {thread.map((m, i) => (
            <div
              key={i}
              className={`${c.message} ${m.role === 'user' ? c.messageUser : c.messageAssistant}`}
            >
              {m.text}
            </div>
          ))}
        </div>
      )}

      <form className={c.form} onSubmit={handleSubmit}>
        <input
          autoFocus
          className={c.input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            resetIdle()
          }}
          placeholder={thread.length === 0 ? "Tell me what's wrong…" : 'Anything else?'}
          disabled={sending}
        />
        <button type="submit" className={c.submitButton} disabled={sending || !value.trim()} aria-label="Send">
          {sending ? '…' : '→'}
        </button>
      </form>
    </div>
  )
}
