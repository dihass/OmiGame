import { useState } from 'react'
import type { Card, GameSession, Suit } from './types/game'
import { authToken } from './api/auth'
import * as gameApi from './api/game'
import { useSignalR } from './hooks/useSignalR'
import LobbyScreen from './components/lobby/LobbyScreen'
import WaitingRoom from './components/lobby/WaitingRoom'
import GameTable from './components/game/GameTable'
import { soundPlayerJoin, soundGameStart, soundAiyo } from './lib/sounds'

type View = 'lobby' | 'waiting' | 'game'

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
  const [copied, setCopied]             = useState(false)

  // ── SignalR lifecycle ──────────────────────────────────────────────────────
  useSignalR(jwt, {
    onLobbyUpdated:       (s) => { setSession(s); setView(v => v === 'game' ? 'game' : 'waiting') },
    onRoundStarted:       (s) => { if (s.roundHistory.length === 0) soundGameStart(); setSession(s); setView('game') },
    onTrumpSelected:      setSession,
    onCardPlayed:         setSession,
    onHandDealt:          (hand) => setMyHand(hand),
    onGameResumed:        (s) => { setSession(s); setDisconnectedId(null); setView('game') },
    onPlayerDisconnected: (id) => { setDisconnectedId(id); soundAiyo() },
    onPlayerReconnected:  () => setDisconnectedId(null),
    onLobbyClosed:        () => { setLobbyClosed(true); setDisconnectedId(null) },
    onLobbyNotFound:      () => { setLobbyError('Lobby no longer exists.'); setView('lobby') },
  })

  // ── Lobby join / create ────────────────────────────────────────────────────
  async function handleJoin(displayName: string, lobbyId: string, create: boolean) {
    setLobbyError(null)
    const playerId = crypto.randomUUID()
    try {
      const token = await authToken(playerId, displayName, lobbyId)
      if (create) await gameApi.createRoom(lobbyId, token)
      const s = await gameApi.joinRoom(lobbyId, token)

      soundPlayerJoin()
      setMyPlayerId(playerId)
      setMyLobbyId(lobbyId)
      setIsLobbyCreator(create)
      setSession(s)
      setLobbyClosed(false)
      setDisconnectedId(null)
      setStartError(null)
      setView('waiting')
      setJwt(token)
    } catch (e) {
      setLobbyError(e instanceof Error ? e.message : 'Could not join lobby.')
    }
  }

  // ── Game actions ───────────────────────────────────────────────────────────
  async function handleStart() {
    setStartError(null)
    try {
      const s = await gameApi.startGame(myLobbyId, jwt!)
      setSession(s)
      setView('game')
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not start game.')
    }
  }

  async function handleStartRound() {
    try { setSession(await gameApi.startGame(myLobbyId, jwt!)) } catch { /* SignalR re-syncs */ }
  }

  async function handleSetTrump(suit: Suit) {
    try { setSession(await gameApi.setTrump(myLobbyId, suit, jwt!)) } catch { /* SignalR re-syncs */ }
  }

  async function handlePlayCard(card: Card) {
    // Optimistic removal so the card disappears immediately on tap
    setMyHand(h => h.filter(c => !(c.suit === card.suit && c.rank === card.rank)))
    try { setSession(await gameApi.playCard(myLobbyId, card, jwt!)) } catch { /* SignalR re-syncs */ }
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
    setMyHand([])
    setView('lobby')
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(myLobbyId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === 'lobby' || !session) {
    return <LobbyScreen onJoin={handleJoin} error={lobbyError} />
  }

  if (view === 'waiting') {
    return (
      <WaitingRoom
        session={session} myPlayerId={myPlayerId} isCreator={isLobbyCreator}
        onStart={handleStart} onCopyCode={handleCopyCode} copied={copied} startError={startError}
      />
    )
  }

  return (
    <GameTable
      session={session} myPlayerId={myPlayerId} isCreator={isLobbyCreator}
      myHand={myHand}
      onPlayCard={handlePlayCard} onSetTrump={handleSetTrump} onStartRound={handleStartRound}
      disconnectedId={disconnectedId} lobbyClosed={lobbyClosed} onReturnToLobby={handleReturnToLobby}
    />
  )
}
