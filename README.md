# UXaura prototype

A working slice of the architecture in `ARCHITECTURE-v2.html`: a silent
watcher that only speaks up when it detects friction, a server that plans
the rule, an owner dashboard for boundaries, and a demo React app whose
layout actually changes.

## What's here

- `packages/server` — Express API. Holds the Map (dummy, hand-written), the
  Boundaries (owner-editable, live), and everyone's Rules (in memory), plus a
  short conversation memory per user per page. Plans rules with OpenAI
  function calling if `OPENAI_API_KEY` is set; otherwise falls back to a
  small keyword matcher so the whole thing runs with zero setup.
- `packages/sdk` — the npm-shaped library. `UXauraProvider` is the Hands: it
  fetches rules and applies them to the page. `UXauraWatcher` is invisible by
  default and only shows something when a trigger fires, a change was just
  made, or there's something active on the page to review. Imported by the
  demo via a Vite alias (no publish step exists yet — see below).

  **Triggers are plain JS, never AI.** `createWatcher.js` is a generic event
  multiplexer with no opinion on what counts as "something happened" — it
  just calls whichever trigger's `handleEvent` matches the DOM event. Eight
  built-ins ship in `triggers.js`, each one a signal marketing/UX analytics
  tools already surface from session recordings (FullStory's frustration
  signals, Hotjar's U-turns), built the exact same way a host app would
  build its own:

  | Trigger | Signal |
  |---|---|
  | `rageClickTrigger` | several clicks, same spot, fast |
  | `deadClickTrigger` | clicked something non-interactive, nothing happened |
  | `errorClickTrigger` | a click followed by a new error appearing on the page |
  | `thrashedCursorTrigger` | erratic/circular mouse movement (confusion, waiting) |
  | `exitIntentTrigger` | cursor makes a fast move off the top of the window |
  | `rageScrollTrigger` | scroll direction reversing repeatedly — searching |
  | `uTurnTrigger` | navigate away and straight back, quickly |
  | `formAbandonTrigger` | a field gets focused, then the form is left, unsubmitted |

  ```js
  <UXauraWatcher
    triggers={[rageClickTrigger(), deadClickTrigger(), myOwnTrigger]}
  />
  ```

  A trigger is `{ id, events: ['click', ...], handleEvent(e, { fire, now, isOwnUI }) }`
  — call `fire({ prompt })` when your own logic decides to. Events aren't
  limited to clicks: `wheel` for scroll signals, `mousemove`/`mouseout` for
  cursor and exit-intent signals, `focusin`/`focusout`/`submit` for forms,
  and `popstate`/`hashchange`/`uxaura:navigation` (a synthetic event this
  file dispatches by patching `pushState`/`replaceState` once, so ordinary
  SPA router navigation is covered too) for U-turns. The demo also defines
  one entirely on its own (`apps/demo/src/longHoverTrigger.js`, a hover-and-
  hold check) to prove that's a supported thing to do alongside the
  built-ins, not just a fixed set.

  **Every rendered piece is stylable or replaceable.** `TriggerLabel`,
  `Toast`, and `ChangesPill` each take a `classNames` prop that merges over
  sensible defaults — restyle any part without forking anything. For total
  control, swap the component outright:

  ```js
  <UXauraWatcher components={{ TriggerLabel: MyLabel, Toast: MyToast, Pill: MyPill }} />
  ```

  A full replacement gets a small, documented prop contract (see the JSDoc
  comment at the top of each default component) and can call the exported
  `useUXaura()` hook itself for `sendMessage` / `toggleRule` — nothing about
  the defaults is required to build your own.
- `apps/dashboard` — the owner's view: lock or unlock any named part of the
  app, with a reason shown to users who ask for it. Talks to the same
  server, live, no redeploy.
- `apps/demo` — a small React site (home page + product page) with a hero
  carousel, a filters sidebar, a promo banner, a newsletter signup form, and
  a locked price tag, all tagged with `data-uxa-id` the way the real build
  plugin would tag them. The newsletter form is a real `<form>` on purpose —
  it's what makes `errorClickTrigger` (submit an invalid email) and
  `formAbandonTrigger` (focus the field, then click away and wait) provable.

## Run it

```bash
npm install
npm run dev:server      # http://localhost:4000
npm run dev:demo        # http://localhost:5173
npm run dev:dashboard   # http://localhost:5174
```

No `OPENAI_API_KEY` needed to try it. On the demo site, click the same spot
three times fast on something non-interactive (a product thumbnail, for
example) to trigger a rage-click label, or click plain text once and wait
half a second for a dead-click label — both ask a short question right where
you clicked. Type into it like you would a chat. Try "hide the price" on the
product page to see a refusal (it's a locked anchor) — or lock something
else yourself first, from the dashboard. Reload the page to see rules
persist and re-apply on load.

To use the real model instead of the keyword fallback, copy
`packages/server/.env.example` to `packages/server/.env` and set
`OPENAI_API_KEY`.

## What this does and doesn't prove

Proves: the loop works end to end — silent by default, ask (by trigger or
by click), plan, check against live boundaries, apply, undo, drift-safe
lookup by name not position, and an owner can change what's allowed without
a redeploy.

Doesn't attempt yet: the real build-time scanner (anchors are hand-tagged
here), server-pushed sync across tabs, screen-size conditions, or
persistence beyond the server process's memory — restarting the server
resets both the Rules and the Boundaries to their defaults.
