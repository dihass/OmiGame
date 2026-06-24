using System.Text.Json.Serialization;
using Omi.Domain.ValueObjects;

namespace Omi.Domain.Entities;

public class Player
{
    public string    PlayerId            { get; set; } = string.Empty;
    public string    DisplayName         { get; set; } = string.Empty;
    public int       SeatIndex           { get; set; }
    public bool      IsDisconnected      { get; set; }
    public DateTime? DisconnectTimestamp { get; set; }
    public List<Card> Hand               { get; set; } = new();

    [JsonIgnore]
    public IReadOnlyList<Card> ReadOnlyHand => Hand.AsReadOnly();

    public void AddCard(Card card) => Hand.Add(card);
    public bool RemoveCard(Card card) => Hand.Remove(card);
}
