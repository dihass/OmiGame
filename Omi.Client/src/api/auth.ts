import { apiFetch } from './http'

export async function authToken(
  playerId: string,
  displayName: string,
  lobbyId: string,
): Promise<string> {
  const data = await apiFetch<{ token: string }>('/api/lobby/auth', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ playerId, displayName, lobbyId }),
  })
  if (!data?.token || typeof data.token !== 'string') {
    throw new Error('Auth server returned no token.')
  }
  return data.token
}
