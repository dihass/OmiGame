import type { Card, GameSession, Suit } from '../types/game'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function createRoom(lobbyId: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/create/${lobbyId}`, { method: 'POST' }))
}

export async function joinRoom(lobbyId: string, playerId: string, displayName: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/join/${lobbyId}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ playerId, displayName }),
  }))
}

export async function startGame(lobbyId: string): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/start/${lobbyId}`, { method: 'POST' }))
}

export async function setTrump(lobbyId: string, seatIndex: number, suit: Suit): Promise<GameSession> {
  return json<GameSession>(await fetch(
    `/api/game/set-trump/${lobbyId}?seatIndex=${seatIndex}&suit=${suit}`,
    { method: 'POST' },
  ))
}

export async function playCard(lobbyId: string, seatIndex: number, card: Card): Promise<GameSession> {
  return json<GameSession>(await fetch(`/api/game/play-card/${lobbyId}?seatIndex=${seatIndex}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(card),
  }))
}
