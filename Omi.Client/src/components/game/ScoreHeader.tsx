import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameSession, RoundResult, Suit } from '../../types/game'
import { SUIT_SYMBOL, isRedSuit } from '../../utils/cardHelpers'
import LeaveButton from '../LeaveButton'

interface Props {
  session: GameSession
  phase:   string
  onLeave: () => void
}

/* ── Compact top bar ────────────────────────────────────────────────────────
   Header is now match-level only:
     [ Team A score ]   [ Round # · Trump ]   [ Team B score ]   [ History ]
   Round-level trick counts live inside the felt (RoundTricks component).
   Team names live on each PlayerSeat. History collapses behind a button.
─────────────────────────────────────────────────────────────────────────── */
export default function ScoreHeader({ session, phase, onLeave }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const roundNumber = session.roundHistory.length + 1
  const hasHistory  = session.roundHistory.length > 0

  return (
    <div
      className="sticky top-0 z-30"
      style={{
        background:      'rgba(0,10,4,0.96)',
        borderBottom:    '1px solid rgba(0,80,30,0.25)',
        backdropFilter:  'blur(10px)',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <LeaveButton onConfirm={onLeave} label="Leave" className="flex-shrink-0" />

        <MatchScore team="A" value={session.teamAMatchPoints} />

        <CentrePill phase={phase} trump={session.trumpSuit} roundNumber={roundNumber} />

        <MatchScore team="B" value={session.teamBMatchPoints} />

        {hasHistory && (
          <motion.button
            onClick={() => setHistoryOpen(o => !o)}
            whileTap={{ scale: 0.94 }}
            className="rounded-lg px-2.5 flex items-center gap-1 flex-shrink-0"
            style={{
              background: historyOpen ? 'rgba(13,207,177,0.10)' : 'rgba(0,30,14,0.55)',
              border:     `1px solid ${historyOpen ? 'rgba(13,207,177,0.35)' : 'rgba(0,80,35,0.40)'}`,
              color:      historyOpen ? '#0dcfb1' : '#4a8a62',
              fontSize:   11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              minHeight:  36,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-expanded={historyOpen}
            aria-label="Toggle round history"
          >
            <span>History</span>
            <span style={{
              background: 'rgba(0,0,0,0.30)', borderRadius: 8, padding: '0 6px',
              fontSize: 10, fontWeight: 800,
            }}>{session.roundHistory.length}</span>
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {historyOpen && hasHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(0,70,25,0.20)' }}
          >
            <div className="flex flex-col gap-1.5 px-3 py-3">
              {session.roundHistory.map((r, i) => <RoundRow key={r.roundNumber} r={r} index={i} />)}
              <div
                className="flex items-center justify-between px-3 pt-2 mt-1"
                style={{ borderTop: '1px solid rgba(0,70,25,0.20)' }}
              >
                <span style={{ fontSize: 10, color: '#3d7055', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Match total
                </span>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#f87171' }}>A {session.teamAMatchPoints}</span>
                  <span style={{ fontSize: 11, color: '#3d7055' }}>—</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#9ca3af' }}>B {session.teamBMatchPoints}</span>
                  <span style={{ fontSize: 11, color: '#3d7055' }}>/10</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Match score pill (left/right of header) ─────────────────────────────── */
function MatchScore({ team, value }: { team: 'A' | 'B'; value: number }) {
  const color    = team === 'A' ? '#f87171' : '#9ca3af'
  const labelCol = team === 'A' ? '#c92a2a' : '#4b5563'
  const dotCol   = team === 'A' ? '#ef4444' : '#6b7280'
  const dotGlow  = team === 'A' ? 'rgba(239,68,68,0.7)' : 'rgba(107,114,128,0.5)'

  return (
    <div className={`flex items-center gap-2 flex-1 ${team === 'B' ? 'justify-end' : ''}`}>
      {team === 'A' && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotCol, boxShadow: `0 0 5px ${dotGlow}` }} />}
      <div className={team === 'B' ? 'text-right' : ''}>
        <div style={{ fontSize: 10, fontWeight: 700, color: labelCol, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Team {team}
        </div>
        <div className="flex items-baseline gap-0.5">
          <AnimatePresence mode="wait">
            <motion.span
              key={value}
              initial={{ scale: 1.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: 11, color: '#3d7055' }}>/10</span>
        </div>
      </div>
      {team === 'B' && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotCol, boxShadow: `0 0 5px ${dotGlow}` }} />}
    </div>
  )
}

/* ── Centre pill: round # + trump (or phase) ─────────────────────────────── */
function CentrePill({ phase, trump, roundNumber }: { phase: string; trump: Suit | null; roundNumber: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <span style={{ fontSize: 10, fontWeight: 700, color: '#3d7055', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        Round {roundNumber}
      </span>
      <AnimatePresence mode="wait">
        {trump ? (
          <motion.div
            key={trump}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 450, damping: 22 }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(100,50,0,0.45)', border: '1px solid rgba(245,158,11,0.40)' }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#b07e20', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              trump
            </span>
            <span className="font-black leading-none" style={{ fontSize: 16, color: isRedSuit(trump) ? '#f87171' : '#e5e7eb' }}>
              {SUIT_SYMBOL[trump]}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="phase"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ fontSize: 11, color: '#4a8a62', fontWeight: 600, letterSpacing: '0.06em' }}
          >
            {phase.replace(/([A-Z])/g, ' $1').trim()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── History row (inside collapsible drawer) ─────────────────────────────── */
function RoundRow({ r, index }: { r: RoundResult; index: number }) {
  const isDraw = r.carryAdded > 0
  const aWon   = r.teamAPointsEarned > 0
  const trump  = r.trumpSuit ? SUIT_SYMBOL[r.trumpSuit as Suit] : '–'
  const tRed   = r.trumpSuit ? isRedSuit(r.trumpSuit as Suit) : false

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 380, damping: 28 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: isDraw
          ? 'rgba(0,60,25,0.35)'
          : aWon ? 'rgba(127,29,29,0.25)' : 'rgba(30,30,40,0.25)',
        border: isDraw
          ? '1px solid rgba(0,100,40,0.30)'
          : aWon ? '1px solid rgba(185,28,28,0.30)' : '1px solid rgba(75,85,99,0.30)',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: '#3d7055', letterSpacing: '0.10em', minWidth: 22 }}>R{r.roundNumber}</span>

      <span className={tRed ? 'text-red-400' : 'text-gray-300'} style={{ fontSize: 14, lineHeight: 1, minWidth: 14, textAlign: 'center' }}>
        {trump}
      </span>

      <div className="flex items-center gap-1 flex-1">
        <span style={{ fontSize: 10, fontWeight: 700, color: '#c92a2a', letterSpacing: '0.08em' }}>A</span>
        <div className="flex gap-[3px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: 2,
                background: i < r.teamATricks ? '#ef4444' : 'rgba(0,50,20,0.40)',
                boxShadow:  i < r.teamATricks ? '0 0 4px rgba(239,68,68,0.45)' : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', minWidth: 12 }}>{r.teamATricks}</span>
      </div>

      <span style={{ fontSize: 10, color: '#3d7055' }}>vs</span>

      <div className="flex items-center gap-1 flex-1 justify-end">
        <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', minWidth: 12, textAlign: 'right' }}>{r.teamBTricks}</span>
        <div className="flex gap-[3px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: 2,
                background: i < r.teamBTricks ? '#6b7280' : 'rgba(0,50,20,0.40)',
                boxShadow:  i < r.teamBTricks ? '0 0 4px rgba(107,114,128,0.40)' : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em' }}>B</span>
      </div>

      <div
        className="rounded-lg px-2 py-0.5 flex-shrink-0 font-black"
        style={{
          fontSize: 11,
          background: isDraw
            ? 'rgba(100,60,0,0.35)'
            : aWon ? 'rgba(127,29,29,0.35)' : 'rgba(55,65,81,0.35)',
          color: isDraw ? '#fcd34d' : aWon ? '#f87171' : '#9ca3af',
          border: isDraw
            ? '1px solid rgba(200,120,0,0.35)'
            : aWon ? '1px solid rgba(185,28,28,0.35)' : '1px solid rgba(75,85,99,0.35)',
          minWidth: 42,
          textAlign: 'center',
        }}
      >
        {isDraw
          ? `+${r.carryAdded} 🔄`
          : aWon
            ? `A +${r.teamAPointsEarned}`
            : `B +${r.teamBPointsEarned}`}
      </div>
    </motion.div>
  )
}
