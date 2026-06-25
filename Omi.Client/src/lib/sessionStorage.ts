// Persists active-game session so a reload (or browser crash) can rejoin
// instead of dumping the player back at the lobby screen.

const SESSION_KEY      = 'omi:session'
const LAST_NAME_KEY    = 'omi:lastName'

export interface PersistedSession {
  jwt:            string
  playerId:       string
  lobbyId:        string
  displayName:    string
  isLobbyCreator: boolean
}

interface JwtPayload {
  exp?: number    // seconds since epoch
}

function parseJwt(jwt: string): JwtPayload | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    // atob can't handle URL-safe base64 padding — normalize first
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, '=')
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

/** Returns seconds remaining until JWT expiry (negative if expired). */
export function jwtTtlSeconds(jwt: string): number {
  const payload = parseJwt(jwt)
  if (!payload?.exp) return 0
  return payload.exp - Math.floor(Date.now() / 1000)
}

export function saveSession(s: PersistedSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    localStorage.setItem(LAST_NAME_KEY, s.displayName)
  } catch { /* storage full / disabled — silently no-op */ }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed.jwt || !parsed.playerId || !parsed.lobbyId) return null
    // Drop expired tokens immediately — backend will reject them anyway
    if (jwtTtlSeconds(parsed.jwt) <= 0) {
      clearSession()
      return null
    }
    return parsed
  } catch {
    clearSession()
    return null
  }
}

export function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* no-op */ }
}

/** Remembered display name for lobby pre-fill on next visit. Survives clearSession(). */
export function loadLastDisplayName(): string {
  try { return localStorage.getItem(LAST_NAME_KEY) ?? '' } catch { return '' }
}
