import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  teamA:        number
  teamB:        number
  carriedPoints?: number
}

export default function RoundTricks({ teamA, teamB, carriedPoints = 0 }: Props) {
  return (
    <div
      className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none select-none"
      style={{
        background: 'rgba(0,8,4,0.78)',
        border: '1px solid rgba(0,90,38,0.40)',
        borderRadius: 10,
        padding: '6px 10px',
      }}
    >
      <div className="flex items-center gap-2.5">
        <TeamCount value={teamA} label="A" color="#f87171" labelColor="#c92a2a" />
        <span style={{ fontSize: 11, color: '#3d7055', fontWeight: 700 }}>–</span>
        <TeamCount value={teamB} label="B" color="#9ca3af" labelColor="#4b5563" />
      </div>

      {/* 8 trick squares */}
      <div className="flex items-center gap-[3px]">
        {Array.from({ length: 8 }).map((_, i) => {
          const isA = i < teamA
          const isB = i >= teamA && i < teamA + teamB
          return (
            <motion.div
              key={i}
              animate={isA || isB ? { scale: [1.4, 1] } : {}}
              transition={{ type: 'spring', stiffness: 500 }}
              style={{
                width: 7, height: 7, borderRadius: 2,
                background: isA ? '#ef4444' : isB ? '#6b7280' : 'rgba(0,50,20,0.55)',
                boxShadow:  isA ? '0 0 4px rgba(239,68,68,0.55)' : isB ? '0 0 4px rgba(107,114,128,0.40)' : 'none',
              }}
            />
          )
        })}
      </div>

      <AnimatePresence>
        {carriedPoints > 0 && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ fontSize: 10, color: '#fcd34d', fontWeight: 700, letterSpacing: '0.04em' }}
          >
            +{carriedPoints} carry
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function TeamCount({ value, label, color, labelColor }: { value: number; label: string; color: string; labelColor: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ scale: 1.6, opacity: 0, y: -2 }}
          animate={{ scale: 1,   opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span style={{ fontSize: 9, fontWeight: 700, color: labelColor, letterSpacing: '0.08em' }}>{label}</span>
    </div>
  )
}
