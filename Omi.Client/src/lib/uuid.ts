// crypto.randomUUID is missing on iOS Safari < 15.4 / older Android browsers.
// We still want a cryptographically random UUID v4 — falling back to Math.random
// would let two simultaneous joiners collide (or be predictable to an attacker).
export function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40   // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80   // variant 10xx
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }
  throw new Error('Your browser is missing crypto.getRandomValues — please update it.')
}
