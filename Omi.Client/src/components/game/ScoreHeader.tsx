import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameSession, RoundResult, Suit } from '../../types/game'
import { SUIT_SYMBOL, isRedSuit } from '../../utils/cardHelpers'

interface Props {
  session: GameSession
  phase:   string
}

function ScorePill({ value, team }: { value: number; team: 'A' | 'B' }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ scale: 1.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className="font-black tabular-nums"
        style={{
          fontSize: 22,
          lineHeight: 1,
          color: team === 'A' ? '#f87171' : '#9ca3af',
        }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}

function RoundChip({ r }: { r: RoundResult }) {
  const isDraw = r.carryAdded > 0
  const aWon   = r.teamAPointsEarned > 0
  const trump  = r.trumpSuit ? SUIT_SYMBOL[r.trumpSuit as Suit] : ''
  const tRed   = r.trumpSuit ? isRedSuit(r.trumpSuit as Suit) : false

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold"
      style={{
        background: isDraw ? 'rgba(0,60,25,0.50)' : aWon ? 'rgba(127,29,29,0.40)' : 'rgba(30,30,30,0.40)',
        border: isDraw ? '1px solid rgba(0,100,40,0.40)' : aWon ? '1px solid rgba(185,28,28,0.40)' : '1px solid rgba(75,85,99,0.40)',
      }}
    >
      <span style={{ color: '#3d7055', opacity: 0.7 }}>R{r.roundNumber}</span>
      {trump && <span className={tRed ? 'text-red-400' : 'text-gray-300'}>{trump}</span>}
      <span style={{ color: '#a0b0a8' }}>{r.teamATricks}–{r.teamBTricks}</span>
      <span className="font-bold" style={{ color: isDraw ? '#f59e0b' : aWon ? '#f87171' : '#9ca3af' }}>
        {isDraw ? `+${r.carryAdded}` : aWon ? `A+${r.teamAPointsEarned}` : `B+${r.teamBPointsEarned}`}
      </span>
    </motion.div>
  )
}

export default function ScoreHeader({ session, phase }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)

  const teamANames = session.players.filter(p => p.seatIndex % 2 === 0).map(p => p.displayName)
  const teamBNames = session.players.filter(p => p.seatIndex % 2 === 1).map(p => p.displayName)
  const isPlaying  = phase === 'Playing'

  return (
    <div className="sticky top-0 z-30" style={{ background: 'rgba(0,10,4,0.96)', borderBottom: '1px solid rgba(0,80,30,0.25)', backdropFilter: 'blur(10px)' }}>

      {/* ── Main score row ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-14 gap-2">

        {/* Team A */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 5px rgba(239,68,68,0.7)' }} />
          <div className="min-w-0">
            <div style={{ fontSize: 9, fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Team A</div>
            <div className="truncate" style={{ fontSize: 10, color: '#2e5a40', maxWidth: 80 }}>{teamANames.join(' & ') || '—'}</div>
          </div>
          <div className="flex items-baseline gap-0.5 flex-shrink-0">
            <ScorePill value={session.teamAMatchPoints} team="A" />
            <span style={{ fontSize: 10, color: '#1e3028' }}>/10</span>
          </div>
        </div>

        {/* Centre info */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {/* Trump */}
          <AnimatePresence mode="wait">
            {session.trumpSuit ? (
              <motion.div
                key={session.trumpSuit}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(100,50,0,0.45)', border: '1px solid rgba(245,158,11,0.40)' }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: '#92650a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>trump</span>
                <span className={`font-black leading-none`} style={{ fontSize: 16, color: isRedSuit(session.trumpSuit) ? '#f87171' : '#e5e7eb' }}>
                  {SUIT_SYMBOL[session.trumpSuit]}
                </span>
              </motion.div>
            ) : (
              <div style={{ fontSize: 9.5, color: '#1e3028', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                {phase.replace(/([A-Z])/g, ' $1').trim()}
              </div>
            )}
          </AnimatePresence>

          {/* Trick dots — 8 filled dots, red for A, gray for B */}
          {isPlaying && (
            <div className="flex items-center gap-[3px]">
              {Array.from({ length: 8 }).map((_, i) => {
                const isA = i < session.teamATricksWon
                const isB = i >= session.teamATricksWon && i < session.teamATricksWon + session.teamBTricksWon
                return (
                  <motion.div
                    key={i}
                    animate={isA || isB ? { scale: [1.4, 1] } : {}}
                    transition={{ type: 'spring', stiffness: 500 }}
                    className="rounded-full"
                    style={{
                      width: 7, height: 7,
                      background: isA ? '#ef4444' : isB ? '#6b7280' : 'rgba(0,50,20,0.60)',
                      boxShadow:  isA ? '0 0 4px rgba(239,68,68,0.55)' : isB ? '0 0 4px rgba(107,114,128,0.40)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          )}

          {/* Carry */}
          {session.carriedPoints > 0 && (
            <span style={{ fontSize: 9, color: '#d4a017', fontWeight: 700 }}>+{session.carriedPoints} carry</span>
          )}
        </div>

        {/* Team B */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <div className="flex items-baseline gap-0.5 flex-shrink-0">
            <ScorePill value={session.teamBMatchPoints} team="B" />
            <span style={{ fontSize: 10, color: '#1e3028' }}>/10</span>
          </div>
          <div className="min-w-0 text-right">
            <div style={{ fontSize: 9, fontWeight: 700, color: '#374151', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Team B</div>
            <div className="truncate" style={{ fontSize: 10, color: '#2e5a40', maxWidth: 80 }}>{teamBNames.join(' & ') || '—'}</div>
          </div>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#6b7280', boxShadow: '0 0 5px rgba(107,114,128,0.50)' }} />
        </div>
      </div>

      {/* ── Collapsible round history ──────────────────────────────────────── */}
      {session.roundHistory.length > 0 && (
        <>
          <div
            className="flex items-center gap-2 px-3 pb-1 cursor-pointer"
            onClick={() => setHistoryOpen(o => !o)}
          >
            <span style={{ fontSize: 9, color: '#1e3028', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>History</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,70,25,0.20)' }} />
            <motion.span
              animate={{ rotate: historyOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 10, color: '#1e3028', lineHeight: 1 }}
            >
              ▾
            </motion.span>
          </div>

          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto">
                  {session.roundHistory.map(r => <RoundChip key={r.roundNumber} r={r} />)}
                  <div className="flex-shrink-0 flex flex-col items-center pl-2 ml-1"
                    style={{ borderLeft: '1px solid rgba(0,70,25,0.25)' }}>
                    <span style={{ fontSize: 9, color: '#1e3028', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171' }}>{session.teamAMatchPoints}A</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af' }}>{session.teamBMatchPoints}B</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
