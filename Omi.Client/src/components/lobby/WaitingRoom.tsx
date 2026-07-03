import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameSession } from '../../types/game'
import LeaveButton from '../LeaveButton'

interface Props {
  session:    GameSession
  myPlayerId: string
  isCreator:  boolean
  onStart:    () => Promise<void>
  onCopyCode: () => void
  onLeave:    () => void
  copied:     boolean
  startError: string | null
}

const TEAM_A_SEATS = new Set([0, 2])

// Position each seat relative to mySeat (0=bottom,1=right,2=top,3=left)
function getSeatLayout(mySeat: number) {
  return [0, 1, 2, 3].map(seat => {
    const rel = ((seat - mySeat) + 4) % 4
    const positions: Record<number, { style: React.CSSProperties; label: string }> = {
      0: { label: 'You',    style: { bottom: -18, left: '50%', transform: 'translateX(-50%)' } },
      1: { label: 'Right',  style: { right: -18,  top: '50%',  transform: 'translateY(-50%)' } },
      2: { label: 'Across', style: { top: -18,    left: '50%', transform: 'translateX(-50%)' } },
      3: { label: 'Left',   style: { left: -18,   top: '50%',  transform: 'translateY(-50%)' } },
    }
    return { seat, rel, ...positions[rel] }
  })
}

