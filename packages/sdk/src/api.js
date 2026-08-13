// Thin fetch wrapper around the server. `projectKey` is the project's own
// api_key from the dashboard — it tells the multi-tenant server which
// tenant's Map/Rules/Boundaries this request is for.

export function createApi(baseUrl, projectKey) {
  async function request(path, options) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', 'x-uxaura-project-key': projectKey },
      ...options,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Request failed: ${res.status}`)
    }
    return res.json()
  }

  return {
    getMap() {
      return request('/api/map')
    },
    getRules(userId) {
      return request(`/api/rules?userId=${encodeURIComponent(userId)}`)
    },
    chat({ userId, route, message, clickedAnchor }) {
      return request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ userId, route, message, clickedAnchor }),
      })
    },
    toggleRule(userId, ruleId, active) {
      return request(`/api/rules/${ruleId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ userId, active }),
      })
    },
  }
}
