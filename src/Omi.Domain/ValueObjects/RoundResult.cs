using Omi.Domain.Enums;

namespace Omi.Domain.ValueObjects;

public record RoundResult
{
    public int   RoundNumber       { get; init; }
    public int   TeamATricks       { get; init; }
    public int   TeamBTricks       { get; init; }
    public int   TeamAPointsEarned { get; init; }
    public int   TeamBPointsEarned { get; init; }
    public int   CarryAdded        { get; init; }
    public Suit? TrumpSuit         { get; init; }

    public RoundResult() { }

    public RoundResult(
        int roundNumber, int teamATricks, int teamBTricks,
        int teamAPointsEarned, int teamBPointsEarned, int carryAdded, Suit? trumpSuit)
    {
        RoundNumber       = roundNumber;
        TeamATricks       = teamATricks;
        TeamBTricks       = teamBTricks;
        TeamAPointsEarned = teamAPointsEarned;
        TeamBPointsEarned = teamBPointsEarned;
        CarryAdded        = carryAdded;
        TrumpSuit         = trumpSuit;
    }
}