export default function WaitingRoom({
  session, myPlayerId, isCreator, onStart, onCopyCode, onLeave, copied, startError,
}: Props) {
  const isFull  = session.players.length === 4
  const me      = session.players.find(p => p.playerId === myPlayerId)
  const mySeat  = me?.seatIndex ?? 0
  const layout  = getSeatLayout(mySeat) as { seat: number; style: React.CSSProperties; label: string }[]

  const seenSeats = useRef<Set<number>>(new Set(session.players.map(p => p.seatIndex)))
  const newSeats  = new Set<number>()
  session.players.forEach(p => {
    if (!seenSeats.current.has(p.seatIndex)) {
      newSeats.add(p.seatIndex)
      seenSeats.current.add(p.seatIndex)
    }
  })

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px]"
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <LeaveButton onConfirm={onLeave} label="← Leave" className="mb-2" />
            <h2 className="font-display font-bold text-xl tracking-wide" style={{ color: '#d4a017' }}>
              Waiting Room
            </h2>
            <p style={{ color: '#3d7055', fontSize: 13, marginTop: 2 }}>
              {isFull ? 'All players are here!' : `Waiting for ${4 - session.players.length} more…`}
            </p>
          </div>

          {/* Lobby code */}
          <div className="flex items-center gap-2">
            <div>
              <p style={{ fontSize: 11, color: '#3d7055', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'right', marginBottom: 2 }}>
                Code
              </p>
              <p className="font-mono font-black tracking-[0.25em]" style={{ fontSize: 20, color: '#f59e0b', lineHeight: 1 }}>
                {session.lobbyId}
              </p>
            </div>
            <motion.button
              onClick={onCopyCode}
              whileTap={{ scale: 0.92 }}
              className="rounded-lg px-2.5 py-2 text-xs font-bold transition-colors"
              style={{
                background: copied ? 'rgba(13,207,177,0.15)' : 'rgba(0,60,25,0.40)',
                border:     `1px solid ${copied ? '#0dcfb1' : '#1a4a2e'}`,
                color:      copied ? '#0dcfb1' : '#3d7055',
                minHeight:  44,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {copied ? '✓' : 'Copy'}
            </motion.button>
          </div>
        </div>

        {/* Visual table */}
        <div className="flex justify-center mb-8">
          <div className="relative" style={{ width: 'clamp(180px, 50vw, 240px)', height: 'clamp(140px, 40vw, 190px)' }}>
            {/* Felt surface */}
            <div className="absolute felt-table rounded-2xl" style={{ inset: 24 }} />

            {/* Seat avatars */}
            {layout.map(({ seat, style, label }) => {
              const player   = session.players.find(p => p.seatIndex === seat)
              const isMe     = player?.playerId === myPlayerId
              const isTeamA  = TEAM_A_SEATS.has(seat)
              const isEmpty  = !player
              const isNew    = newSeats.has(seat)

              return (
                <div key={seat} className="absolute" style={style}>
                  <AnimatePresence>
                    {isNew && (
                      <motion.span
                        initial={{ opacity: 1, y: 0, scale: 0 }}
                        animate={{ opacity: [1, 1, 0], y: -28, scale: [0, 1.4, 1.2] }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                        className="absolute pointer-events-none z-10 text-lg"
                        style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
                      >
                        💕
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <motion.div
                    animate={isNew ? { scale: [1, 1.18, 1] } : {}}
                    transition={{ duration: 0.4, type: 'spring' }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <div
                      className="rounded-full flex items-center justify-center font-black text-sm border-2 transition-all"
                      style={{
                        width: 36, height: 36,
                        background: isEmpty
                          ? 'transparent'
                          : isTeamA ? '#7f1d1d' : '#374151',
                        borderStyle:  isEmpty ? 'dashed' : 'solid',
                        borderColor:  isEmpty
                          ? 'rgba(0,120,55,0.50)'
                          : isTeamA ? '#b91c1c' : '#4b5563',
                        color: isEmpty ? '#3d7055' : '#f0f0f0',
                        opacity: isEmpty ? 0.45 : 1,
                        boxShadow: isMe
                          ? '0 0 0 2px rgba(13,207,177,0.6)'
                          : 'none',
                      }}
                    >
                      {player ? player.displayName[0].toUpperCase() : '?'}
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isMe ? '#0dcfb1' : isEmpty ? '#3d7055' : '#4a8a62',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>
                      {player ? (isMe ? 'You' : player.displayName.split(' ')[0]) : label}
                    </span>
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Player list */}
        <div className="rounded-2xl overflow-hidden mb-4"
          style={{ background: 'rgba(0,14,6,0.70)', border: '1px solid #183d26' }}>

          {/* Team headers */}
          <div className="grid grid-cols-2 text-center py-2 px-4"
            style={{ borderBottom: '1px solid #183d26' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c92a2a', letterSpacing: '0.10em', textTransform: 'uppercase' }}>Team A · Seats 0 & 2</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.10em', textTransform: 'uppercase' }}>Team B · Seats 1 & 3</span>
          </div>

          {/* 4 slots */}
          {[0, 1, 2, 3].map(seat => {
            const player  = session.players.find(p => p.seatIndex === seat)
            const isMe    = player?.playerId === myPlayerId
            const isTeamA = TEAM_A_SEATS.has(seat)

            return (
              <motion.div
                key={seat}
                layout
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: seat < 3 ? '1px solid rgba(24,61,38,0.40)' : 'none',
                  background:   player ? 'rgba(0,25,12,0.40)' : 'transparent',
                }}
              >
                {/* Seat dot */}
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                  style={{
                    background: player
                      ? isTeamA ? '#7f1d1d' : '#374151'
                      : 'transparent',
                    border: player ? 'none' : '1px dashed rgba(0,120,55,0.50)',
                    color: player ? '#f0f0f0' : '#3d7055',
                  }}>
                  {seat}
                </div>

                <div className="flex-1 min-w-0">
                  {player ? (
                    <span className="font-semibold text-sm truncate block" style={{ color: '#e8f0ec' }}>
                      {player.displayName}
                      {isMe && (
                        <span className="ml-2 text-[10px] font-bold" style={{ color: '#0dcfb1' }}>you</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: '#3d7055' }}>Empty seat</span>
                  )}
                </div>

                <span className="text-[11px] font-bold flex-shrink-0"
                  style={{ color: isTeamA ? '#c92a2a' : '#6b7280' }}>
                  {isTeamA ? 'T·A' : 'T·B'}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Error */}
        <AnimatePresence>
          {startError && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="text-sm text-center rounded-xl px-3 py-2 mb-3"
              style={{ color: '#fca5a5', background: 'rgba(120,0,0,0.25)', border: '1px solid rgba(200,0,0,0.30)' }}
            >
              {startError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Action */}
        {isCreator ? (
          <>
            {!isFull && (
              <p className="text-center text-xs mb-3" style={{ color: '#3d7055' }}>
                Need {4 - session.players.length} more player{session.players.length < 3 ? 's' : ''} to start
              </p>
            )}
            <motion.button
              disabled={!isFull}
              onClick={onStart}
              whileHover={isFull ? { scale: 1.02, y: -1 } : {}}
              whileTap={isFull ? { scale: 0.97 } : {}}
              className="btn-primary"
              style={{ fontSize: 15, letterSpacing: '0.02em' }}
            >
              {isFull ? 'Start Game' : `Waiting (${session.players.length}/4)`}
            </motion.button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2.5 py-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: '#183d26', borderTopColor: '#f59e0b' }}
            />
            <p className="text-sm" style={{ color: '#3d7055' }}>Waiting for the host to start…</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
