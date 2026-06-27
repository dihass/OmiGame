import { useEffect, useRef, useState } from 'react'
import type { Card, GameSession, Suit } from './types/game'
import { authToken } from './api/auth'
import * as gameApi from './api/game'
import { ApiError } from './api/http'
import { useSignalR } from './hooks/useSignalR'
import LobbyScreen from './components/lobby/LobbyScreen'
import WaitingRoom from './components/lobby/WaitingRoom'
import GameTable from './components/game/GameTable'
import ConnectionBanner from './components/ConnectionBanner'
import DocsPage from './components/docs/DocsPage'
import { soundPlayerJoin, soundGameStart, soundAiyo } from './lib/sounds'
import { saveSession, loadSession, clearSession, jwtTtlSeconds } from './lib/sessionStorage'
import { randomUuid } from './lib/uuid'

type View = 'lobby' | 'waiting' | 'game'

// Restore overlay gives up after this long — backend is probably gone.
const RESTORE_TIMEOUT_MS = 10_000
// If JWT expires within this window on restore, silently mint a new one before connecting.
const JWT_REFRESH_THRESHOLD_SECONDS = 30 * 60

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError || e instanceof Error) return e.message
  return fallback
}

function isDocsPath(pathname: string) {
  return pathname === '/docs' || pathname === '/docs/'
}

