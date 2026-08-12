import { pastTenseVerb } from './utils.js'

const defaultClassNames = {
  root: 'uxa-toast',
  message: '',
  undoButton: 'uxa-toast-undo',
  closeButton: 'uxa-toast-close',
}

// The "you just did this" confirmation. Pass classNames to restyle it, or
// swap it out entirely via <UXauraWatcher components={{ Toast: MyToast }} />
// — a full replacement gets the same three props: rule, onUndo, onDismiss.
export function Toast({ rule, onUndo, onDismiss, classNames = {} }) {
  const c = { ...defaultClassNames, ...classNames }

  return (
    <div className={c.root}>
      <span className={c.message}>
        You {pastTenseVerb(rule.action)} the {rule.targetName || 'thing'}.
      </span>
      <button className={c.undoButton} onClick={onUndo}>
        Undo
      </button>
      <button className={c.closeButton} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
