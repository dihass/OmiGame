using System.Text.Json.Serialization;
using Omi.Backend.Core.Domain.Enums;

namespace Omi.Backend.Core.Domain.ValueObjects;

public record Card
{
    [JsonPropertyName("suit")]
    public Suit Suit { get; init; }

    [JsonPropertyName("rank")]
    public Rank Rank { get; init; }

    // Required parameterless constructor for seamless JSON deserialization
    public Card() { }

    public Card(Suit suit, Rank rank)
    {
        Suit = suit;
        Rank = rank;
    }
}