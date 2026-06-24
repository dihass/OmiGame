import { motion } from 'framer-motion'
import { RANK_LABEL, SUIT_SYMBOL, isRedSuit } from '../../utils/cardHelpers'
import type { Card } from '../../types/game'

interface Props {
  card?:      Card
  faceDown?:  boolean
  onClick?:   () => void
  disabled?:  boolean
  illegal?:   boolean
  highlight?: boolean
  size?:      'sm' | 'md' | 'lg'
  animateIn?: boolean
}

const SZ = {
  sm: { card: 'w-10 h-14',  corner: 9,  center: 20 },
  md: { card: 'w-14 h-20',  corner: 11, center: 28 },
  lg: { card: 'w-16 h-24',  corner: 13, center: 34 },
}

export default function CardView({
  card, faceDown = false, onClick, disabled = false,
  illegal = false, highlight = false, size = 'md', animateIn = false,
}: Props) {
  const s = SZ[size]

  if (faceDown || !card) {
    return (
      <div className={`${s.card} rounded-lg card-back select-none relative`} />
    )
  }

  const red      = isRedSuit(card.suit)
  const canClick = !!onClick && !disabled && !illegal
  const color    = red ? '#c8000a' : '#111111'
  const symbol   = SUIT_SYMBOL[card.suit]

  return (
    <motion.button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      initial={animateIn ? { opacity: 0, y: 20, scale: 0.85 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={canClick ? { y: -14, scale: 1.06 } : {}}
      whileTap={canClick ? { scale: 0.93 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      style={{ cursor: canClick ? 'pointer' : 'default', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      className={[
        s.card,
        'rounded-lg border select-none card-face relative overflow-hidden',
        illegal   ? 'opacity-25' : '',
        highlight ? 'border-teal-400 card-face-highlight' : 'border-slate-200',
      ].filter(Boolean).join(' ')}
    >
      {/* Top-left */}
      <div
        className="absolute top-[3px] left-[4px] flex flex-col items-center font-black leading-none select-none"
        style={{ color, fontSize: s.corner, gap: 1 }}
      >
        <span>{RANK_LABEL[card.rank]}</span>
        <span style={{ fontSize: s.corner * 0.8 }}>{symbol}</span>
      </div>

      {/* Centre */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="leading-none select-none" style={{ fontSize: s.center, color }}>
          {symbol}
        </span>
      </div>

      {/* Bottom-right (rotated) */}
      <div
        className="absolute bottom-[3px] right-[4px] flex flex-col items-center font-black leading-none rotate-180 select-none"
        style={{ color, fontSize: s.corner, gap: 1 }}
      >
        <span>{RANK_LABEL[card.rank]}</span>
        <span style={{ fontSize: s.corner * 0.8 }}>{symbol}</span>
      </div>

      {highlight && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(13,207,177,0.10) 0%, transparent 70%)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.button>
  )
}
