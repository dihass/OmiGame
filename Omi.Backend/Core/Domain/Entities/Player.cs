using System.Text.Json.Serialization;
using Omi.Backend.Core.Domain.ValueObjects;

namespace Omi.Backend.Core.Domain.Entities;

public class Player
{
    [JsonPropertyName("playerId")]
    public string PlayerId { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    [JsonPropertyName("seatIndex")]
    public int SeatIndex { get; set; } // Must be 0, 1, 2, or 3

    [JsonPropertyName("isDisconnected")]
    public bool IsDisconnected { get; set; } = false;

    [JsonPropertyName("hand")]
    public List<Card> Hand { get; set; } = new();

    [JsonIgnore]
    public IReadOnlyList<Card> ReadOnlyHand => Hand.AsReadOnly();

    public void AddCard(Card card)
    {
        Hand.Add(card);
    }

    public bool RemoveCard(Card card)
    {
        return Hand.Remove(card);
    }
}