export const SIGNALR_EVENTS = {
  LOBBY_UPDATED:       'LobbyUpdated',
  ROUND_STARTED:       'RoundStarted',
  TRUMP_SELECTED:      'TrumpSelected',
  CARD_PLAYED:         'CardPlayed',
  HAND_DEALT:          'HandDealt',
  GAME_RESUMED:        'GameResumed',
  PLAYER_DISCONNECTED: 'PlayerDisconnected',
  PLAYER_RECONNECTED:  'PlayerReconnected',
  LOBBY_CLOSED:        'LobbyClosed',
  LOBBY_NOT_FOUND:     'LobbyNotFound',
} as const
