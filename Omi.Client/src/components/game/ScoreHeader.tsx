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
        style={{ fontSize: 22, lineHeight: 1, color: team === 'A' ? '#f87171' : '#9ca3af' }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}

function RoundRow({ r, index }: { r: RoundResult; index: number }) {
  const isDraw  = r.carryAdded > 0
  const aWon    = r.teamAPointsEarned > 0
  const trump   = r.trumpSuit ? SUIT_SYMBOL[r.trumpSuit as Suit] : '–'
  const tRed    = r.trumpSuit ? isRedSuit(r.trumpSuit as Suit) : false
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
      {/* Round number */}
      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#3d7055', letterSpacing: '0.12em', minWidth: 20 }}>R{r.roundNumber}</span>

      {/* Trump */}
      <span className={tRed ? 'text-red-400' : 'text-gray-300'} style={{ fontSize: 14, lineHeight: 1, minWidth: 14, textAlign: 'center' }}>
        {trump}
      </span>

      {/* Trick bar — Team A */}
      <div className="flex items-center gap-1 flex-1">
        <span style={{ fontSize: 9, fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.08em' }}>A</span>
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

      {/* Divider */}
      <span style={{ fontSize: 10, color: '#2e5a40' }}>vs</span>

      {/* Trick bar — Team B */}
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
        <span style={{ fontSize: 9, fontWeight: 700, color: '#374151', letterSpacing: '0.08em' }}>B</span>
      </div>

      {/* Points earned badge */}
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

export default function ScoreHeader({ session, phase }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)

  const teamANames = session.players.filter(p => p.seatIndex % 2 === 0).map(p => p.displayName)
  const teamBNames = session.players.filter(p => p.seatIndex % 2 === 1).map(p => p.displayName)
  const isPlaying  = phase === 'Playing'
  const latest     = session.roundHistory[session.roundHistory.length - 1] ?? null

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

        {/* Centre */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">

          {/* Trump pill */}
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
                <span className="font-black leading-none" style={{ fontSize: 15, color: isRedSuit(session.trumpSuit) ? '#f87171' : '#e5e7eb' }}>
                  {SUIT_SYMBOL[session.trumpSuit]}
                </span>
              </motion.div>
            ) : (
              <div style={{ fontSize: 9, color: '#1e3028', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                {phase.replace(/([A-Z])/g, ' $1').trim()}
              </div>
            )}
          </AnimatePresence>

          {/* Live round trick score — big and clear */}
          {isPlaying && (
            <div className="flex items-center gap-1.5">
              {/* Team A count */}
              <div className="flex flex-col items-center" style={{ minWidth: 28 }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={session.teamATricksWon}
                    initial={{ scale: 1.7, opacity: 0, y: -4 }}
                    animate={{ scale: 1,   opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: '#f87171', display: 'block', textAlign: 'center' }}
                  >
                    {session.teamATricksWon}
                  </motion.span>
                </AnimatePresence>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.1em' }}>A</span>
              </div>

              {/* Divider */}
              <span style={{ fontSize: 13, color: '#2e5a40', fontWeight: 700, lineHeight: 1, paddingBottom: 10 }}>–</span>

              {/* Team B count */}
              <div className="flex flex-col items-center" style={{ minWidth: 28 }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={session.teamBTricksWon}
                    initial={{ scale: 1.7, opacity: 0, y: -4 }}
                    animate={{ scale: 1,   opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: '#9ca3af', display: 'block', textAlign: 'center' }}
                  >
                    {session.teamBTricksWon}
                  </motion.span>
                </AnimatePresence>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#374151', letterSpacing: '0.1em' }}>B</span>
              </div>
            </div>
          )}

          {/* Trick squares — visual breakdown */}
          {isPlaying && (
            <div className="flex items-center gap-[3px]">
              {Array.from({ length: 8 }).map((_, i) => {
                const isA = i < session.teamATricksWon
                const isB = i >= session.teamATricksWon && i < session.teamATricksWon + session.teamBTricksWon
                return (
                  <motion.div
                    key={i}
                    animate={isA || isB ? { scale: [1.5, 1] } : {}}
                    transition={{ type: 'spring', stiffness: 500 }}
                    style={{
                      width: 7, height: 7, borderRadius: 2,
                      background: isA ? '#ef4444' : isB ? '#6b7280' : 'rgba(0,50,20,0.55)',
                      boxShadow: isA ? '0 0 4px rgba(239,68,68,0.55)' : isB ? '0 0 4px rgba(107,114,128,0.40)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          )}

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

      {/* ── Latest round inline strip (always visible if history exists) ─── */}
      {latest && (
        <div
          className="flex items-center gap-2 px-3 pb-1.5 cursor-pointer select-none"
          onClick={() => setHistoryOpen(o => !o)}
        >
          {/* Latest round quick summary */}
          <AnimatePresence mode="wait">
            <motion.div
              key={latest.roundNumber}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5"
            >
              <span style={{ fontSize: 9, color: '#1e3028', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Last round:
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#f87171' }}>A {latest.teamATricks}</span>
              <span style={{ fontSize: 9, color: '#2e5a40' }}>–</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af' }}>{latest.teamBTricks} B</span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: latest.carryAdded > 0 ? '#fcd34d' : latest.teamAPointsEarned > 0 ? '#f87171' : '#9ca3af',
              }}>
                {latest.carryAdded > 0
                  ? `(draw +${latest.carryAdded} carry)`
                  : latest.teamAPointsEarned > 0
                    ? `→ A +${latest.teamAPointsEarned}pt`
                    : `→ B +${latest.teamBPointsEarned}pt`}
              </span>
            </motion.div>
          </AnimatePresence>

          <div className="flex-1 h-px" style={{ background: 'rgba(0,70,25,0.20)' }} />

          {session.roundHistory.length > 1 && (
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 9, color: '#1e3028', fontWeight: 600 }}>
                {historyOpen ? 'Hide' : `All ${session.roundHistory.length} rounds`}
              </span>
              <motion.span
                animate={{ rotate: historyOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ fontSize: 10, color: '#1e3028', lineHeight: 1 }}
              >
                ▾
              </motion.span>
            </div>
          )}
        </div>
      )}

      {/* ── Full round history (collapsible, shown when >1 round) ─────── */}
      <AnimatePresence>
        {historyOpen && session.roundHistory.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              {session.roundHistory.map((r, i) => <RoundRow key={r.roundNumber} r={r} index={i} />)}
              {/* Totals row */}
              <div className="flex items-center justify-between px-3 pt-1" style={{ borderTop: '1px solid rgba(0,70,25,0.20)' }}>
                <span style={{ fontSize: 9, color: '#1e3028', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Match total</span>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#f87171' }}>A: {session.teamAMatchPoints}</span>
                  <span style={{ fontSize: 10, color: '#2e5a40' }}>—</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af' }}>B: {session.teamBMatchPoints}</span>
                  <span style={{ fontSize: 10, color: '#2e5a40' }}>/10</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
