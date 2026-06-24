// ── File-based meme/sfx clips ─────────────────────────────────────────────────
// All clips live in public/sounds/Sound effects/
// Any missing file fails silently — nothing breaks.

const SFX = '/sounds/Sound effects/'
const _cache: Record<string, HTMLAudioElement> = {}

function clip(file: string, vol = 0.85) {
  let el = _cache[file]
  if (!el) {
    el = new Audio(SFX + file)
    el.preload = 'auto'
    _cache[file] = el
  }
  el.volume = vol
  el.currentTime = 0
  void el.play().catch(() => { /* file missing — silently skip */ })
}

// ── Volume hierarchy (frequency-inverse rule) ────────────────────────────────
// The more often a sound fires, the quieter it must be to avoid fatigue.
//   Per-card / per-action  →  0.06 – 0.14
//   Per-trick              →  0.10 – 0.15
//   Per-round              →  0.16 – 0.22
//   Per-match / one-shot   →  0.18 – 0.25

/** Soft double-ping when a player joins the lobby — like Discord/Skribbl join chime */
export function soundPlayerJoin() {
  const c = ctx()
  const t = c.currentTime
  const master = gain(c.destination, 0.14)
  const e1 = envelope(master, 0.8, 0.01, 0.25, t)
  oscillator('sine', 880, t, t + 0.3, e1)
  const e2 = envelope(master, 0.6, 0.01, 0.2, t + 0.12)
  oscillator('sine', 1046, t + 0.12, t + 0.35, e2)
}

/** Rising 3-note bell fanfare when the first round starts — like classic card game start */
export function soundGameStart() {
  const c = ctx()
  const t = c.currentTime
  const master = gain(c.destination, 0.18)
  const notes = [523, 659, 784] // C5, E5, G5
  notes.forEach((freq, i) => {
    const e = envelope(master, 0.8, 0.01, 0.38, t + i * 0.14)
    oscillator('sine', freq, t + i * 0.14, t + i * 0.14 + 0.42, e)
    const e2 = envelope(master, 0.25, 0.01, 0.2, t + i * 0.14)
    oscillator('sine', freq * 2, t + i * 0.14, t + i * 0.14 + 0.25, e2)
  })
}

/** Among Us role-reveal sting — once per round at trump selection */
export const soundTrumpRevealMeme = () => clip('among-us-role-reveal-sound.mp3', 0.18)

/** "AIYO!" — fires on illegal play AND on the 15-second slow-player timer */
export const soundAiyo            = () => clip('aiyo-hamienenawa.mp3', 0.14)

/** Spinning cat "oiia" — every other trick win; must stay subtle */
export const soundOiia            = () => clip('oiia-blue.mp3', 0.12)

/** Faaah — every other opponent trick win; must stay subtle */
export const soundFaaahClip       = () => clip('faaah.mp3', 0.12)

/** Anime WOW — rare Kaberi (8-trick sweep) */
export const soundAnimeWow        = () => clip('anime-wow-sound-effect-mp3cut.mp3', 0.20)

/** TBH yippee — once per round win */
export const soundYippee          = () => clip('yippee-tbh.mp3', 0.18)

/** Baby laughing — delayed follow-up to Kapaa / Kaberi */
export const soundBabyLaugh       = () => clip('baby-laughing-meme.mp3', 0.14)

/** EMOTIONAL DAMAGE — once per round loss */
export const soundEmotionalDamage = () => clip('emotional-damage-meme.mp3', 0.18)

/** "Oh hell nah" — rare (opponent Kaberi only) */
export const soundOhHellNah       = () => clip('omg-bruh-oh-hell-nah.mp3', 0.20)

/** Cat laughing — once per draw round */
export const soundCatLaugh        = () => clip('cat-laugh-meme-1.mp3', 0.16)

/** End-credits meme — once at match complete */
export const soundMatchCredits    = () => clip('meme-de-creditos-finales.mp3', 0.18)

/** PH intro — match win, once per session */
export const soundMatchWinMeme    = () => clip('ph-intro-x-see-you-again.mp3', 0.22)

/** Sad meow — match loss, once per session */
export const soundSadMeow         = () => clip('sad-meow-song.mp3', 0.18)

// ── Synthesized sound effects — Web Audio API (no files) ─────────────────────
// These are used for high-frequency per-card-snap events where file sounds
// would become annoying (card play, deal flutter, UI click, your-turn ping,
// per-trick synthesized arpeggio fallback).

let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') void _ctx.resume()
  return _ctx
}

function gain(output: AudioNode, volume: number) {
  const g = ctx().createGain()
  g.gain.value = volume
  g.connect(output)
  return g
}

function envelope(
  output: AudioNode,
  peak: number,
  attackTime: number,
  decayTime: number,
  startTime: number,
) {
  const g = ctx().createGain()
  g.gain.setValueAtTime(0.0001, startTime)
  g.gain.linearRampToValueAtTime(peak, startTime + attackTime)
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + attackTime + decayTime)
  g.connect(output)
  return g
}

function oscillator(
  type: OscillatorType,
  freq: number,
  start: number,
  stop: number,
  output: AudioNode,
) {
  const o = ctx().createOscillator()
  o.type = type
  o.frequency.value = freq
  o.connect(output)
  o.start(start)
  o.stop(stop)
  return o
}

function noiseBuffer(durationSec: number) {
  const c = ctx()
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * durationSec), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/** Short crisp snap when a card is played — very quiet, fires on every play */
export function soundCardSnap() {
  const c = ctx()
  const dest = c.destination
  const t = c.currentTime
  const master = gain(dest, 0.10)
  const noiseSrc = c.createBufferSource()
  noiseSrc.buffer = noiseBuffer(0.04)
  const noiseFilter = c.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 2400
  noiseFilter.Q.value = 1.2
  const noiseEnv = envelope(master, 1, 0, 0.04, t)
  noiseSrc.connect(noiseFilter)
  noiseFilter.connect(noiseEnv)
  noiseSrc.start(t)
  const oEnv = envelope(master, 0.5, 0.002, 0.1, t)
  oscillator('sine', 540, t, t + 0.11, oEnv)
}

/** Soft bell ping on your turn — gentle notification */
export function soundYourTurn() {
  const c = ctx()
  const t = c.currentTime
  const master = gain(c.destination, 0.14)
  const env1 = envelope(master, 1, 0.01, 0.45, t)
  oscillator('sine', 880, t, t + 0.5, env1)
  const env2 = envelope(master, 0.4, 0.01, 0.3, t)
  oscillator('sine', 1760, t, t + 0.35, env2)
}

/** Soft flutter for each card dealt — fires many times in a row during deal */
export function soundDealCard() {
  const c = ctx()
  const t = c.currentTime
  const master = gain(c.destination, 0.06)
  const e = envelope(master, 0.6, 0.001, 0.07, t)
  oscillator('sine', 680, t, t + 0.08, e)
}

/** Subtle UI click for buttons */
export function soundButtonClick() {
  const c = ctx()
  const t = c.currentTime
  const master = gain(c.destination, 0.08)
  const e = envelope(master, 0.5, 0, 0.06, t)
  oscillator('sine', 740, t, t + 0.07, e)
}
