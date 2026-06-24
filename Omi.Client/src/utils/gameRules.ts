import type { Card, Suit, TrickEntry } from '../types/game'
import { RANK_ORDER } from './cardHelpers'

export function isLegalPlay(card: Card, hand: Card[], trick: TrickEntry[]): boolean {
  if (trick.length === 0) return true
  const ledSuit = trick[0].card.suit
  if (card.suit === ledSuit) return true
  return !hand.some(c => c.suit === ledSuit)
}

// Returns the seatIndex of the trick winner given 4 played cards and the trump suit.
export function trickWinnerSeat(trick: TrickEntry[], trumpSuit: Suit | null): number {
  const ledSuit = trick[0].card.suit
  let winner = trick[0]
  for (const entry of trick.slice(1)) {
    const c = entry.card
    const w = winner.card
    if (c.suit === trumpSuit && w.suit !== trumpSuit) {
      winner = entry
    } else if (c.suit === trumpSuit && w.suit === trumpSuit) {
      if (RANK_ORDER[c.rank] > RANK_ORDER[w.rank]) winner = entry
    } else if (c.suit === ledSuit && w.suit !== trumpSuit && w.suit === ledSuit) {
      if (RANK_ORDER[c.rank] > RANK_ORDER[w.rank]) winner = entry
    }
  }
  return winner.seatIndex
}
