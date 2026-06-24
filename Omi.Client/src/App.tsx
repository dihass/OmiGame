import { useState } from 'react'
import type { Card, GameSession, Suit } from './types/game'
import { authToken } from './api/auth'
import * as gameApi from './api/game'
import { ApiError } from './api/http'
import { useSignalR } from './hooks/useSignalR'
import LobbyScreen from './components/lobby/LobbyScreen'
import WaitingRoom from './components/lobby/WaitingRoom'
import GameTable from './components/game/GameTable'
import ConnectionBanner from './components/ConnectionBanner'
import { soundPlayerJoin, soundGameStart, soundAiyo } from './lib/sounds'

type View = 'lobby' | 'waiting' | 'game'

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError || e instanceof Error) return e.message
  return fallback
}

export default function App() {
  const [view, setView]                 = useState<View>('lobby')
  const [session, setSession]           = useState<GameSession | null>(null)
  const [myPlayerId, setMyPlayerId]     = useState('')
  const [myLobbyId, setMyLobbyId]       = useState('')
  const [isLobbyCreator, setIsLobbyCreator] = useState(false)
  const [jwt, setJwt]                   = useState<string | null>(null)
  const [myHand, setMyHand]                 = useState<Card[]>([])
  const [disconnectedId, setDisconnectedId] = useState<string | null>(null)
  const [lobbyClosed, setLobbyClosed]   = useState(false)
  const [lobbyError, setLobbyError]     = useState<string | null>(null)
  const [startError, setStartError]     = useState<string | null>(null)
  const [actionError, setActionError]   = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)

  // ── SignalR lifecycle ──────────────────────────────────────────────────────
  const connectionState = useSignalR(jwt, {
    onLobbyUpdated:       (s) => { setSession(s); setView(v => v === 'game' ? 'game' : 'waiting') },
    onRoundStarted:       (s) => { if (s.roundHistory.length === 0) soundGameStart(); setSession(s); setView('game') },
    onTrumpSelected:      setSession,
    onCardPlayed:         setSession,
    onHandDealt:          (hand) => setMyHand(hand),
    onGameResumed:        (s) => { setSession(s); setDisconnectedId(null); setView('game') },
    onPlayerDisconnected: (id) => { setDisconnectedId(id); soundAiyo() },
    onPlayerReconnected:  () => setDisconnectedId(null),
    onLobbyClosed:        () => { setLobbyClosed(true); setDisconnectedId(null) },
    onLobbyNotFound:      () => { setLobbyError('Lobby no longer exists.'); handleReturnToLobby() },
  })

  // ── Token expiry / forced logout ──────────────────────────────────────────
  function handleUnauthorized(message: string) {
    setLobbyError(message)
    handleReturnToLobby()
  }

  // ── Lobby join / create ────────────────────────────────────────────────────
  async function handleJoin(displayName: string, lobbyId: string, create: boolean) {
    setLobbyError(null)

    // Defensive client-side guards in case a caller bypasses the form.
    const trimmedName = displayName.trim()
    const normalized  = lobbyId.trim().toUpperCase()
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      setLobbyError('Name must be 2–30 characters.')
      return
    }
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setLobbyError('Lobby code must be 6 letters or digits.')
      return
    }
    if (typeof crypto?.randomUUID !== 'function') {
      setLobbyError('Your browser is missing a feature we need (crypto.randomUUID). Please update it.')
      return
    }

    const playerId = crypto.randomUUID()
    try {
      const token = await authToken(playerId, trimmedName, normalized)
      if (create) await gameApi.createRoom(normalized, token)
      const s = await gameApi.joinRoom(normalized, token)

      soundPlayerJoin()
      setMyPlayerId(playerId)
      setMyLobbyId(normalized)
      setIsLobbyCreator(create)
      setSession(s)
      setLobbyClosed(false)
      setDisconnectedId(null)
      setStartError(null)
      setActionError(null)
      setView('waiting')
      setJwt(token)
    } catch (e) {
      setLobbyError(errorMessage(e, 'Could not join lobby.'))
    }
  }

  // ── Game actions ───────────────────────────────────────────────────────────
  async function handleStart() {
    setStartError(null)
    if (!jwt) return handleUnauthorized('Your session has expired. Please rejoin.')
    try {
      const s = await gameApi.startGame(myLobbyId, jwt)
      setSession(s)
      setView('game')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return handleUnauthorized(e.message)
      setStartError(errorMessage(e, 'Could not start game.'))
    }
  }

  async function handleStartRound() {
    if (!jwt) return handleUnauthorized('Your session has expired. Please rejoin.')
    try {
      setSession(await gameApi.startGame(myLobbyId, jwt))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return handleUnauthorized(e.message)
      // Other failures (conflict, server) — surface them; SignalR will re-sync state shortly.
      setActionError(errorMessage(e, 'Could not start next round.'))
    }
  }

  async function handleSetTrump(suit: Suit) {
    if (!jwt) return handleUnauthorized('Your session has expired. Please rejoin.')
    try {
      setSession(await gameApi.setTrump(myLobbyId, suit, jwt))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return handleUnauthorized(e.message)
      // Re-throw so GameTable's caller can show an inline trump error
      throw e instanceof Error ? e : new Error(errorMessage(e, 'Could not set trump.'))
    }
  }

  async function handlePlayCard(card: Card) {
    if (!jwt) {
      handleUnauthorized('Your session has expired. Please rejoin.')
      throw new Error('Not authenticated')
    }
    // Optimistic removal so the card disappears immediately on tap
    const prevHand = myHand
    setMyHand(h => h.filter(c => !(c.suit === card.suit && c.rank === card.rank)))
    try {
      setSession(await gameApi.playCard(myLobbyId, card, jwt))
    } catch (e) {
      // Restore the card so the player can try again — without this the card vanishes
      // until the SignalR re-sync arrives.
      setMyHand(prevHand)
      if (e instanceof ApiError && e.code === 'unauthorized') {
        handleUnauthorized(e.message)
      }
      throw e instanceof Error ? e : new Error(errorMessage(e, 'Could not play card.'))
    }
  }

  function handleReturnToLobby() {
    setJwt(null)
    setSession(null)
    setMyPlayerId('')
    setMyLobbyId('')
    setIsLobbyCreator(false)
    setLobbyClosed(false)
    setDisconnectedId(null)
    setStartError(null)
    setActionError(null)
    setMyHand([])
    setView('lobby')
  }

  async function handleCopyCode() {
    // navigator.clipboard is undefined on insecure origins (non-HTTPS, non-localhost).
    // Fall back to the legacy execCommand path so the copy button still works in dev / on LAN.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(myLobbyId)
      } else {
        const ta = document.createElement('textarea')
        ta.value = myLobbyId
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity  = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStartError('Could not copy code — copy it manually.')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === 'lobby' || !session) {
    return <LobbyScreen onJoin={handleJoin} error={lobbyError} />
  }

  if (view === 'waiting') {
    return (
      <>
        <ConnectionBanner state={connectionState} />
        <WaitingRoom
          session={session} myPlayerId={myPlayerId} isCreator={isLobbyCreator}
          onStart={handleStart} onCopyCode={handleCopyCode} copied={copied} startError={startError}
        />
      </>
    )
  }

  return (
    <>
      <ConnectionBanner state={connectionState} />
      <GameTable
        session={session} myPlayerId={myPlayerId} isCreator={isLobbyCreator}
        myHand={myHand}
        onPlayCard={handlePlayCard} onSetTrump={handleSetTrump} onStartRound={handleStartRound}
        disconnectedId={disconnectedId} lobbyClosed={lobbyClosed} onReturnToLobby={handleReturnToLobby}
      />
      {actionError && (
        <div
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm cursor-pointer"
          style={{ background: 'rgba(120,0,0,0.85)', border: '1px solid rgba(200,0,0,0.45)', color: '#fca5a5' }}
          onClick={() => setActionError(null)}
        >
          {actionError} <span style={{ opacity: 0.7, marginLeft: 6 }}>tap to dismiss</span>
        </div>
      )}
    </>
  )
}
