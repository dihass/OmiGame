using System.Text.Json.Serialization;
using Omi.Domain.Entities;

namespace Omi.Application.DTOs;

/// <summary>
/// Public view of a player broadcast to all participants.
/// Hand cards are intentionally excluded — they are delivered
/// only to the owning player via HandDealt personal messages.
/// HandCount is public knowledge in Omi (everyone can count played cards).
/// </summary>
public record PlayerSummaryDto
{
    [JsonPropertyName("playerId")]            public string PlayerId            { get; init; } = string.Empty;
    [JsonPropertyName("displayName")]         public string DisplayName         { get; init; } = string.Empty;
    [JsonPropertyName("seatIndex")]           public int    SeatIndex           { get; init; }
    [JsonPropertyName("isDisconnected")]      public bool   IsDisconnected      { get; init; }
    [JsonPropertyName("handCount")]           public int    HandCount           { get; init; }

    public static PlayerSummaryDto From(Player p) => new()
    {
        PlayerId       = p.PlayerId,
        DisplayName    = p.DisplayName,
        SeatIndex      = p.SeatIndex,
        IsDisconnected = p.IsDisconnected,
        HandCount      = p.Hand.Count
    };
}
