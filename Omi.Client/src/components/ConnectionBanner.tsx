import { AnimatePresence, motion } from 'framer-motion'
import type { ConnectionState } from '../hooks/useSignalR'

interface Props { state: ConnectionState }

export default function ConnectionBanner({ state }: Props) {
  // Only surface non-healthy states. 'connected' / 'idle' stay silent.
  const visible = state === 'reconnecting' || state === 'disconnected' || state === 'connecting'

  const config = state === 'disconnected'
    ? { text: 'Disconnected — refresh the page to rejoin', bg: 'rgba(120,0,0,0.92)', border: 'rgba(200,0,0,0.55)', color: '#fca5a5' }
    : state === 'reconnecting'
      ? { text: 'Reconnecting…', bg: 'rgba(100,55,0,0.92)', border: 'rgba(245,158,11,0.55)', color: '#fcd34d' }
      : { text: 'Connecting…',   bg: 'rgba(0,40,18,0.92)',  border: 'rgba(0,120,55,0.55)',   color: '#0dcfb1' }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{ y: -40,    opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="m-2 px-4 py-1.5 rounded-full flex items-center gap-2"
            style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              background: config.bg, border: `1px solid ${config.border}`, color: config.color,
              boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
            }}
          >
            {state !== 'disconnected' && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  border: `2px solid ${config.color}`, borderTopColor: 'transparent',
                  display: 'inline-block',
                }}
              />
            )}
            <span>{config.text}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
