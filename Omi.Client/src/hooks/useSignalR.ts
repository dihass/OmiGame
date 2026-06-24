import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { SIGNALR_EVENTS } from '../constants/signalrEvents'
import type { GameSession } from '../types/game'

export interface SignalRHandlers {
  onLobbyUpdated:       (session: GameSession) => void
  onRoundStarted:       (session: GameSession) => void
  onTrumpSelected:      (session: GameSession) => void
  onCardPlayed:         (session: GameSession) => void
  onGameResumed:        (session: GameSession) => void
  onPlayerDisconnected: (playerId: string) => void
  onPlayerReconnected:  () => void
  onLobbyClosed:        () => void
  onLobbyNotFound:      () => void
}

export function useSignalR(jwt: string | null, handlers: SignalRHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!jwt) return

    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/ws/game', { accessTokenFactory: () => jwt })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    conn.on(SIGNALR_EVENTS.LOBBY_UPDATED,       (s: GameSession) => handlersRef.current.onLobbyUpdated(s))
    conn.on(SIGNALR_EVENTS.ROUND_STARTED,       (s: GameSession) => handlersRef.current.onRoundStarted(s))
    conn.on(SIGNALR_EVENTS.TRUMP_SELECTED,      (s: GameSession) => handlersRef.current.onTrumpSelected(s))
    conn.on(SIGNALR_EVENTS.CARD_PLAYED,         (s: GameSession) => handlersRef.current.onCardPlayed(s))
    conn.on(SIGNALR_EVENTS.GAME_RESUMED,        (s: GameSession) => handlersRef.current.onGameResumed(s))
    conn.on(SIGNALR_EVENTS.PLAYER_DISCONNECTED, (pid: string)    => handlersRef.current.onPlayerDisconnected(pid))
    conn.on(SIGNALR_EVENTS.PLAYER_RECONNECTED,  ()               => handlersRef.current.onPlayerReconnected())
    conn.on(SIGNALR_EVENTS.LOBBY_CLOSED,        ()               => handlersRef.current.onLobbyClosed())
    conn.on(SIGNALR_EVENTS.LOBBY_NOT_FOUND,     ()               => handlersRef.current.onLobbyNotFound())

    conn.start().catch(console.error)

    return () => { conn.stop() }
  }, [jwt])
}
