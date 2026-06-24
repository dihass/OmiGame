import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  rotation: number; rotSpeed: number
  color: string
  w: number; h: number
  life: number
}

const COLORS = [
  '#d4a017', '#f0c848',
  '#2dd4bf', '#5eead4',
  '#f59e0b', '#fbbf24',
  '#c0392b', '#e74c3c',
  '#f2e5c0', '#ffffff',
  '#16a34a', '#4ade80',
]

interface Props {
  intensity?: 'light' | 'full'
  onDone?:    () => void
}

export default function Confetti({ intensity = 'full', onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone?.()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')!

    const setSize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    setSize()
    window.addEventListener('resize', setSize)

    const count   = intensity === 'full' ? 200 : 80
    const originX = canvas.width / 2
    const originY = canvas.height * (intensity === 'full' ? 0.45 : 0.55)

    const particles: Particle[] = Array.from({ length: count }, () => ({
      x:        originX + (Math.random() - 0.5) * (intensity === 'full' ? 300 : 100),
      y:        originY,
      vx:       (Math.random() - 0.5) * (intensity === 'full' ? 16 : 8),
      vy:       -(Math.random() * (intensity === 'full' ? 22 : 14) + 4),
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      color:    COLORS[Math.floor(Math.random() * COLORS.length)],
      w:        5 + Math.random() * 9,
      h:        4 + Math.random() * 6,
      life:     0.8 + Math.random() * 0.2,
    }))

    let raf: number

    function tick() {
      if (!canvas) return
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      let allDead = true

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.45
        p.vx *= 0.989; p.rotation += p.rotSpeed; p.life -= 0.007
        if (p.life <= 0) continue
        allDead = false
        ctx2d.save()
        ctx2d.translate(p.x, p.y)
        ctx2d.rotate(p.rotation)
        ctx2d.globalAlpha = Math.min(p.life * 2.5, 1)
        ctx2d.fillStyle = p.color
        ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx2d.restore()
      }

      if (allDead) { onDone?.(); return }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', setSize) }
  }, [intensity, onDone])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />
}
