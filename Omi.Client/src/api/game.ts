import type { Card, GameSession, Suit } from '../types/game'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra }
}

export async function createRoom(lobbyId: string, token: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/create/${lobbyId}`, {
    method:  'POST',
    headers: authHeaders(token),
  }))
}

export async function joinRoom(lobbyId: string, token: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/join/${lobbyId}`, {
    method:  'POST',
    headers: authHeaders(token),
  }))
}

export async function startGame(lobbyId: string, token: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/start/${lobbyId}`, {
    method:  'POST',
    headers: authHeaders(token),
  }))
}

export async function setTrump(lobbyId: string, suit: Suit, token: string): Promise<GameSession> {
  return json<GameSession>(await fetch(
    `/api/game/set-trump/${lobbyId}?suit=${suit}`,
    { method: 'POST', headers: authHeaders(token) },
  ))
}

export async function playCard(lobbyId: string, card: Card, token: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/play-card/${lobbyId}`, {
    method:  'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body:    JSON.stringify(card),
  }))
}
