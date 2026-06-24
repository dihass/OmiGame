export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades'
export type Rank = 'Seven' | 'Eight' | 'Nine' | 'Ten' | 'Jack' | 'Queen' | 'King' | 'Ace'
export type GamePhase =
  | 'Lobby'
  | 'DealingPhase1'
  | 'TrumpSelection'
  | 'DealingPhase2'
  | 'Playing'
  | 'RoundSummary'
  | 'MatchCompleted'

export interface Card {
  suit: Suit
  rank: Rank
}

export interface TrickEntry {
  seatIndex: number
  card: Card
}

export interface Player {
  playerId: string
  displayName: string
  seatIndex: number
  isDisconnected: boolean
  disconnectTimestamp: string | null
  hand: Card[]
}

export interface RoundResult {
  roundNumber: number
  teamATricks: number
  teamBTricks: number
  teamAPointsEarned: number
  teamBPointsEarned: number
  carryAdded: number
  trumpSuit: Suit | null
}

export interface GameSession {
  lobbyId: string
  phase: GamePhase
  players: Player[]
  currentDealerIndex: number
  currentTurnIndex: number
  trumpSuit: Suit | null
  currentTrick: TrickEntry[]
  roundHistory: RoundResult[]
  teamATricksWon: number
  teamBTricksWon: number
  teamAMatchPoints: number
  teamBMatchPoints: number
  carriedPoints: number
}
