import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onJoin: (displayName: string, lobbyId: string, create: boolean) => Promise<void>
  error:  string | null
}

function randomLobbyId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Very faint decorative suit symbols — atmospheric depth, not distracting
const DECOS = [
  { s: '♠', x: '7%',  y: '10%', sz: 56, r: -14, o: 0.04 },
  { s: '♥', x: '88%', y: '6%',  sz: 72, r:  11, o: 0.05, red: true },
  { s: '♦', x: '5%',  y: '76%', sz: 60, r:  -7, o: 0.04, red: true },
  { s: '♣', x: '90%', y: '72%', sz: 56, r:  18, o: 0.04 },
  { s: '♥', x: '52%', y: '91%', sz: 44, r:   6, o: 0.03, red: true },
  { s: '♠', x: '72%', y: '44%', sz: 34, r: -11, o: 0.025 },
  { s: '♦', x: '22%', y: '50%', sz: 38, r:  16, o: 0.03, red: true },
  { s: '♣', x: '42%', y: '5%',  sz: 30, r:  -3, o: 0.025 },
]

export default function LobbyScreen({ onJoin, error }: Props) {
  const [name,    setName]    = useState('')
  const [code,    setCode]    = useState('')
  const [mode,    setMode]    = useState<'create' | 'join'>('create')
  const [loading, setLoading] = useState(false)
  // Only auto-focus on non-touch devices to avoid immediately popping the keyboard on mobile
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

  const canSubmit = name.trim().length > 0 && (mode === 'create' || code.trim().length >= 4)

  async function handle() {
    if (!canSubmit || loading) return
    const lobbyId = mode === 'create' ? randomLobbyId() : code.trim().toUpperCase()
    setLoading(true)
    try {
      await onJoin(name.trim(), lobbyId, mode === 'create')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center relative overflow-hidden px-4">

      {/* Atmospheric background suit symbols */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        {DECOS.map((d, i) => (
          <span
            key={i}
            className="absolute font-black leading-none"
            style={{
              left: d.x, top: d.y,
              fontSize: d.sz,
              opacity: d.o,
              color: d.red ? '#cc2020' : '#c8c8c8',
              transform: `rotate(${d.r}deg) translate(-50%, -50%)`,
            }}
          >
            {d.s}
          </span>
        ))}
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[360px] relative z-10"
      >
        {/* Brand */}
        <div className="text-center mb-8 select-none">
          <div className="flex items-center justify-center gap-3.5 mb-2">
            <span style={{ fontSize: 20, color: 'rgba(180,0,8,0.38)', lineHeight: 1 }}>♥</span>
            <h1
              className="font-display font-black tracking-[0.18em]"
              style={{ fontSize: 54, lineHeight: 1, color: '#d4a017' }}
            >
              OMI
            </h1>
            <span style={{ fontSize: 20, color: 'rgba(200,200,200,0.22)', lineHeight: 1 }}>♠</span>
          </div>
          <p style={{ fontSize: 12, letterSpacing: '0.30em', color: '#3d7055', fontWeight: 600, textTransform: 'uppercase' }}>
            Sri Lankan Card Game
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(170deg, #001c0f 0%, #000d06 100%)', border: '1px solid #183d26' }}>

          <div className="p-6">

            {/* Name field */}
            <div className="mb-5">
              <label className="block mb-1.5"
                style={{ fontSize: 12, fontWeight: 700, color: '#3d7055', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Your Name
              </label>
              <input
                className="omi-input"
                placeholder="Enter your name"
                value={name}
                maxLength={30}
                autoFocus={!isTouch}
                autoComplete="off"
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()}
              />
            </div>

            {/* Create / Join toggle */}
            <div className="mb-5 rounded-xl overflow-hidden flex"
              style={{ border: '1px solid #183d26', background: 'rgba(0,8,3,0.70)' }}>
              {(['create', 'join'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-2.5 text-[13px] font-bold transition-all duration-200 relative"
                  style={{
                    background: mode === m ? '#d4a017' : 'transparent',
                    color:      mode === m ? '#000a04' : '#2e5a40',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 44,
                  }}
                >
                  {m === 'create' ? 'Create Game' : 'Join Game'}
                </button>
              ))}
            </div>

            {/* Code field — slides in for join mode */}
            <AnimatePresence initial={false}>
              {mode === 'join' && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginBottom: 20 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <label className="block mb-1.5"
                    style={{ fontSize: 12, fontWeight: 700, color: '#3d7055', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    Lobby Code
                  </label>
                  <input
                    className="omi-input font-mono"
                    placeholder="XXXXXX"
                    value={code}
                    maxLength={6}
                    autoComplete="off"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.35em', fontWeight: 800, fontSize: 18 }}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handle()}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', marginBottom: 16 }}
                >
                  <p className="text-sm rounded-xl px-3 py-2.5 text-center"
                    style={{ color: '#fca5a5', background: 'rgba(120,0,0,0.25)', border: '1px solid rgba(200,0,0,0.30)' }}>
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              onClick={handle}
              disabled={!canSubmit || loading}
              whileHover={canSubmit && !loading ? { scale: 1.02, y: -1 } : {}}
              whileTap={canSubmit && !loading ? { scale: 0.97 } : {}}
              className="btn-primary"
              style={{ fontSize: 15 }}
            >
              {loading
                ? 'Connecting…'
                : mode === 'create'
                  ? 'Create Lobby'
                  : 'Join Lobby'}
            </motion.button>
          </div>

          {/* Hint footer */}
          <div className="px-6 pb-5 text-center">
            <p style={{ fontSize: 12, color: '#3d7055' }}>
              {mode === 'create'
                ? 'Share the code with 3 friends to play'
                : 'Ask the host for the 6-character code'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
