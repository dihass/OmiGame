async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function authToken(
  playerId: string,
  displayName: string,
  lobbyId: string,
): Promise<string> {
  const res = await fetch('/api/lobby/auth', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ playerId, displayName, lobbyId }),
  })
  const data = await json<{ token: string }>(res)
  return data.token
}
