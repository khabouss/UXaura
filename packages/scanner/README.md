# @uxaura/scanner

Reads a React app's own source for elements already tagged the way the
SDK expects, and uploads them as the project's Map — no manual "add a part"
step in the dashboard.

## Convention

Tag anything you want UXaura to be able to change:

```jsx
<div
  data-uxa-id="hero-carousel"       // required — stable key
  data-uxa-route="/"                // required — which page this is on
  data-uxa-name="Hero carousel"     // optional — defaults to a humanized key
  data-uxa-description="…"          // optional
>
```

`data-uxa-route` is required and explicit, on purpose — tracing which route
actually renders a given component statically is fragile the moment a
component is reused or conditionally rendered. Saying it directly at the tag
site has no ambiguity.

## Usage

Add a `uxaura.config.js` next to your app's `package.json`:

```js
export default {
  include: ['src/**/*.jsx'],
}
```

Then run:

```bash
UXAURA_API_URL=https://your-server.example.com \
UXAURA_PROJECT_KEY=your-project-key \
npx uxaura-scan
```

Without the env vars set, it prints what it found instead of uploading —
safe to run locally to check what would be sent.

## What it will never do

A scan only adds new anchors and refreshes the name/description of ones it
already knows about. It never deletes an anchor, and it never touches
`locked`/`lockReason` — an owner's protection in the dashboard survives
every re-scan untouched.
