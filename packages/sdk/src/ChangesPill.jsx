import { useState } from 'react'
import { verbLabel } from './utils.js'

const defaultClassNames = {
  wrap: 'uxa-pill-wrap',
  list: 'uxa-pill-list',
  row: 'uxa-pill-row',
  removeButton: '',
  pill: 'uxa-pill',
}

// The small "N changes on this page" affordance — not a bubble, just text.
// Swap it entirely via <UXauraWatcher components={{ Pill: MyPill }} />; a
// replacement receives rules (the active rule list) and onRemove(ruleId).
export function ChangesPill({ rules, onRemove, classNames = {} }) {
  const c = { ...defaultClassNames, ...classNames }
  const [expanded, setExpanded] = useState(false)
  const count = rules.length

  return (
    <div className={c.wrap}>
      {expanded && (
        <div className={c.list}>
          {rules.map((r) => (
            <div key={r.id} className={c.row}>
              <span>
                {r.targetName || r.target} — {verbLabel(r.action).toLowerCase()}
              </span>
              <button className={c.removeButton} onClick={() => onRemove(r.id)}>
                remove
              </button>
            </div>
          ))}
        </div>
      )}
      <button className={c.pill} onClick={() => setExpanded((v) => !v)}>
        {count} change{count > 1 ? 's' : ''} on this page
      </button>
    </div>
  )
}
