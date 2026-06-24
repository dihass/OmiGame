import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Card, GameSession, Suit } from '../../types/game'
import { SUIT_SYMBOL, cardKey, isRedSuit } from '../../utils/cardHelpers'
import { isLegalPlay, trickWinnerSeat } from '../../utils/gameRules'
import type { TrickEntry } from '../../types/game'
import CardView from './CardView'
import Confetti from './Confetti'
import PlayerSeat from './PlayerSeat'
import ScoreHeader from './ScoreHeader'
import { teamOf } from './teamConfig'
import {
  soundCardSnap, soundYourTurn, soundDealCard, soundButtonClick,
  soundOiia, soundFaaahClip, soundAnimeWow,
  soundYippee, soundBabyLaugh, soundEmotionalDamage, soundOhHellNah,
  soundCatLaugh, soundAiyo, soundTrumpRevealMeme,
  soundMatchCredits, soundMatchWinMeme, soundSadMeow,
} from '../../lib/sounds'

interface Props {
  session:         GameSession
  myPlayerId:      string
  isCreator:       boolean
  myHand:          Card[]
  onPlayCard:      (card: Card) => Promise<void>
  onSetTrump:      (suit: Suit) => Promise<void>
  onStartRound:    () => Promise<void>
  disconnectedId:  string | null
  lobbyClosed:     boolean
  onReturnToLobby: () => void
}

const SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades']

