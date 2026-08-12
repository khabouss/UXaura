import { useEffect, useState } from 'react'
import { useUXaura } from './UXauraProvider.jsx'
import { createWatcher } from './createWatcher.js'
import { rageClickTrigger, deadClickTrigger } from './triggers.js'
import { TriggerLabel as DefaultTriggerLabel } from './TriggerLabel.jsx'
import { Toast as DefaultToast } from './Toast.jsx'
import { ChangesPill as DefaultChangesPill } from './ChangesPill.jsx'

// A stable default — defined once at module load, not per render, so
// passing no `triggers` prop doesn't restart the watcher on every render.
const DEFAULT_TRIGGERS = [rageClickTrigger(), deadClickTrigger()]

// Replaces the chat bubble. Nothing is visible until a trigger fires, a
// change was just made, or there's something active on this page — silent
// otherwise. Every piece is replaceable:
//
//   <UXauraWatcher
//     triggers={[rageClickTrigger(), myCustomTrigger]}   // add/remove freely
//     classNames={{ trigger: {...}, toast: {...}, pill: {...} }}
//     components={{ TriggerLabel: Mine, Toast: Mine, Pill: Mine }}
//   />
//
// `triggers` defaults to rage-click + dead-click if omitted. If you supply
// your own array, memoize it (useState/useMemo) for the same reason.
export function UXauraWatcher({ triggers = DEFAULT_TRIGGERS, classNames = {}, components = {} }) {
  const { activeRulesForRoute, toggleRule, lastEvent, clearLastEvent } = useUXaura()
  const [trigger, setTrigger] = useState(null)

  useEffect(() => {
    const watcher = createWatcher({
      triggers,
      onTrigger: (t) => setTrigger((prev) => prev ?? t),
    })
    return () => watcher.stop()
  }, [triggers])

  const TriggerComponent = components.TriggerLabel || DefaultTriggerLabel
  const ToastComponent = components.Toast || DefaultToast
  const PillComponent = components.Pill || DefaultChangesPill

  return (
    <>
      {trigger && (
        <TriggerComponent trigger={trigger} onDone={() => setTrigger(null)} classNames={classNames.trigger} />
      )}

      <div className="uxa-corner" data-uxa-ui="true">
        {lastEvent && (
          <ToastComponent
            rule={lastEvent.rule}
            onUndo={() => {
              toggleRule(lastEvent.rule.id, false)
              clearLastEvent()
            }}
            onDismiss={clearLastEvent}
            classNames={classNames.toast}
          />
        )}

        {activeRulesForRoute.length > 0 && (
          <PillComponent
            rules={activeRulesForRoute}
            onRemove={(id) => toggleRule(id, false)}
            classNames={classNames.pill}
          />
        )}
      </div>
    </>
  )
}
