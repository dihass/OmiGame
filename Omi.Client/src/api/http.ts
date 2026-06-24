import { API_BASE } from './baseUrl'

export class ApiError extends Error {
  readonly status: number
  readonly code:   'unauthorized' | 'not_found' | 'conflict' | 'rate_limited' | 'server' | 'network' | 'timeout' | 'unknown'

  constructor(message: string, status: number, code: ApiError['code']) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
    this.code   = code
  }
}

function codeForStatus(status: number): ApiError['code'] {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404)                    return 'not_found'
  if (status === 409)                    return 'conflict'
  if (status === 429)                    return 'rate_limited'
  if (status >= 500)                     return 'server'
  return 'unknown'
}

function messageForCode(code: ApiError['code'], fallback: string): string {
  switch (code) {
    case 'unauthorized':  return 'Your session has expired. Please rejoin.'
    case 'not_found':     return 'Lobby not found.'
    case 'conflict':      return fallback || 'This action is no longer valid.'
    case 'rate_limited':  return 'Too many requests — slow down a moment.'
    case 'server':        return 'The server hit an error. Try again in a moment.'
    case 'network':       return 'Network error — check your connection.'
    case 'timeout':       return 'Request timed out. Try again.'
    default:              return fallback || 'Something went wrong.'
  }
}

async function extractError(res: Response): Promise<string> {
  const ctype = res.headers.get('content-type') ?? ''
  try {
    if (ctype.includes('application/json')) {
      const body = await res.json() as Record<string, unknown>
      // ASP.NET Core ProblemDetails: { title, detail, errors }
      if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
      if (typeof body.title  === 'string' && body.title.trim())  return body.title
      if (typeof body.message === 'string')                       return body.message
    }
    const text = (await res.text()).trim()
    if (text) return text
  } catch { /* fall through */ }
  return ''
}

export async function apiFetch<T>(
  input: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000 } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // Prefix with API_BASE in production; in dev it's '' so the Vite proxy handles it
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`

  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(messageForCode('timeout', ''), 0, 'timeout')
    }
    throw new ApiError(messageForCode('network', ''), 0, 'network')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const raw  = await extractError(res)
    const code = codeForStatus(res.status)
    throw new ApiError(messageForCode(code, raw), res.status, code)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  try {
    return await res.json() as T
  } catch {
    throw new ApiError('Server returned malformed data.', res.status, 'server')
  }
}
