import { motion, AnimatePresence } from 'framer-motion'
import type { Player } from '../../types/game'
import { teamOf } from './teamConfig'

interface Props {
  player:        Player | undefined
  mySeat:        number
  isMe:          boolean
  isCurrentTurn: boolean
  isDealer:      boolean
  cardCount:     number
  label:         string
  disconnected:  boolean
  countdown?:    number | null
}

const TEAL_GLOW = 'rgba(13,207,177,0.60)'

export default function PlayerSeat({
  player, mySeat, isMe, isCurrentTurn, isDealer, cardCount, label, disconnected, countdown,
}: Props) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-1 select-none" style={{ opacity: 0.55 }}>
        <div className="w-9 h-9 rounded-full border-2 border-dashed"
          style={{ borderColor: 'rgba(0,100,45,0.55)' }} />
        <span style={{ fontSize: 11, color: '#3d7055' }}>{label}</span>
      </div>
    )
  }

  const team     = teamOf(player.seatIndex)
  const myTeam   = teamOf(mySeat)
  const relation = isMe ? 'you' : team === myTeam ? 'partner' : 'opp'
  const initials = player.displayName.slice(0, 2).toUpperCase()

  const avatarBg     = team === 'A' ? '#7f1d1d' : '#1f2937'
  const avatarBorder = isCurrentTurn
    ? '#0dcfb1'
    : team === 'A' ? '#991b1b' : '#374151'

  return (
    <div className={`flex flex-col items-center gap-1 select-none transition-opacity duration-300 ${disconnected ? 'opacity-35' : ''}`}>
      <div className="relative">
        <motion.div
          animate={isCurrentTurn ? {
            boxShadow: [`0 0 0 0px ${TEAL_GLOW}`, `0 0 0 10px rgba(13,207,177,0)`, `0 0 0 0px ${TEAL_GLOW}`],
          } : { boxShadow: '0 0 0 0px transparent' }}
          transition={{ duration: 1.4, repeat: isCurrentTurn ? Infinity : 0, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all"
          style={{
            background:  avatarBg,
            border:      `2px solid ${avatarBorder}`,
            color:       '#f0f0f0',
            boxShadow:   isCurrentTurn ? `0 0 0 0px ${TEAL_GLOW}` : 'none',
            letterSpacing: '-0.02em',
          }}
        >
          {initials}
        </motion.div>

        {/* Dealer chip */}
        {isDealer && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
            style={{ background: '#d4a017', color: '#000a04', border: '1.5px solid #92650a', zIndex: 1 }}
          >
            D
          </motion.div>
        )}

        {/* Disconnect flash */}
        {disconnected && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(220,0,0,0.30)' }}
          />
        )}

        {/* Countdown — overlaid bottom-centre of avatar, no layout shift */}
        <AnimatePresence>
          {countdown != null && countdown > 0 && (
            <motion.div
              key={countdown}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 font-black whitespace-nowrap"
              style={{
                fontSize: 11,
                lineHeight: '16px',
                background: countdown <= 3 ? 'rgba(180,0,0,0.92)' : 'rgba(100,55,0,0.92)',
                border:     countdown <= 3 ? '1px solid #ef4444' : '1px solid #d4a017',
                color:      countdown <= 3 ? '#fca5a5' : '#fcd34d',
                zIndex:     10,
              }}
            >
              {countdown}s
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name + relation */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-semibold leading-none truncate"
          style={{ fontSize: 12, color: '#d0e8da', maxWidth: 70, display: 'block', textAlign: 'center' }}>
          {player.displayName}
        </span>
        <span className="rounded-full px-1.5 py-px font-semibold leading-none"
          style={{
            fontSize: 10,
            background: relation === 'you' ? 'rgba(13,207,177,0.12)' : relation === 'partner' ? 'rgba(127,29,29,0.25)' : 'rgba(55,65,81,0.25)',
            color: relation === 'you' ? '#0dcfb1' : relation === 'partner' ? '#f87171' : '#6b7280',
            border: relation === 'you' ? '1px solid rgba(13,207,177,0.25)' : relation === 'partner' ? '1px solid rgba(185,28,28,0.25)' : '1px solid rgba(75,85,99,0.25)',
          }}>
          {relation === 'you' ? 'YOU' : relation === 'partner' ? 'PARTNER' : 'OPP'}
        </span>
      </div>

      {/* Card fan */}
      {!isMe && cardCount > 0 && (
        <div className="relative flex items-end justify-center mt-0.5"
          style={{ width: Math.min(cardCount, 8) * 7 + 18, height: 26 }}>
          {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => {
            const total = Math.min(cardCount, 8)
            const mid   = (total - 1) / 2
            const angle = (i - mid) * 7
            const lift  = Math.abs(i - mid) * 0.5
            return (
              <div
                key={i}
                className="absolute card-back rounded-[3px]"
                style={{
                  width: 13, height: 18,
                  bottom: lift,
                  left:   i * 7,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '50% 160%',
                  zIndex: i,
                  border: '1.5px solid rgba(200,160,0,0.35)',
                }}
              />
            )
          })}
        </div>
      )}

      {disconnected && (
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: '0.05em' }}>DISCONNECTED</span>
      )}
    </div>
  )
}
