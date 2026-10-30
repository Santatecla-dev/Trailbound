const API = 'http://localhost:4002/api'
const tokenKey = 'trailbound_token'
export const getToken = () => localStorage.getItem(tokenKey)
export const clearToken = () => localStorage.removeItem(tokenKey)
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message ?? 'Something went wrong.')
  return data as T
}
export type User = { id: number; displayName: string; username: string; email: string }
export type Trip = { id: number; title: string; location: string; startsOn: string; endsOn: string; dayTrip: boolean; difficulty: 'gentle' | 'moderate' | 'challenging'; distanceKm: number | null; notes: string | null }
export async function register(body: Record<string, unknown>) { const data = await request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }); localStorage.setItem(tokenKey, data.token); return data.user }
export async function login(body: Record<string, unknown>) { const data = await request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }); localStorage.setItem(tokenKey, data.token); return data.user }
export const me = () => request<{ user: User }>('/me')
export const listTrips = () => request<{ trips: Trip[] }>('/trips')
export const createTrip = (body: Record<string, unknown>) => request<{ trip: Trip }>('/trips', { method: 'POST', body: JSON.stringify(body) })
export const updateTrip = (id: number, body: Record<string, unknown>) => request<{ trip: Trip }>(`/trips/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteTrip = (id: number) => request<void>(`/trips/${id}`, { method: 'DELETE' })
