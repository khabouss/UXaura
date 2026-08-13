import { useState } from 'react'
import {
  UXauraProvider,
  UXauraWatcher,
  rageClickTrigger,
  deadClickTrigger,
  errorClickTrigger,
  thrashedCursorTrigger,
  exitIntentTrigger,
  rageScrollTrigger,
  uTurnTrigger,
  formAbandonTrigger,
} from '@uxaura/sdk'
import { Home } from './pages/Home.jsx'
import { Product } from './pages/Product.jsx'
import { longHoverTrigger } from './longHoverTrigger.js'

function getOrCreateUserId() {
  // Stands in for Part four's "ask the app" pattern — a real integration
  // hands UXaura the id the host app already uses for this person.
  const key = 'uxaura-demo-user-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = 'user-' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem(key, id)
  }
  return id
}

export default function App() {
  const [route, setRoute] = useState('/')
  const [userId] = useState(getOrCreateUserId)
  // Memoized once — every built-in trigger the SDK ships, plus one this app
  // defines itself, to prove that's a supported thing to do alongside them.
  const [triggers] = useState(() => [
    rageClickTrigger(),
    deadClickTrigger(),
    errorClickTrigger(),
    thrashedCursorTrigger(),
    exitIntentTrigger({ cooldownMs: 8000 }), // shorter cooldown just for this demo
    rageScrollTrigger(),
    uTurnTrigger(),
    formAbandonTrigger(),
    longHoverTrigger(),
  ])

  return (
    <UXauraProvider
      apiBaseUrl="https://server-production-273d.up.railway.app"
      projectKey="94a7ddc344e631ebaeaacf6a1be20bd1c497200d912c5555"
      userId={userId}
      route={route}
    >
      <div className="site">
        <header className="site-header">
          <div className="site-brand">Acme Shop</div>
          <nav className="site-nav">
            <button className={route === '/' ? 'active' : ''} onClick={() => setRoute('/')}>
              Home
            </button>
            <button className={route === '/product' ? 'active' : ''} onClick={() => setRoute('/product')}>
              Product
            </button>
          </nav>
          <div className="site-user">Signed in as {userId}</div>
        </header>

        <main>{route === '/' ? <Home /> : <Product />}</main>
      </div>
      <UXauraWatcher triggers={triggers} />
    </UXauraProvider>
  )
}
