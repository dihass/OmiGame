import type { Suit, Rank } from '../types/game'

export const SUIT_SYMBOL: Record<Suit, string> = {
  Hearts:   '♥',
  Diamonds: '♦',
  Clubs:    '♣',
  Spades:   '♠',
}

export const RANK_LABEL: Record<Rank, string> = {
  Seven: '7', Eight: '8', Nine: '9', Ten: '10',
  Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A',
}

export const RANK_ORDER: Record<Rank, number> = {
  Seven: 7, Eight: 8, Nine: 9, Ten: 10, Jack: 11, Queen: 12, King: 13, Ace: 14,
}

export function isRedSuit(suit: Suit) {
  return suit === 'Hearts' || suit === 'Diamonds'
}

export function cardKey(card: { suit: Suit; rank: Rank }) {
  return `${card.suit}-${card.rank}`
}
