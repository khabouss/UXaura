import { supabase } from './supabase.js'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

async function request(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  listProjects: () => request('/api/projects'),
  createProject: (name, slug) => request('/api/projects', { method: 'POST', body: JSON.stringify({ name, slug }) }),
  listAnchors: (projectId) => request(`/api/admin/anchors?projectId=${projectId}`),
  createAnchor: (projectId, anchor) =>
    request('/api/admin/anchors', { method: 'POST', body: JSON.stringify({ projectId, ...anchor }) }),
  setBoundary: (projectId, route, anchorId, locked, reason) =>
    request('/api/admin/boundaries', {
      method: 'POST',
      body: JSON.stringify({ projectId, route, anchorId, locked, reason }),
    }),
  getReports: (projectId) => request(`/api/admin/reports?projectId=${projectId}`),
  listTools: (projectId) => request(`/api/admin/tools?projectId=${projectId}`),
  createTool: (projectId, tool) => request('/api/admin/tools', { method: 'POST', body: JSON.stringify({ projectId, ...tool }) }),
  setToolEnabled: (projectId, toolId, enabled) =>
    request(`/api/admin/tools/${toolId}/toggle`, { method: 'POST', body: JSON.stringify({ projectId, enabled }) }),
}
