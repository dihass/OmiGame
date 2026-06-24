import type { Card, GameSession, Suit } from '../types/game'
import { apiFetch } from './http'

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra }
}

export async function createRoom(lobbyId: string, token: string): Promise<GameSession> {
  return apiFetch<GameSession>(`/api/game/create/${encodeURIComponent(lobbyId)}`, {
    method:  'POST',
    headers: authHeaders(token),
  })
}

export async function joinRoom(lobbyId: string, token: string): Promise<GameSession> {
  return apiFetch<GameSession>(`/api/game/join/${encodeURIComponent(lobbyId)}`, {
    method:  'POST',
    headers: authHeaders(token),
  })
}

export async function startGame(lobbyId: string, token: string): Promise<GameSession> {
  return apiFetch<GameSession>(`/api/game/start/${encodeURIComponent(lobbyId)}`, {
    method:  'POST',
    headers: authHeaders(token),
  })
}

export async function setTrump(lobbyId: string, suit: Suit, token: string): Promise<GameSession> {
  return apiFetch<GameSession>(
    `/api/game/set-trump/${encodeURIComponent(lobbyId)}?suit=${encodeURIComponent(suit)}`,
    { method: 'POST', headers: authHeaders(token) },
  )
}

export async function playCard(lobbyId: string, card: Card, token: string): Promise<GameSession> {
  return apiFetch<GameSession>(`/api/game/play-card/${encodeURIComponent(lobbyId)}`, {
    method:  'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body:    JSON.stringify(card),
  })
}