export default function App() {
  const [path, setPath]                   = useState(() => window.location.pathname)
  const [view, setView]                 = useState<View>('lobby')
  const [session, setSession]           = useState<GameSession | null>(null)
  const [myPlayerId, setMyPlayerId]     = useState('')
  const [myLobbyId, setMyLobbyId]       = useState('')
  const [myDisplayName, setMyDisplayName] = useState('')
  const [isLobbyCreator, setIsLobbyCreator] = useState(false)
  const [jwt, setJwt]                   = useState<string | null>(null)
  const [myHand, setMyHand]                 = useState<Card[]>([])
  // Set, not a single string — two players can disconnect at once and we must
  // grey out both seats + clear them independently on individual reconnects.
  const [disconnectedIds, setDisconnectedIds] = useState<Set<string>>(new Set())
  const [lobbyClosed, setLobbyClosed]   = useState(false)
  const [lobbyError, setLobbyError]     = useState<string | null>(null)
  const [startError, setStartError]     = useState<string | null>(null)
  const [actionError, setActionError]   = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [isRestoring, setIsRestoring]   = useState(false)
  const restoreTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(pathname: string) {
    window.history.pushState(null, '', pathname)
    setPath(pathname)
  }

  // ── SignalR lifecycle ──────────────────────────────────────────────────────
  const { state: connectionState, reconnect } = useSignalR(jwt, {
    onLobbyUpdated:       (s) => { setSession(s); finishRestoring(); setView(v => v === 'game' ? 'game' : 'waiting') },
    onRoundStarted:       (s) => {
      if (s.roundHistory.length === 0) soundGameStart()
      // Drop the previous round's hand immediately — HandDealt for this round
      // arrives a tick later, and without this the UI briefly shows the wrong cards.
      setMyHand([])
      setSession(s); finishRestoring(); setView('game')
    },
    onTrumpSelected:      setSession,
    onCardPlayed:         setSession,
    onHandDealt:          (hand) => setMyHand(hand),
    onGameResumed:        (s) => { setSession(s); setDisconnectedIds(new Set()); finishRestoring(); setView(s.phase === 'Lobby' ? 'waiting' : 'game') },
    onPlayerDisconnected: (id) => { setDisconnectedIds(prev => { const n = new Set(prev); n.add(id); return n }); soundAiyo() },
    onPlayerReconnected:  (id) => setDisconnectedIds(prev => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n }),
    onLobbyClosed:        () => { setLobbyClosed(true); setDisconnectedIds(new Set()); finishRestoring() },
    onLobbyNotFound:      () => { setLobbyError('Your previous lobby is no longer available.'); handleReturnToLobby({ skipServerLeave: true }) },
  })

  // ── Restore previous session on mount ─────────────────────────────────────
  useEffect(() => {
    if (isDocsPath(window.location.pathname)) return

    const persisted = loadSession()
    if (!persisted) return

    setIsRestoring(true)

    void (async () => {
      let token = persisted.jwt
      // Re-auth proactively if the saved JWT is close to expiring — avoids the
      // ugly drop-and-reconnect mid-game.
      if (jwtTtlSeconds(token) < JWT_REFRESH_THRESHOLD_SECONDS) {
        try {
          token = await authToken(persisted.playerId, persisted.displayName, persisted.lobbyId)
        } catch {
          // Refresh failed (server down, validation rejected, etc.) — fall back to lobby
          clearSession()
          setIsRestoring(false)
          setLobbyError('Your session expired. Please rejoin.')
          return
        }
      }

      setMyPlayerId(persisted.playerId)
      setMyLobbyId(persisted.lobbyId)
      setMyDisplayName(persisted.displayName)
      setIsLobbyCreator(persisted.isLobbyCreator)
      setJwt(token)
      // Tentative view until SignalR delivers actual state. WaitingRoom needs a session,
      // so we render the restore overlay (see below) until the first state event arrives.
      setView('waiting')
    })()

    // Hard timeout — never strand the user on a "Reconnecting…" overlay
    restoreTimerRef.current = window.setTimeout(() => {
      if (!session) {
        setLobbyError('Could not reconnect to your previous game.')
        handleReturnToLobby({ skipServerLeave: true })
      }
    }, RESTORE_TIMEOUT_MS)

    return () => { if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current) }
    // Intentionally only on mount; further reloads start a fresh restore flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear the restore overlay once we have real state from the server
  function finishRestoring() {
    if (!isRestoring) return
    setIsRestoring(false)
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current)
      restoreTimerRef.current = null
    }
  }

  // ── Persist session on auth/lobby changes ─────────────────────────────────
  useEffect(() => {
    if (jwt && myPlayerId && myLobbyId && myDisplayName) {
      saveSession({
        jwt,
        playerId:       myPlayerId,
        lobbyId:        myLobbyId,
        displayName:    myDisplayName,
        isLobbyCreator,
      })
    }
  }, [jwt, myPlayerId, myLobbyId, myDisplayName, isLobbyCreator])

  // ── Token expiry / forced logout ──────────────────────────────────────────
  function handleUnauthorized(message: string) {
    setLobbyError(message)
    handleReturnToLobby({ skipServerLeave: true })
  }

  // ── Lobby join / create ────────────────────────────────────────────────────
  async function handleJoin(displayName: string, lobbyId: string, create: boolean) {
    setLobbyError(null)

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
    let playerId: string
    try { playerId = randomUuid() }
    catch (e) {
      setLobbyError(e instanceof Error ? e.message : 'Your browser is missing required features.')
      return
    }
    try {
      const token = await authToken(playerId, trimmedName, normalized)
      if (create) await gameApi.createRoom(normalized, token)
      const s = await gameApi.joinRoom(normalized, token)

      soundPlayerJoin()
      setMyPlayerId(playerId)
      setMyLobbyId(normalized)
      setMyDisplayName(trimmedName)
      setIsLobbyCreator(create)
      setSession(s)
      setLobbyClosed(false)
      setDisconnectedIds(new Set())
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
      setActionError(errorMessage(e, 'Could not start next round.'))
    }
  }

  async function handleSetTrump(suit: Suit) {
    if (!jwt) return handleUnauthorized('Your session has expired. Please rejoin.')
    try {
      setSession(await gameApi.setTrump(myLobbyId, suit, jwt))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return handleUnauthorized(e.message)
      throw e instanceof Error ? e : new Error(errorMessage(e, 'Could not set trump.'))
    }
  }

  async function handlePlayCard(card: Card) {
    if (!jwt) {
      handleUnauthorized('Your session has expired. Please rejoin.')
      throw new Error('Not authenticated')
    }
    const prevHand = myHand
    setMyHand(h => h.filter(c => !(c.suit === card.suit && c.rank === card.rank)))
    try {
      setSession(await gameApi.playCard(myLobbyId, card, jwt))
    } catch (e) {
      setMyHand(prevHand)
      if (e instanceof ApiError && e.code === 'unauthorized') {
        handleUnauthorized(e.message)
      }
      throw e instanceof Error ? e : new Error(errorMessage(e, 'Could not play card.'))
    }
  }

  /**
   * Reset to the lobby screen. By default also notifies the server so other
   * players see the seat free up. Pass skipServerLeave=true for involuntary
   * exits (expired token, lobby gone) where there's no point hitting the API.
   */
  function handleReturnToLobby(opts: { skipServerLeave?: boolean } = {}) {
    // Fire-and-forget the leave so other players see the seat free up immediately.
    // We don't await — UI shouldn't wait on the server for a clean return.
    if (!opts.skipServerLeave && jwt && myLobbyId) {
      void gameApi.leaveRoom(myLobbyId, jwt).catch(() => { /* best-effort */ })
    }
    clearSession()
    setJwt(null)
    setSession(null)
    setMyPlayerId('')
    setMyLobbyId('')
    setIsLobbyCreator(false)
    setLobbyClosed(false)
    setDisconnectedIds(new Set())
    setStartError(null)
    setActionError(null)
    setMyHand([])
    setIsRestoring(false)
    setView('lobby')
  }

  async function handleCopyCode() {
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

  // Restore-in-progress overlay covers the gap between "JWT restored" and
  // "first SignalR event arrived." Without it the user would see the lobby
  // form flash before the game pops back.
  if (isDocsPath(path)) {
    return <DocsPage onBack={() => navigate('/')} />
  }

  if (isRestoring && !session) {
    return <RestoringOverlay />
  }

  if (view === 'lobby' || !session) {
    return <LobbyScreen onJoin={handleJoin} error={lobbyError} onOpenDocs={() => navigate('/docs')} />
  }

  if (view === 'waiting') {
    return (
      <>
        <ConnectionBanner state={connectionState} onReconnect={reconnect} />
        <WaitingRoom
          session={session} myPlayerId={myPlayerId} isCreator={isLobbyCreator}
          onStart={handleStart} onCopyCode={handleCopyCode} copied={copied} startError={startError}
        />
      </>
    )
  }

  return (
    <>
      <ConnectionBanner state={connectionState} onReconnect={reconnect} />
      <GameTable
        session={session} myPlayerId={myPlayerId} isCreator={isLobbyCreator}
        myHand={myHand}
        onPlayCard={handlePlayCard} onSetTrump={handleSetTrump} onStartRound={handleStartRound}
        disconnectedIds={disconnectedIds} lobbyClosed={lobbyClosed} onReturnToLobby={() => handleReturnToLobby()}
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

function RestoringOverlay() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div
        className="w-14 h-14 rounded-full mb-5"
        style={{
          border: '3px solid rgba(212,160,23,0.25)',
          borderTopColor: '#d4a017',
          animation: 'omi-spin 1.1s linear infinite',
        }}
      />
      <p style={{ fontSize: 13, color: '#d4a017', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        Reconnecting to your game…
      </p>
      <style>{`@keyframes omi-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
