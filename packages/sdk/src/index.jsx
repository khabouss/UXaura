export { UXauraProvider, useUXaura } from './UXauraProvider.jsx'
export { UXauraWatcher } from './UXauraWatcher.jsx'

// Default building blocks — restyle via classNames, or use these directly
// as a starting point for your own replacement component.
export { TriggerLabel } from './TriggerLabel.jsx'
export { Toast } from './Toast.jsx'
export { ChangesPill } from './ChangesPill.jsx'

// The trigger engine. No AI: a trigger is a plain description of something
// the user did, evaluated from raw DOM events. Ship the built-ins, drop
// them, or write your own in the same shape.
export { createWatcher } from './createWatcher.js'
export {
  rageClickTrigger,
  deadClickTrigger,
  errorClickTrigger,
  thrashedCursorTrigger,
  exitIntentTrigger,
  rageScrollTrigger,
  uTurnTrigger,
  formAbandonTrigger,
} from './triggers.js'
