// Thin fetch wrapper around the server. In the real product this would sign
// requests with the token the host app supplies (see ARCHITECTURE-v2 Part 4).

export function createApi(baseUrl) {
  async function request(path, options) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
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
