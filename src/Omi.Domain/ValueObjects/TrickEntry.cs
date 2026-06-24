namespace Omi.Domain.ValueObjects;

public record TrickEntry
{
    public int  SeatIndex { get; init; }
    public Card Card      { get; init; } = new();

    public TrickEntry() { }
    public TrickEntry(int seatIndex, Card card) { SeatIndex = seatIndex; Card = card; }
}
