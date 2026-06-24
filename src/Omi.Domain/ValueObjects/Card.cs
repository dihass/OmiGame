using Omi.Domain.Enums;

namespace Omi.Domain.ValueObjects;

public record Card
{
    public Suit Suit { get; init; }
    public Rank Rank { get; init; }

    public Card() { }
    public Card(Suit suit, Rank rank) { Suit = suit; Rank = rank; }
}
