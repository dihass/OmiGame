import { useEffect, useRef, useState, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { SIGNALR_EVENTS } from '../constants/signalrEvents'
import type { Card, GameSession } from '../types/game'
import { wsUrl } from './../api/baseUrl'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface SignalRHandlers {
  onLobbyUpdated:       (session: GameSession) => void
  onRoundStarted:       (session: GameSession) => void
  onTrumpSelected:      (session: GameSession) => void
  onCardPlayed:         (session: GameSession) => void
  onHandDealt:          (hand: Card[]) => void
  onGameResumed:        (session: GameSession) => void
  onPlayerDisconnected: (playerId: string) => void
  onPlayerReconnected:  () => void
  onLobbyClosed:        () => void
  onLobbyNotFound:      () => void
}

export interface SignalRApi {
  state:     ConnectionState
  reconnect: () => void
}

export function useSignalR(jwt: string | null, handlers: SignalRHandlers): SignalRApi {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const [state, setState] = useState<ConnectionState>('idle')
  // Bumping this re-runs the effect, forcing a fresh connection. Used by the
  // manual-reconnect button when automatic retries have exhausted.
  const [reconnectKey, setReconnectKey] = useState(0)

  const reconnect = useCallback(() => setReconnectKey(k => k + 1), [])

  useEffect(() => {
    if (!jwt) { setState('idle'); return }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(wsUrl('/ws/game'), { accessTokenFactory: () => jwt })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    conn.on(SIGNALR_EVENTS.LOBBY_UPDATED,       (s: GameSession) => handlersRef.current.onLobbyUpdated(s))
    conn.on(SIGNALR_EVENTS.ROUND_STARTED,       (s: GameSession) => handlersRef.current.onRoundStarted(s))
    conn.on(SIGNALR_EVENTS.TRUMP_SELECTED,      (s: GameSession) => handlersRef.current.onTrumpSelected(s))
    conn.on(SIGNALR_EVENTS.CARD_PLAYED,         (s: GameSession) => handlersRef.current.onCardPlayed(s))
    conn.on(SIGNALR_EVENTS.HAND_DEALT,          (h: Card[])      => handlersRef.current.onHandDealt(h))
    conn.on(SIGNALR_EVENTS.GAME_RESUMED,        (s: GameSession) => handlersRef.current.onGameResumed(s))
    conn.on(SIGNALR_EVENTS.PLAYER_DISCONNECTED, (pid: string)    => handlersRef.current.onPlayerDisconnected(pid))
    conn.on(SIGNALR_EVENTS.PLAYER_RECONNECTED,  ()               => handlersRef.current.onPlayerReconnected())
    conn.on(SIGNALR_EVENTS.LOBBY_CLOSED,        ()               => handlersRef.current.onLobbyClosed())
    conn.on(SIGNALR_EVENTS.LOBBY_NOT_FOUND,     ()               => handlersRef.current.onLobbyNotFound())

    conn.onreconnecting(() => setState('reconnecting'))
    conn.onreconnected (() => setState('connected'))
    // onclose fires after automatic-reconnect exhaustion, or on explicit stop()
    conn.onclose       (() => setState('disconnected'))

    setState('connecting')
    conn.start()
      .then(() => setState('connected'))
      .catch(err => {
        console.error('SignalR connection failed', err)
        setState('disconnected')
      })

    return () => { void conn.stop() }
  }, [jwt, reconnectKey])

  return { state, reconnect }
}
