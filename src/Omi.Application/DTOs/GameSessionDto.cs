using System.Text.Json.Serialization;
using Omi.Domain.Entities;
using Omi.Domain.Enums;
using Omi.Domain.ValueObjects;

namespace Omi.Application.DTOs;

/// <summary>
/// Wire representation of a GameSession broadcast to all players in a lobby.
/// remainingDeck: excluded — clients must never see undealt cards.
/// Player hands:  excluded — delivered individually via HandDealt messages.
/// </summary>
public record GameSessionDto
{
    [JsonPropertyName("lobbyId")]            public string                 LobbyId            { get; init; } = string.Empty;
    [JsonPropertyName("phase")]              public GamePhase              Phase              { get; init; }
    [JsonPropertyName("players")]            public List<PlayerSummaryDto> Players            { get; init; } = [];
    [JsonPropertyName("currentDealerIndex")] public int                   CurrentDealerIndex { get; init; }
    [JsonPropertyName("currentTurnIndex")]   public int                   CurrentTurnIndex   { get; init; }
    [JsonPropertyName("trumpSuit")]          public Suit?                 TrumpSuit          { get; init; }
    [JsonPropertyName("currentTrick")]       public List<TrickEntry>      CurrentTrick       { get; init; } = [];
    [JsonPropertyName("roundHistory")]       public List<RoundResult>     RoundHistory       { get; init; } = [];
    [JsonPropertyName("teamATricksWon")]     public int                   TeamATricksWon     { get; init; }
    [JsonPropertyName("teamBTricksWon")]     public int                   TeamBTricksWon     { get; init; }
    [JsonPropertyName("teamAMatchPoints")]   public int                   TeamAMatchPoints   { get; init; }
    [JsonPropertyName("teamBMatchPoints")]   public int                   TeamBMatchPoints   { get; init; }
    [JsonPropertyName("carriedPoints")]      public int                   CarriedPoints      { get; init; }

    public static GameSessionDto From(GameSession s) => new()
    {
        LobbyId            = s.LobbyId,
        Phase              = s.Phase,
        Players            = s.Players.Select(PlayerSummaryDto.From).ToList(),
        CurrentDealerIndex = s.CurrentDealerIndex,
        CurrentTurnIndex   = s.CurrentTurnIndex,
        TrumpSuit          = s.TrumpSuit,
        CurrentTrick       = s.CurrentTrick,
        RoundHistory       = s.RoundHistory,
        TeamATricksWon     = s.TeamATricksWon,
        TeamBTricksWon     = s.TeamBTricksWon,
        TeamAMatchPoints   = s.TeamAMatchPoints,
        TeamBMatchPoints   = s.TeamBMatchPoints,
        CarriedPoints      = s.CarriedPoints,
    };
}
