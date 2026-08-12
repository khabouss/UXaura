import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { createApi } from './api.js'
import { applyRules } from './hands.js'
import { humanize } from './utils.js'

const UXauraContext = createContext(null)

export function useUXaura() {
  const ctx = useContext(UXauraContext)
  if (!ctx) throw new Error('useUXaura must be used inside a UXauraProvider')
  return ctx
}

// This is what ships in the customer's app. It never runs a model — it
// fetches rules, applies them with the Hands, and sends questions up to the
// server. See ARCHITECTURE-v2.html Part two.
export function UXauraProvider({ appId, apiBaseUrl = 'http://localhost:4000', userId, route, children }) {
  const api = useMemo(() => createApi(apiBaseUrl), [apiBaseUrl])
  const [rules, setRules] = useState([])
  const [map, setMap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastEvent, setLastEvent] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getMap()
      .then((data) => {
        if (!cancelled) setMap(data)
      })
      .catch((err) => console.error('[uxaura] failed to load the Map', err))
    return () => {
      cancelled = true
    }
  }, [api])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getRules(userId)
      .then((data) => {
        if (!cancelled) setRules(data.rules)
      })
      .catch((err) => console.error('[uxaura] failed to load rules', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api, userId])

  useEffect(() => {
    applyRules(rules, route)
  }, [rules, route])

  const sendMessage = useCallback(
    async (message, clickedAnchor) => {
      const res = await api.chat({ userId, route, message, clickedAnchor })
      if (res.rule) {
        setRules((prev) => {
          const exists = prev.some((r) => r.id === res.rule.id)
          return exists ? prev.map((r) => (r.id === res.rule.id ? res.rule : r)) : [...prev, res.rule]
        })
        if (!res.alreadyActive) {
          setLastEvent({ rule: res.rule })
        }
      }
      return res
    },
    [api, userId, route]
  )

  const toggleRule = useCallback(
    async (ruleId, active) => {
      const res = await api.toggleRule(userId, ruleId, active)
      setRules((prev) => prev.map((r) => (r.id === ruleId ? res.rule : r)))
      return res.rule
    },
    [api, userId]
  )

  const anchorName = useCallback(
    (forRoute, anchorId) => {
      const anchor = map?.routes?.[forRoute]?.anchors?.find((a) => a.id === anchorId)
      return anchor?.name || humanize(anchorId)
    },
    [map]
  )

  const activeRulesForRoute = useMemo(
    () => rules.filter((r) => r.state === 'active' && r.when.route === route),
    [rules, route]
  )

  const clearLastEvent = useCallback(() => setLastEvent(null), [])

  const value = useMemo(
    () => ({
      appId,
      rules,
      activeRulesForRoute,
      loading,
      route,
      map,
      anchorName,
      sendMessage,
      toggleRule,
      lastEvent,
      clearLastEvent,
    }),
    [appId, rules, activeRulesForRoute, loading, route, map, anchorName, sendMessage, toggleRule, lastEvent, clearLastEvent]
  )

  return <UXauraContext.Provider value={value}>{children}</UXauraContext.Provider>
}
