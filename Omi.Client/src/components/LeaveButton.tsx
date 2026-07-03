import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onConfirm: () => void
  label?:    string
  className?: string
}

const CONFIRM_WINDOW_MS = 3000

// Requires a second tap within CONFIRM_WINDOW_MS to actually fire — leaving a
// lobby/game can't be undone (mid-game it ends the match for all 4 players),
// so a single accidental tap shouldn't trigger it.
export default function LeaveButton({ onConfirm, label = 'Leave', className = '' }: Props) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function handleClick() {
    if (armed) {
      if (timer.current) clearTimeout(timer.current)
      setArmed(false)
      onConfirm()
      return
    }
    setArmed(true)
    timer.current = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS)
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.95 }}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${className}`}
      style={{
        background:  armed ? 'rgba(153,27,27,0.30)' : 'rgba(0,30,14,0.45)',
        border:      `1px solid ${armed ? 'rgba(220,38,38,0.55)' : 'rgba(0,80,35,0.40)'}`,
        color:       armed ? '#fca5a5' : '#3d7055',
        letterSpacing: '0.04em',
        minHeight: 32,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {armed ? 'Tap again to confirm' : label}
    </motion.button>
  )
}