export default function GameTable({
  session, myPlayerId, isCreator,
  myHand,
  onPlayCard, onSetTrump, onStartRound,
  disconnectedId, lobbyClosed, onReturnToLobby,
}: Props) {
  const [actionError, setActionError]             = useState<string | null>(null)
  const [trickFlash, setTrickFlash]               = useState<'none' | 'gold' | 'red'>('none')
  const [screenEffect, setScreenEffect]           = useState<'none' | 'red' | 'shake' | 'gold'>('none')
  const [confetti, setConfetti]                   = useState<'off' | 'light' | 'full'>('off')
  const [showCatEmoji, setShowCatEmoji]           = useState(false)
  const [trumpRevealActive, setTrumpRevealActive] = useState(false)
  const [dealtHandKey, setDealtHandKey]           = useState(0)
  const [illegalShake, setIllegalShake]           = useState(false)
  const [slowWarning, setSlowWarning]             = useState<{ seat: number; secs: number } | null>(null)
  const [frozenTrick, setFrozenTrick] = useState<TrickEntry[] | null>(null)
  const [trickResult, setTrickResult] = useState<{
    winnerName:  string
    winnerSeat:  number
    isMe:        boolean
    isMyTeam:    boolean
    teamATricks: number
    teamBTricks: number
  } | null>(null)
  const [roundLeader, setRoundLeader] = useState<{ name: string; isMe: boolean; roundNum: number } | null>(null)
  const trickTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastTrick, setLastTrick]     = useState<{ entries: TrickEntry[]; winnerSeat: number } | null>(null)
  const [showLastTrick, setShowLastTrick] = useState(false)

  const prevRef     = useRef<GameSession | null>(null)
  const prevHandLen = useRef(0)

  const me       = session.players.find(p => p.playerId === myPlayerId)
  const mySeat   = me?.seatIndex ?? 0
  const myTeam   = teamOf(mySeat)
  const isMyTurn = session.currentTurnIndex === mySeat && session.phase === 'Playing'
  const amTrumpSelector = session.phase === 'TrumpSelection' && mySeat === (session.currentDealerIndex + 1) % 4

  const bottomSeat = mySeat
  const rightSeat  = (mySeat + 1) % 4
  const topSeat    = (mySeat + 2) % 4
  const leftSeat   = (mySeat + 3) % 4

  function playerAt(seat: number) { return session.players.find(p => p.seatIndex === seat) }
  const displayTrick = frozenTrick ?? session.currentTrick
  function cardInTrick(seat: number) { return displayTrick.find(t => t.seatIndex === seat)?.card }

  // ── Event detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = session
    if (!prev) return

    if (myHand.length > prevHandLen.current && myHand.length > 0) {
      setDealtHandKey(k => k + 1)
      const newCards = myHand.length - prevHandLen.current
      for (let i = 0; i < newCards; i++) setTimeout(() => soundDealCard(), i * 55)
    }
    prevHandLen.current = myHand.length

    if (prev.currentTrick.length === 4 && session.currentTrick.length === 0) {
      const aWon      = session.teamATricksWon > prev.teamATricksWon
      const myTeamWon = (aWon && myTeam === 'A') || (!aWon && myTeam === 'B')
      const myTricks  = myTeam === 'A' ? session.teamATricksWon : session.teamBTricksWon
      const oppTricks = myTeam === 'A' ? session.teamBTricksWon : session.teamATricksWon

      if (myTeamWon) {
        setTrickFlash('gold')
        setTimeout(() => setTrickFlash('none'), 700)
        if (myTricks % 2 === 0) setTimeout(() => soundOiia(), 100)
      } else {
        setTrickFlash('red')
        setTimeout(() => setTrickFlash('none'), 700)
        if (oppTricks % 2 === 0) setTimeout(() => soundFaaahClip(), 150)
      }

      // Winner always leads next in Omi — session.currentTurnIndex is the winner
      const winnerSeat   = session.currentTurnIndex
      const winnerPlayer = session.players.find(p => p.seatIndex === winnerSeat)

      // Freeze the 4 cards so they stay visible during the result overlay
      setFrozenTrick(prev.currentTrick)
      // Save for "last trick" review
      setLastTrick({ entries: prev.currentTrick, winnerSeat })
      // Show cinematic result overlay
      setTrickResult({
        winnerName:  winnerPlayer?.displayName ?? '?',
        winnerSeat,
        isMe:        winnerSeat === mySeat,
        isMyTeam:    myTeamWon,
        teamATricks: session.teamATricksWon,
        teamBTricks: session.teamBTricksWon,
      })
      if (trickTimer.current) clearTimeout(trickTimer.current)
      trickTimer.current = setTimeout(() => {
        setFrozenTrick(null)
        setTrickResult(null)
      }, 2200)
    }

    if (session.roundHistory.length > prev.roundHistory.length) {
      const last = session.roundHistory[session.roundHistory.length - 1]
      const myTeamWon        = (last.teamAPointsEarned > 0 && myTeam === 'A') || (last.teamBPointsEarned > 0 && myTeam === 'B')
      const myTricksThisRound  = myTeam === 'A' ? last.teamATricks : last.teamBTricks
      const oppTricksThisRound = myTeam === 'A' ? last.teamBTricks : last.teamATricks
      const isDraw = last.carryAdded > 0

      if (isDraw) {
        soundCatLaugh()
        setShowCatEmoji(true)
        setTimeout(() => setShowCatEmoji(false), 2500)
      } else if (myTeamWon) {
        if (myTricksThisRound === 8) {
          soundAnimeWow()
          setScreenEffect('gold')
          setTimeout(() => setScreenEffect('none'), 1000)
          setConfetti('full')
          setTimeout(() => soundBabyLaugh(), 700)
        } else {
          soundYippee()
          setConfetti('full')
          if (myTricksThisRound >= 7) setTimeout(() => soundBabyLaugh(), 700)
        }
      } else {
        if (oppTricksThisRound === 8) {
          soundOhHellNah()
          setScreenEffect('shake')
          setTimeout(() => setScreenEffect('none'), 800)
        } else {
          soundEmotionalDamage()
          setScreenEffect('red')
          setTimeout(() => setScreenEffect('none'), 900)
        }
      }
    }

    if (session.phase === 'MatchCompleted' && prev.phase !== 'MatchCompleted') {
      const aWon = session.teamAMatchPoints >= 10
      const iWon = (aWon && myTeam === 'A') || (!aWon && myTeam === 'B')
      soundMatchCredits()
      if (iWon) { setConfetti('full'); setTimeout(() => soundMatchWinMeme(), 800) }
      else       { setTimeout(() => soundSadMeow(), 600) }
    }

    if (
      session.phase === 'Playing' &&
      session.currentTurnIndex === mySeat &&
      (prev.currentTurnIndex !== mySeat || prev.phase !== 'Playing')
    ) {
      soundYourTurn()
    }

    if (session.trumpSuit && !prev.trumpSuit) {
      soundTrumpRevealMeme()
      setTrumpRevealActive(true)
      setTimeout(() => setTrumpRevealActive(false), 2200)
    }

    if (prev.phase !== 'Playing' && session.phase === 'Playing') {
      const leader = session.players.find(p => p.seatIndex === session.currentTurnIndex)
      // If trump was just revealed, wait for that animation to clear first
      const delay = !prev.trumpSuit && !!session.trumpSuit ? 2500 : 300
      setTimeout(() => {
        setRoundLeader({
          name:     leader?.displayName ?? '?',
          isMe:     session.currentTurnIndex === mySeat,
          roundNum: session.roundHistory.length + 1,
        })
        setTimeout(() => setRoundLeader(null), 2500)
      }, delay)
    }
  }, [session, me, mySeat, myTeam])

  // ── 15-second slow-player aiyo timer ────────────────────────────────────────
  useEffect(() => {
    if (session.phase !== 'Playing') { setSlowWarning(null); return }

    const seat = session.currentTurnIndex
    setSlowWarning(null)
    let elapsed = 0

    const id = setInterval(() => {
      elapsed++
      if (elapsed >= 10 && elapsed < 15) setSlowWarning({ seat, secs: 15 - elapsed })
      if (elapsed >= 15) { clearInterval(id); setSlowWarning(null) }
    }, 1000)

    return () => { clearInterval(id); setSlowWarning(null) }
  }, [session.currentTurnIndex, session.phase])

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handlePlayCard(card: Card) {
    soundCardSnap()
    setActionError(null)
    setIllegalShake(false)
    try {
      await onPlayCard(card)
    } catch (e) {
      soundAiyo()
      setIllegalShake(true)
      setTimeout(() => setIllegalShake(false), 500)
      setActionError(e instanceof Error ? e.message : 'Play rejected.')
    }
  }

  async function handleSetTrump(suit: Suit) {
    soundButtonClick()
    setActionError(null)
    try { await onSetTrump(suit) }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Could not set trump.') }
  }

  async function handleStartRound() {
    soundButtonClick()
    try { await onStartRound() } catch { /* SignalR will re-sync */ }
  }

  const phase = session.phase

  // Led suit — shown on the felt when the first card of a trick has been played
  const ledSuit = displayTrick.length > 0 ? displayTrick[0].card.suit : null

  // Play order for each seat (1 = led, 2 = second, …)
  const playOrder = displayTrick.reduce<Record<number, number>>((acc, entry, i) => {
    acc[entry.seatIndex] = i + 1
    return acc
  }, {})

  // Winning card seat — computed when all 4 cards are on the table
  const currentWinnerSeat = displayTrick.length === 4
    ? trickWinnerSeat(displayTrick, session.trumpSuit)
    : null

  return (
    <motion.div
      className="min-h-dvh flex flex-col bg-transparent relative overflow-x-hidden"
      animate={screenEffect === 'shake' ? { x: [-12, 12, -10, 10, -6, 6, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Screen flash overlay */}
      <AnimatePresence>
        {screenEffect === 'red' && (
          <motion.div key="red-flash"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.55, 0.4, 0] }}
            transition={{ duration: 0.85, times: [0, 0.15, 0.5, 1] }}
            className="fixed inset-0 bg-red-600/40 z-10 pointer-events-none" />
        )}
        {screenEffect === 'shake' && (
          <motion.div key="intense-flash"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0.5, 0] }}
            transition={{ duration: 0.8, times: [0, 0.1, 0.5, 1] }}
            className="fixed inset-0 bg-red-700/60 z-10 pointer-events-none" />
        )}
        {screenEffect === 'gold' && (
          <motion.div key="gold-flash"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0.3, 0] }}
            transition={{ duration: 1.0, times: [0, 0.15, 0.5, 1] }}
            className="fixed inset-0 bg-yellow-400/30 z-10 pointer-events-none" />
        )}
      </AnimatePresence>

      {/* Cat emoji pop for draw */}
      <AnimatePresence>
        {showCatEmoji && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: [0, 1.4, 1], opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div className="text-8xl drop-shadow-2xl">😹</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trump reveal modal */}
      <AnimatePresence>
        {trumpRevealActive && session.trumpSuit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.1, rotate: -360, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="rounded-3xl px-8 py-10 text-center shadow-2xl w-full max-w-xs mx-4"
              style={{ background: '#00120a', border: '4px solid #f59e0b', boxShadow: '0 0 60px rgba(245,158,11,0.25)' }}
            >
              <p className="text-yellow-400 font-black text-sm uppercase tracking-[0.3em] mb-3">Trump Suit</p>
              <motion.span
                animate={{ scale: [1, 1.15, 1], filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'] }}
                transition={{ duration: 0.6, delay: 0.3, repeat: 2 }}
                className={`text-9xl block leading-none ${isRedSuit(session.trumpSuit) ? 'text-red-400' : 'text-white'}`}
              >
                {SUIT_SYMBOL[session.trumpSuit]}
              </motion.span>
              <p className={`mt-3 font-bold text-lg ${isRedSuit(session.trumpSuit) ? 'text-red-400' : 'text-stone-100'}`}>
                {session.trumpSuit}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {confetti !== 'off' && <Confetti intensity={confetti} onDone={() => setConfetti('off')} />}

      {/* Round leader banner — brief toast when a new round begins */}
      <AnimatePresence>
        {roundLeader && (
          <motion.div
            className="fixed inset-x-0 bottom-0 flex items-end justify-center z-50 pointer-events-none"
            style={{ paddingBottom: 'max(28%, 120px)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.88 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={  { opacity: 0, y: -18, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="rounded-2xl px-7 py-3.5 text-center shadow-2xl"
              style={{
                background: 'rgba(0,14,7,0.97)',
                border: `1.5px solid ${roundLeader.isMe ? 'rgba(13,207,177,0.50)' : 'rgba(0,90,38,0.45)'}`,
                boxShadow: roundLeader.isMe
                  ? '0 0 36px rgba(13,207,177,0.16), 0 6px 28px rgba(0,0,0,0.65)'
                  : '0 6px 28px rgba(0,0,0,0.65)',
              }}
            >
              <p style={{ fontSize: 9.5, fontWeight: 700, color: '#2e5a40', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 3 }}>
                Round {roundLeader.roundNum}
              </p>
              <p className="font-black" style={{ fontSize: 15, color: roundLeader.isMe ? '#0dcfb1' : '#d0e8da' }}>
                {roundLeader.isMe ? '★ You lead first!' : `${roundLeader.name} leads first`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score header */}
      <ScoreHeader session={session} phase={phase} />

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-between px-2 py-3 gap-2 max-w-2xl mx-auto w-full">

        {/* Top */}
        <div className="flex justify-center">
          <PlayerSeat player={playerAt(topSeat)} mySeat={mySeat} isMe={topSeat === mySeat}
            isCurrentTurn={session.currentTurnIndex === topSeat} isDealer={session.currentDealerIndex === topSeat}
            cardCount={playerAt(topSeat)?.handCount ?? 0} label="Top"
            disconnected={playerAt(topSeat)?.playerId === disconnectedId}
            countdown={slowWarning?.seat === topSeat ? slowWarning.secs : null} />
        </div>

        {/* Middle row */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex justify-center flex-shrink-0" style={{ width: 'clamp(52px, 15vw, 76px)' }}>
            <PlayerSeat player={playerAt(leftSeat)} mySeat={mySeat} isMe={leftSeat === mySeat}
              isCurrentTurn={session.currentTurnIndex === leftSeat} isDealer={session.currentDealerIndex === leftSeat}
              cardCount={playerAt(leftSeat)?.handCount ?? 0} label="Left"
              disconnected={playerAt(leftSeat)?.playerId === disconnectedId}
              countdown={slowWarning?.seat === leftSeat ? slowWarning.secs : null} />
          </div>

          {/* Felt table */}
          <div className="flex-1 relative min-w-0">
            <div className="felt-table rounded-3xl flex items-center justify-center relative overflow-hidden" style={{ minHeight: 'clamp(190px, 42vw, 340px)' }}>
              {/* Trick flash overlay */}
              <AnimatePresence>
                {trickFlash !== 'none' && (
                  <motion.div
                    key={`flash-${trickFlash}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: trickFlash === 'gold' ? 0.6 : 0.45 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className={`absolute inset-0 rounded-3xl pointer-events-none ${trickFlash === 'gold' ? 'bg-yellow-300/40' : 'bg-red-500/30'}`}
                  />
                )}
              </AnimatePresence>

              {/* Persistent trump badge — bottom-left of felt */}
              <AnimatePresence>
                {session.trumpSuit && phase === 'Playing' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg pointer-events-none"
                    style={{ background: 'rgba(0,8,4,0.75)', border: '1px solid rgba(245,158,11,0.35)' }}
                  >
                    <span className="text-amber-600 text-[9px] font-bold uppercase tracking-wider">trump</span>
                    <span className={`text-base leading-none font-black ${isRedSuit(session.trumpSuit) ? 'text-red-500' : 'text-gray-200'}`}>
                      {SUIT_SYMBOL[session.trumpSuit]}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Led suit badge — top-center of felt when a trick is in progress */}
              <AnimatePresence>
                {ledSuit && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-lg pointer-events-none"
                    style={{ background: 'rgba(0,8,4,0.80)', border: '1px solid rgba(0,100,45,0.40)' }}
                  >
                    <span className="text-green-700 text-[9px] font-semibold uppercase tracking-wider">led</span>
                    <span className={`text-base leading-none font-black ${isRedSuit(ledSuit) ? 'text-red-400' : 'text-gray-200'}`}>
                      {SUIT_SYMBOL[ledSuit]}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Trick card grid */}
              <div className="grid gap-2" style={{
                gridTemplateAreas:   `". top ." "left . right" ". bottom ."`,
                gridTemplateColumns: '1fr auto 1fr',
                gridTemplateRows:    '1fr auto 1fr',
              }}>
                {(['top', 'left', 'right', 'bottom'] as const).map((area, idx) => {
                  const seatForArea = [topSeat, leftSeat, rightSeat, bottomSeat][idx]
                  const tCard       = cardInTrick(seatForArea)
                  const order       = playOrder[seatForArea]
                  const isWinner    = currentWinnerSeat === seatForArea
                  return (
                    <div key={area} style={{ gridArea: area }}
                      className={`flex ${area === 'right' ? 'justify-start' : area === 'left' ? 'justify-end' : 'justify-center'}`}>
                      <AnimatePresence mode="wait">
                        {tCard ? (
                          <motion.div
                            key={cardKey(tCard)}
                            className="relative"
                            initial={{ scale: 0.4, opacity: 0, y: area === 'top' ? -16 : area === 'bottom' ? 16 : 0, x: area === 'left' ? -16 : area === 'right' ? 16 : 0 }}
                            animate={{ scale: 1, opacity: 1, y: 0, x: 0 }}
                            exit={{ scale: 0.2, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 550, damping: 32 }}
                          >
                            {/* Winning card glow ring */}
                            <AnimatePresence>
                              {isWinner && (
                                <motion.div
                                  className="absolute -inset-1 rounded-xl pointer-events-none z-10"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: [0, 1, 0.7, 1] }}
                                  exit={{ opacity: 0 }}
                                  style={{ boxShadow: '0 0 0 2px #f59e0b, 0 0 18px 4px rgba(245,158,11,0.45)' }}
                                />
                              )}
                            </AnimatePresence>

                            {/* Play order badge */}
                            {order && (
                              <div
                                className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border"
                                style={{ background: '#00120a', borderColor: 'rgba(0,100,45,0.6)', color: '#4a8a62' }}
                              >
                                {order}
                              </div>
                            )}

                            <CardView card={tCard} size="sm" />
                          </motion.div>
                        ) : (
                          <div className="w-10 h-14 rounded-lg border border-dashed border-green-900/30" />
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Last trick button */}
            {lastTrick && phase === 'Playing' && !trickResult && (
              <motion.button
                onClick={() => setShowLastTrick(true)}
                whileHover={{ color: '#0dcfb1', borderColor: 'rgba(13,207,177,0.45)' }}
                whileTap={{ scale: 0.94 }}
                className="absolute bottom-2 right-2 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg"
                style={{
                  color: '#3d7055',
                  background: 'rgba(0,10,5,0.80)',
                  border: '1px solid rgba(0,70,30,0.40)',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  minHeight: 32,
                }}
              >
                Last trick ↗
              </motion.button>
            )}

            {/* ── Trick result overlay ─────────────────────────────────────── */}
            <AnimatePresence>
              {trickResult && (() => {
                const winnerTeam   = trickResult.winnerSeat % 2 === 0 ? 'A' : 'B'
                const teamColor    = winnerTeam === 'A' ? '#ef4444' : '#9ca3af'
                const teamGlow     = winnerTeam === 'A' ? 'rgba(239,68,68,0.22)' : 'rgba(107,114,128,0.18)'
                const teamBorder   = winnerTeam === 'A' ? 'rgba(239,68,68,0.55)' : 'rgba(107,114,128,0.45)'
                const teamBg       = winnerTeam === 'A' ? '#7f1d1d' : '#1f2937'
                return (
                  <motion.div
                    className="absolute inset-0 rounded-3xl flex items-center justify-center z-20 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ background: 'rgba(0,7,3,0.82)' }}
                  >
                    <motion.div
                      initial={{ scale: 0.55, y: 24, opacity: 0 }}
                      animate={{ scale: 1,    y: 0,  opacity: 1 }}
                      exit={  { scale: 0.80,  y: -20, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.22 }}
                      className="rounded-2xl px-6 py-5 text-center"
                      style={{
                        background: 'rgba(0,12,6,0.98)',
                        border: `1.5px solid ${teamBorder}`,
                        boxShadow: `0 0 48px ${teamGlow}, 0 8px 32px rgba(0,0,0,0.72)`,
                        minWidth: 200,
                      }}
                    >
                      {/* Team banner — the most prominent thing, seen by everyone */}
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="rounded-lg px-4 py-1.5 mb-3 mx-auto inline-block"
                        style={{ background: winnerTeam === 'A' ? 'rgba(127,29,29,0.55)' : 'rgba(55,65,81,0.55)', border: `1px solid ${teamBorder}` }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 900, color: teamColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          Team {winnerTeam} takes it
                        </span>
                      </motion.div>

                      {/* Winner avatar + name */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 600, damping: 26, delay: 0.35 }}
                        className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center font-black"
                        style={{
                          fontSize: 20,
                          background: teamBg,
                          border: `2.5px solid ${teamColor}`,
                          color: '#f0f0f0',
                          boxShadow: `0 0 18px ${teamGlow}`,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {trickResult.winnerName.slice(0, 2).toUpperCase()}
                      </motion.div>

                      <p className="font-black leading-none mb-1"
                        style={{ fontSize: 16, color: teamColor }}>
                        {trickResult.isMe ? 'You win this trick!' : `${trickResult.winnerName} wins!`}
                      </p>
                      <p style={{ fontSize: 9.5, color: '#3d7055', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14 }}>
                        {trickResult.isMyTeam ? '✦ your team ✦' : 'opponent team'}
                      </p>

                      {/* Trick tally — labelled A vs B so everyone can read it */}
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="text-center">
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.1em', marginBottom: 3 }}>TEAM A</div>
                          <div className="flex gap-[4px]">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <motion.div
                                key={i}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 600, delay: 0.40 + i * 0.035 }}
                                style={{
                                  width: 10, height: 10, borderRadius: 2,
                                  background: i < trickResult.teamATricks ? '#ef4444' : 'rgba(0,50,20,0.45)',
                                  boxShadow: i < trickResult.teamATricks ? '0 0 6px rgba(239,68,68,0.50)' : 'none',
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171', marginTop: 4 }}>{trickResult.teamATricks}</div>
                        </div>

                        <div style={{ fontSize: 12, color: '#2e5a40', fontWeight: 700, alignSelf: 'center' }}>vs</div>

                        <div className="text-center">
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151', letterSpacing: '0.1em', marginBottom: 3 }}>TEAM B</div>
                          <div className="flex gap-[4px]">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <motion.div
                                key={i}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 600, delay: 0.40 + i * 0.035 }}
                                style={{
                                  width: 10, height: 10, borderRadius: 2,
                                  background: i < trickResult.teamBTricks ? '#6b7280' : 'rgba(0,50,20,0.45)',
                                  boxShadow: i < trickResult.teamBTricks ? '0 0 6px rgba(107,114,128,0.45)' : 'none',
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#9ca3af', marginTop: 4 }}>{trickResult.teamBTricks}</div>
                        </div>
                      </div>

                      {/* Next player pill */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className="rounded-xl px-3 py-2 flex items-center justify-center gap-1.5"
                        style={{
                          background: trickResult.isMe ? 'rgba(13,207,177,0.12)' : 'rgba(0,28,12,0.55)',
                          border: `1px solid ${trickResult.isMe ? 'rgba(13,207,177,0.40)' : 'rgba(0,70,30,0.40)'}`,
                        }}
                      >
                        <motion.span
                          animate={trickResult.isMe ? { x: [0, 3, 0] } : {}}
                          transition={{ duration: 0.6, delay: 0.7, repeat: 2 }}
                          style={{ fontSize: 11 }}
                        >
                          ▶
                        </motion.span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: trickResult.isMe ? '#0dcfb1' : '#b0c8bb' }}>
                          {trickResult.isMe ? 'Your turn next!' : `${trickResult.winnerName} leads next`}
                        </span>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </div>

          <div className="flex justify-center flex-shrink-0" style={{ width: 'clamp(52px, 15vw, 76px)' }}>
            <PlayerSeat player={playerAt(rightSeat)} mySeat={mySeat} isMe={rightSeat === mySeat}
              isCurrentTurn={session.currentTurnIndex === rightSeat} isDealer={session.currentDealerIndex === rightSeat}
              cardCount={playerAt(rightSeat)?.handCount ?? 0} label="Right"
              disconnected={playerAt(rightSeat)?.playerId === disconnectedId}
              countdown={slowWarning?.seat === rightSeat ? slowWarning.secs : null} />
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <PlayerSeat player={me} mySeat={mySeat} isMe isCurrentTurn={isMyTurn}
            isDealer={session.currentDealerIndex === mySeat} cardCount={0} label="You" disconnected={false}
            countdown={slowWarning?.seat === mySeat ? slowWarning.secs : null} />

          {/* Trump selector */}
          <AnimatePresence>
            {phase === 'TrumpSelection' && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.93 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="glass-panel rounded-2xl p-4 text-center w-full max-w-sm shadow-2xl"
              >
                {amTrumpSelector ? (
                  <>
                    <p className="font-semibold mb-3 text-sm tracking-wide" style={{ color: '#d0e8da' }}>Choose Trump Suit</p>
                    <div className="grid grid-cols-4 gap-2">
                      {SUITS.map(suit => (
                        <motion.button key={suit} onClick={() => handleSetTrump(suit)}
                          whileHover={{ scale: 1.12, y: -5 }} whileTap={{ scale: 0.92 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="rounded-xl py-3 text-3xl font-bold transition-colors border-2"
                          style={{
                            color:        isRedSuit(suit) ? '#f87171' : '#e5e7eb',
                            borderColor:  isRedSuit(suit) ? 'rgba(185,28,28,0.50)' : 'rgba(75,85,99,0.50)',
                            background:   'rgba(0,10,4,0.60)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = isRedSuit(suit) ? 'rgba(127,29,29,0.30)' : 'rgba(55,65,81,0.30)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,10,4,0.60)' }}
                        >
                          {SUIT_SYMBOL[suit]}
                        </motion.button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 rounded-full"
                      style={{ borderColor: '#183d26', borderTopColor: '#0dcfb1' }} />
                    <p style={{ color: '#3d7055', fontSize: 13 }}>
                      Waiting for{' '}
                      <span className="font-semibold" style={{ color: '#d0e8da' }}>
                        {playerAt((session.currentDealerIndex + 1) % 4)?.displayName ?? '…'}
                      </span>{' '}to choose trump…
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Round summary */}
          <AnimatePresence>
            {(phase === 'RoundSummary' || phase === 'DealingPhase1') && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.93 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="glass-panel rounded-2xl p-5 text-center w-full max-w-sm shadow-2xl"
              >
                <p className="font-bold text-base mb-4" style={{ color: '#d0e8da', letterSpacing: '0.04em' }}>Round Complete</p>
                <div className="flex justify-center gap-10 mb-4">
                  {[{ label: 'Team A', val: session.teamATricksWon, color: '#f87171' },
                    { label: 'Team B', val: session.teamBTricksWon, color: '#9ca3af' }].map(t => (
                    <div key={t.label} className="text-center">
                      <div className="font-black text-4xl leading-none" style={{ color: t.color }}>{t.val}</div>
                      <div className="text-xs mt-1 font-medium" style={{ color: '#2e5a40' }}>{t.label}</div>
                    </div>
                  ))}
                </div>
                {session.roundHistory.length > 0 && (() => {
                  const last  = session.roundHistory[session.roundHistory.length - 1]
                  const myWon = (last.teamAPointsEarned > 0 && myTeam === 'A') || (last.teamBPointsEarned > 0 && myTeam === 'B')
                  return (
                    <p className="text-xs mb-4 font-semibold rounded-xl px-3 py-2" style={{
                      color: last.carryAdded > 0 ? '#fcd34d' : myWon ? '#f87171' : '#9ca3af',
                      background: last.carryAdded > 0 ? 'rgba(100,60,0,0.25)' : myWon ? 'rgba(127,29,29,0.20)' : 'rgba(55,65,81,0.20)',
                    }}>
                      {last.carryAdded > 0
                        ? `Draw — +${last.carryAdded} carry point`
                        : last.teamAPointsEarned > 0
                          ? `Team A earned ${last.teamAPointsEarned} pt${last.teamAPointsEarned > 1 ? 's' : ''}`
                          : `Team B earned ${last.teamBPointsEarned} pt${last.teamBPointsEarned > 1 ? 's' : ''}`}
                    </p>
                  )
                })()}
                {isCreator ? (
                  <motion.button onClick={handleStartRound} whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                    className="btn-primary">
                    Start Next Round
                  </motion.button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="w-3.5 h-3.5 border-2 rounded-full"
                      style={{ borderColor: '#183d26', borderTopColor: '#f59e0b' }} />
                    <span style={{ color: '#2e5a40', fontSize: 12 }}>Waiting for host to continue…</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* My hand — horizontal scroll on mobile, no wrap */}
          {me && myHand.length > 0 && (phase === 'Playing' || phase === 'TrumpSelection' || phase === 'DealingPhase2') && (
            <motion.div
              key={dealtHandKey}
              animate={illegalShake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="hand-scroll w-full rounded-2xl border transition-all duration-300"
              style={{
                borderColor: illegalShake
                  ? 'rgba(239,68,68,0.55)'
                  : isMyTurn
                    ? 'rgba(13,207,177,0.45)'
                    : 'rgba(0,80,30,0.25)',
                background: illegalShake
                  ? 'rgba(80,0,0,0.12)'
                  : isMyTurn
                    ? 'rgba(13,207,177,0.05)'
                    : 'rgba(0,20,10,0.20)',
                boxShadow: isMyTurn
                  ? '0 0 28px rgba(13,207,177,0.10)'
                  : 'none',
              }}
            >
              {/* Inner flex — nowrap so cards never wrap to a second row */}
              <div className="flex flex-nowrap items-end justify-center gap-1.5 px-2.5 py-2.5"
                style={{ minWidth: 'max-content', margin: '0 auto' }}>
                {myHand.map((card, i) => {
                  const legal = isLegalPlay(card, myHand, session.currentTrick)
                  return (
                    <motion.div key={cardKey(card)}
                      initial={{ opacity: 0, y: 24, rotateZ: i % 2 === 0 ? -4 : 4 }}
                      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.035 }}>
                      <CardView card={card}
                        onClick={isMyTurn && legal ? () => handlePlayCard(card) : undefined}
                        disabled={!isMyTurn} illegal={isMyTurn && !legal} highlight={isMyTurn && legal} size="md" />
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Your turn indicator */}
          <AnimatePresence>
            {isMyTurn && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                style={{ background: 'rgba(13,207,177,0.08)', border: '1px solid rgba(13,207,177,0.25)' }}
              >
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ color: '#0dcfb1', fontSize: 12 }}
                >
                  ♦
                </motion.span>
                <span className="text-sm font-bold" style={{ color: '#0dcfb1', letterSpacing: '0.02em' }}>
                  Your turn — play a card
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action error */}
          <AnimatePresence>
            {actionError && (
              <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="text-red-400 text-sm bg-red-950/60 border border-red-800 rounded-xl px-4 py-2 text-center max-w-sm">
                {actionError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Match complete modal */}
      <AnimatePresence>
        {phase === 'MatchCompleted' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-20">
            <motion.div
              initial={{ scale: 0.7, y: 40 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.1 }}
              className="rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full mx-4"
              style={{ background: '#00160c', border: '1px solid rgba(0,100,45,0.40)' }}
            >
              <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ delay: 0.4, duration: 0.6 }} className="text-5xl mb-3">
                {(session.teamAMatchPoints >= 10 && myTeam === 'A') || (session.teamBMatchPoints >= 10 && myTeam === 'B') ? '🏆' : '😿'}
              </motion.div>
              <h2 className="text-2xl font-black text-green-100 mb-1">Match Complete!</h2>
              <p className={`font-bold text-xl mb-5 ${session.teamAMatchPoints >= 10 ? 'text-red-400' : 'text-gray-300'}`}>
                {session.teamAMatchPoints >= 10 ? 'Team A Wins!' : 'Team B Wins!'}
              </p>

              <div className="rounded-2xl p-4 mb-5 text-left" style={{ background: 'rgba(0,10,5,0.80)' }}>
                <p className="text-green-900 text-[10px] uppercase tracking-widest mb-2">Round History</p>
                <div className="space-y-1.5">
                  {session.roundHistory.map(r => (
                    <div key={r.roundNumber} className="flex items-center gap-2 text-xs">
                      <span className="text-stone-500 w-5 shrink-0">R{r.roundNumber}</span>
                      <span className="text-stone-200">A:{r.teamATricks} B:{r.teamBTricks}</span>
                      {r.trumpSuit && <span className={isRedSuit(r.trumpSuit) ? 'text-red-400' : 'text-stone-300'}>{SUIT_SYMBOL[r.trumpSuit]}</span>}
                      <span className="ml-auto font-bold">
                        {r.carryAdded > 0 ? <span className="text-amber-400">draw</span>
                          : r.teamAPointsEarned > 0 ? <span className="text-red-400">A +{r.teamAPointsEarned}</span>
                            : <span className="text-gray-300">B +{r.teamBPointsEarned}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 flex justify-between text-sm font-black"
                  style={{ borderTop: '1px solid rgba(0,80,35,0.30)' }}>
                  <span className="text-red-400">A: {session.teamAMatchPoints} pts</span>
                  <span className="text-gray-300">B: {session.teamBMatchPoints} pts</span>
                </div>
              </div>

              <motion.button onClick={onReturnToLobby} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl px-8 py-3 font-bold transition-colors shadow-lg shadow-amber-900/30">
                Play Again
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last trick overlay */}
      <AnimatePresence>
        {showLastTrick && lastTrick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-30"
            onClick={() => setShowLastTrick(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 12 }}
              transition={{ type: 'spring', stiffness: 480, damping: 30 }}
              className="rounded-2xl p-5 shadow-2xl"
              style={{ background: '#00120a', border: '1px solid rgba(0,100,45,0.45)', minWidth: 260 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-green-300 font-bold text-sm">Last Trick</p>
                <p className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>
                  {lastTrick.winnerSeat === mySeat
                    ? 'You won it'
                    : `${playerAt(lastTrick.winnerSeat)?.displayName ?? '?'} won it`}
                </p>
              </div>

              {/* 4 cards in a 2×2 grid labelled by player name */}
              <div className="grid grid-cols-2 gap-3">
                {lastTrick.entries.map(entry => {
                  const p       = playerAt(entry.seatIndex)
                  const isWin   = entry.seatIndex === lastTrick.winnerSeat
                  const order   = lastTrick.entries.indexOf(entry) + 1
                  return (
                    <div key={entry.seatIndex} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        {isWin && (
                          <div className="absolute -inset-1 rounded-xl pointer-events-none"
                            style={{ boxShadow: '0 0 0 2px #f59e0b, 0 0 14px 3px rgba(245,158,11,0.35)' }} />
                        )}
                        <div className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border"
                          style={{ background: '#00120a', borderColor: 'rgba(0,100,45,0.6)', color: '#4a8a62' }}>
                          {order}
                        </div>
                        <CardView card={entry.card} size="md" />
                      </div>
                      <span className="text-[10px] font-medium truncate max-w-[56px] text-center"
                        style={{ color: isWin ? '#f59e0b' : '#3d7055' }}>
                        {p?.playerId === myPlayerId ? 'You' : p?.displayName ?? '?'}
                      </span>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setShowLastTrick(false)}
                className="mt-4 w-full text-xs py-1.5 rounded-lg font-semibold transition-colors"
                style={{ background: 'rgba(0,60,25,0.50)', color: '#3d7055', border: '1px solid rgba(0,80,35,0.40)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0dcfb1' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#3d7055' }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disconnect overlay */}
      <AnimatePresence>
        {(disconnectedId || lobbyClosed) && phase !== 'MatchCompleted' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 flex items-center justify-center z-20">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="rounded-2xl p-6 text-center shadow-2xl max-w-sm mx-4"
              style={{ background: '#00160c', border: '1px solid rgba(0,100,45,0.40)' }}>
              {lobbyClosed ? (
                <>
                  <div className="text-4xl mb-3">🔌</div>
                  <h2 className="text-xl font-bold text-green-100 mb-2">Lobby Closed</h2>
                  <p className="text-green-700 mb-5 text-sm">A player didn't reconnect in time.</p>
                  <motion.button onClick={onReturnToLobby} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    className="bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl px-6 py-2.5 font-semibold">
                    Return to Lobby
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.9, repeat: Infinity }}
                    className="text-4xl mb-3">⏳</motion.div>
                  <h2 className="text-xl font-bold text-stone-100 mb-2">Player Disconnected</h2>
                  <p className="text-stone-400 text-sm">
                    <span className="text-white font-semibold">
                      {session.players.find(p => p.playerId === disconnectedId)?.displayName ?? 'A player'}
                    </span>{' '}has 10 s to reconnect…
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
