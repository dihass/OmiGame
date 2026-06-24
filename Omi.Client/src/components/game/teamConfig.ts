// Team A → Crimson Red  (mirrors the red low-cards used for score tracking in physical Omi)
// Team B → Charcoal Gray (mirrors the black low-cards)
export const TEAM = {
  A: {
    avatar:    'bg-red-800 text-white',
    ring:      'ring-red-500',
    ringColor: 'rgba(185,28,28,0.55)',
    badge:     'bg-red-950/70 text-red-300 border border-red-800/80',
    header:    'text-red-400',
    dot:       'bg-red-500',
  },
  B: {
    avatar:    'bg-gray-700 text-white',
    ring:      'ring-gray-400',
    ringColor: 'rgba(107,114,128,0.55)',
    badge:     'bg-gray-800/70 text-gray-300 border border-gray-600/80',
    header:    'text-gray-300',
    dot:       'bg-gray-400',
  },
} as const

export function teamOf(seat: number): 'A' | 'B' {
  return seat % 2 === 0 ? 'A' : 'B'
}
