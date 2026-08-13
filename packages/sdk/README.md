# uxaura

A silent, trigger-driven watcher for React apps. It stays invisible until it
detects real friction — a rage click, a dead click, a form abandoned — then
drops a small prompt right where it happened, instead of a chat bubble
nobody opens.

No AI runs in the browser. Detection is plain JS reading DOM events; the
only network call happens if the user actually replies.

## Install

```bash
npm install uxaura
```

## Quick start

```jsx
import { UXauraProvider, UXauraWatcher } from 'uxaura'
import 'uxaura/styles.css'

function App() {
  return (
    <UXauraProvider
      projectKey="your-project-key"
      userId={currentUser.id}
      route={pathname}
      apiBaseUrl="https://your-server.example.com"
    >
      <YourApp />
      <UXauraWatcher />
    </UXauraProvider>
  )
}
```

`projectKey` identifies which tenant's Map/Rules/Boundaries this app talks
to — generate one from the dashboard's project screen. `UXauraProvider`
fetches and applies rules to elements tagged with `data-uxa-id`.
`UXauraWatcher` is invisible until a trigger fires, a change was just made,
or there's something active on the page to review.

`UXauraProvider` and `UXauraWatcher` are the client half of a larger system —
they expect a multi-tenant server implementing `/api/map`, `/api/rules`,
`/api/chat`, and the `/api/admin/*` dashboard endpoints, authenticated via
the `x-uxaura-project-key` header this SDK sends on every request. See the
[full project](https://github.com/khabouss/UXaura) for the reference server
and the owner dashboard.

## Built-in triggers

Eight ready to use, matching the frustration-signal taxonomy FullStory and
Hotjar already track in session recordings — no AI in any of them:

```jsx
import {
  rageClickTrigger,
  deadClickTrigger,
  errorClickTrigger,
  thrashedCursorTrigger,
  exitIntentTrigger,
  rageScrollTrigger,
  uTurnTrigger,
  formAbandonTrigger,
} from 'uxaura'

<UXauraWatcher triggers={[rageClickTrigger(), deadClickTrigger(), exitIntentTrigger()]} />
```

Omit `triggers` and you get `rageClickTrigger()` + `deadClickTrigger()` by
default.

## Writing your own trigger

A trigger is a plain object — no special API, nothing to register beyond
passing it in the array:

```js
function myTrigger({ id = 'my-trigger', prompt = 'Need help?' } = {}) {
  return {
    id,
    events: ['click'], // any DOM event name
    handleEvent(e, { fire, now, isOwnUI }) {
      // your own logic, using ordinary closures for state
      if (/* condition */ false) fire({ prompt })
    },
  }
}
```

## Styling

Every default component takes a `classNames` prop that merges over its
internal defaults:

```jsx
<UXauraWatcher
  classNames={{
    trigger: { root: 'my-trigger-card', input: 'my-input' },
    toast: { root: 'my-toast' },
    pill: { pill: 'my-pill' },
  }}
/>
```

For full control, replace a component outright:

```jsx
<UXauraWatcher components={{ TriggerLabel: MyTriggerLabel }} />
```

A replacement receives `{ trigger, onDone }` and can call the exported
`useUXaura()` hook itself for `sendMessage` / `toggleRule` — nothing about
the defaults is required to build your own.

## License

MIT
