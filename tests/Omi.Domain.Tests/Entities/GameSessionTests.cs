using FluentAssertions;
using Omi.Domain.Entities;
using Omi.Domain.Enums;
using Omi.Domain.ValueObjects;

namespace Omi.Domain.Tests.Entities;

public class GameSessionTests
{
    private static GameSession CreateInitializedSession()
    {
        var session = new GameSession { LobbyId = "test-lobby" };
        for (int i = 0; i < 4; i++)
        {
            session.Players.Add(new Player
            {
                PlayerId    = $"p{i}",
                DisplayName = $"Player {i}",
                SeatIndex   = i
            });
        }
        return session;
    }

    // ── Phase gate tests ────────────────────────────────────────────────────

    [Fact]
    public void PlayCard_DuringTrumpSelection_ThrowsInvalidOperation()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        var card = session.Players[0].ReadOnlyHand[0];

        Action act = () => session.PlayCard(0, card);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Cards can only be played during the active Playing phase.");
    }

    [Fact]
    public void SetTrump_DuringPlayingPhase_ThrowsInvalidOperation()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Hearts);

        Action act = () => session.SetTrump(1, Suit.Spades);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Trump suit can only be chosen during the TrumpSelection phase.");
    }

    // ── Security gate tests ─────────────────────────────────────────────────

    [Fact]
    public void SetTrump_ByNonSelectorPlayer_ThrowsUnauthorizedAccess()
    {
        var session = CreateInitializedSession();
        session.CurrentDealerIndex = 0;
        session.StartRound();

        Action act = () => session.SetTrump(2, Suit.Spades);

        act.Should().Throw<UnauthorizedAccessException>()
            .WithMessage("Only the designated selector can choose the trump suit.");
    }

    // ── Dealing tests ───────────────────────────────────────────────────────

    [Fact]
    public void StartRound_WithLessThanFourPlayers_ThrowsInvalidOperation()
    {
        var session = new GameSession();

        Action act = () => session.StartRound();

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void StartRound_DistributesExactlyFourCardsPerPlayer()
    {
        var session = CreateInitializedSession();
        session.StartRound();

        foreach (var player in session.Players)
            player.ReadOnlyHand.Count.Should().Be(4);
    }

    [Fact]
    public void SetTrump_TransitionsPhaseToPlaying()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Hearts);

        session.Phase.Should().Be(GamePhase.Playing);
    }

    [Fact]
    public void SetTrump_DistributesRemainingFourCardsEach_TotalEightPerPlayer()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Diamonds);

        foreach (var player in session.Players)
            player.ReadOnlyHand.Count.Should().Be(8);
    }

    [Fact]
    public void SetTrump_UsesPreservedShuffledDeck_DealsAllThirtyTwoUniqueCards()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Clubs);

        var allCards = session.Players.SelectMany(p => p.Hand).ToList();
        allCards.Should().HaveCount(32);
        allCards.Select(c => (c.Suit, c.Rank)).Distinct().Should().HaveCount(32);
    }

    // ── Card play rule tests ─────────────────────────────────────────────────

    [Fact]
    public void PlayCard_WhenNotPlayersTurn_ThrowsInvalidOperation()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        var card = session.Players[2].ReadOnlyHand[0];

        Action act = () => session.PlayCard(2, card);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("It is not this player's turn.");
    }

    [Fact]
    public void PlayCard_CardNotInHand_ThrowsInvalidOperation()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.Players[1].Hand.Clear();

        Action act = () => session.PlayCard(1, new Card(Suit.Hearts, Rank.Seven));

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Player does not possess this card in their hand.");
    }

    [Fact]
    public void PlayCard_OffSuitWhenLedSuitIsAvailable_ThrowsInvalidOperation()
    {
        var session = CreateInitializedSession();
        session.CurrentDealerIndex = 0;
        session.StartRound();
        session.SetTrump(1, Suit.Hearts);

        session.Players[1].Hand = [new Card(Suit.Spades, Rank.Ace)];
        session.Players[2].Hand = [new Card(Suit.Spades, Rank.Seven), new Card(Suit.Diamonds, Rank.King)];

        session.PlayCard(1, new Card(Suit.Spades, Rank.Ace));

        Action act = () => session.PlayCard(2, new Card(Suit.Diamonds, Rank.King));

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Suit-following constraint broken. You must play the led suit.");
    }

    // ── Trick resolution tests ───────────────────────────────────────────────

    [Fact]
    public void ResolveTrick_HighestLedSuitCard_WinsWhenNoTrumpPlayed()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Hearts);

        session.Players[1].Hand = [new Card(Suit.Spades, Rank.Ten)];
        session.Players[2].Hand = [new Card(Suit.Spades, Rank.Jack)];
        session.Players[3].Hand = [new Card(Suit.Spades, Rank.Seven)];
        session.Players[0].Hand = [new Card(Suit.Spades, Rank.Eight)];

        session.PlayCard(1, new Card(Suit.Spades, Rank.Ten));
        session.PlayCard(2, new Card(Suit.Spades, Rank.Jack));
        session.PlayCard(3, new Card(Suit.Spades, Rank.Seven));
        session.PlayCard(0, new Card(Suit.Spades, Rank.Eight));

        session.CurrentTurnIndex.Should().Be(2);
    }

    [Fact]
    public void ResolveTrick_TrumpCutsHighLedSuit_TrumpWins()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Hearts);

        session.Players[1].Hand = [new Card(Suit.Spades, Rank.Ace)];
        session.Players[2].Hand = [new Card(Suit.Hearts, Rank.Seven)];
        session.Players[3].Hand = [new Card(Suit.Spades, Rank.Eight)];
        session.Players[0].Hand = [new Card(Suit.Spades, Rank.Nine)];

        session.PlayCard(1, new Card(Suit.Spades, Rank.Ace));
        session.PlayCard(2, new Card(Suit.Hearts, Rank.Seven));
        session.PlayCard(3, new Card(Suit.Spades, Rank.Eight));
        session.PlayCard(0, new Card(Suit.Spades, Rank.Nine));

        session.CurrentTurnIndex.Should().Be(2);
    }

    [Fact]
    public void ResolveTrick_HighestTrumpCard_WinsWhenMultipleTrumpsPlayed()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Hearts);

        session.Players[1].Hand = [new Card(Suit.Spades, Rank.Ace)];
        session.Players[2].Hand = [new Card(Suit.Hearts, Rank.Seven)];
        session.Players[3].Hand = [new Card(Suit.Hearts, Rank.King)];
        session.Players[0].Hand = [new Card(Suit.Spades, Rank.Nine)];

        session.PlayCard(1, new Card(Suit.Spades, Rank.Ace));
        session.PlayCard(2, new Card(Suit.Hearts, Rank.Seven));
        session.PlayCard(3, new Card(Suit.Hearts, Rank.King));
        session.PlayCard(0, new Card(Suit.Spades, Rank.Nine));

        session.CurrentTurnIndex.Should().Be(3);
    }

    // ── Scoring tests ────────────────────────────────────────────────────────

    [Fact]
    public void Scoring_FourFourDraw_IncrementsCarriedPointsByOne()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Clubs);

        session.TeamATricksWon = 4;
        session.TeamBTricksWon = 3;

        session.Players[1].Hand = [new Card(Suit.Spades, Rank.Ace)];
        session.Players[2].Hand = [new Card(Suit.Spades, Rank.King)];
        session.Players[3].Hand = [new Card(Suit.Spades, Rank.Queen)];
        session.Players[0].Hand = [new Card(Suit.Spades, Rank.Jack)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Spades, Rank.Ace));
        session.PlayCard(2, new Card(Suit.Spades, Rank.King));
        session.PlayCard(3, new Card(Suit.Spades, Rank.Queen));
        session.PlayCard(0, new Card(Suit.Spades, Rank.Jack));

        session.CarriedPoints.Should().Be(1);
        session.TeamAMatchPoints.Should().Be(0);
        session.TeamBMatchPoints.Should().Be(0);
        session.Phase.Should().Be(GamePhase.DealingPhase1);
    }

    [Fact]
    public void Scoring_CarriedPoints_AddedToWinnerOfNextNonDrawRound()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.CarriedPoints = 2;

        session.TeamATricksWon = 7;
        session.TeamBTricksWon = 0;

        session.Players[1].Hand = [new Card(Suit.Clubs, Rank.Seven)];
        session.Players[2].Hand = [new Card(Suit.Clubs, Rank.Eight)];
        session.Players[3].Hand = [new Card(Suit.Clubs, Rank.Nine)];
        session.Players[0].Hand = [new Card(Suit.Clubs, Rank.King)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Clubs, Rank.Seven));
        session.PlayCard(2, new Card(Suit.Clubs, Rank.Eight));
        session.PlayCard(3, new Card(Suit.Clubs, Rank.Nine));
        session.PlayCard(0, new Card(Suit.Clubs, Rank.King));

        session.TeamAMatchPoints.Should().Be(5);
        session.CarriedPoints.Should().Be(0);
    }

    [Fact]
    public void Scoring_FiveTricks_AwardsOneMatchPoint()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.TeamATricksWon = 4;
        session.TeamBTricksWon = 3;

        session.Players[1].Hand = [new Card(Suit.Clubs, Rank.Seven)];
        session.Players[2].Hand = [new Card(Suit.Clubs, Rank.Ace)];
        session.Players[3].Hand = [new Card(Suit.Clubs, Rank.Eight)];
        session.Players[0].Hand = [new Card(Suit.Clubs, Rank.Nine)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Clubs, Rank.Seven));
        session.PlayCard(2, new Card(Suit.Clubs, Rank.Ace));
        session.PlayCard(3, new Card(Suit.Clubs, Rank.Eight));
        session.PlayCard(0, new Card(Suit.Clubs, Rank.Nine));

        session.TeamAMatchPoints.Should().Be(1);
    }

    [Fact]
    public void Scoring_SevenTricksKapaa_AwardsTwoMatchPoints()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.TeamATricksWon = 6;
        session.TeamBTricksWon = 1;

        session.Players[1].Hand = [new Card(Suit.Clubs, Rank.Seven)];
        session.Players[2].Hand = [new Card(Suit.Clubs, Rank.Ace)];
        session.Players[3].Hand = [new Card(Suit.Clubs, Rank.Eight)];
        session.Players[0].Hand = [new Card(Suit.Clubs, Rank.Nine)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Clubs, Rank.Seven));
        session.PlayCard(2, new Card(Suit.Clubs, Rank.Ace));
        session.PlayCard(3, new Card(Suit.Clubs, Rank.Eight));
        session.PlayCard(0, new Card(Suit.Clubs, Rank.Nine));

        session.TeamAMatchPoints.Should().Be(2);
    }

    [Fact]
    public void Scoring_EightTricksKaberi_AwardsThreeMatchPoints()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.TeamATricksWon = 7;
        session.TeamBTricksWon = 0;

        session.Players[1].Hand = [new Card(Suit.Clubs, Rank.Seven)];
        session.Players[2].Hand = [new Card(Suit.Clubs, Rank.Ace)];
        session.Players[3].Hand = [new Card(Suit.Clubs, Rank.Eight)];
        session.Players[0].Hand = [new Card(Suit.Clubs, Rank.Nine)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Clubs, Rank.Seven));
        session.PlayCard(2, new Card(Suit.Clubs, Rank.Ace));
        session.PlayCard(3, new Card(Suit.Clubs, Rank.Eight));
        session.PlayCard(0, new Card(Suit.Clubs, Rank.Nine));

        session.TeamAMatchPoints.Should().Be(3);
    }

    [Fact]
    public void Scoring_ReachingTenPoints_TransitionsToMatchCompleted()
    {
        var session = CreateInitializedSession();
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.TeamAMatchPoints = 9;
        session.TeamATricksWon   = 7;
        session.TeamBTricksWon   = 0;

        session.Players[1].Hand = [new Card(Suit.Clubs, Rank.Seven)];
        session.Players[2].Hand = [new Card(Suit.Clubs, Rank.Ace)];
        session.Players[3].Hand = [new Card(Suit.Clubs, Rank.Eight)];
        session.Players[0].Hand = [new Card(Suit.Clubs, Rank.Nine)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Clubs, Rank.Seven));
        session.PlayCard(2, new Card(Suit.Clubs, Rank.Ace));
        session.PlayCard(3, new Card(Suit.Clubs, Rank.Eight));
        session.PlayCard(0, new Card(Suit.Clubs, Rank.Nine));

        session.Phase.Should().Be(GamePhase.MatchCompleted);
        session.TeamAMatchPoints.Should().Be(12);
    }

    [Fact]
    public void Scoring_DealerRotatesClockwiseAfterEachRound()
    {
        var session = CreateInitializedSession();
        session.CurrentDealerIndex = 0;
        session.StartRound();
        session.SetTrump(1, Suit.Spades);
        session.TeamATricksWon = 7;
        session.TeamBTricksWon = 0;

        session.Players[1].Hand = [new Card(Suit.Clubs, Rank.Seven)];
        session.Players[2].Hand = [new Card(Suit.Clubs, Rank.Ace)];
        session.Players[3].Hand = [new Card(Suit.Clubs, Rank.Eight)];
        session.Players[0].Hand = [new Card(Suit.Clubs, Rank.Nine)];
        session.CurrentTurnIndex = 1;

        session.PlayCard(1, new Card(Suit.Clubs, Rank.Seven));
        session.PlayCard(2, new Card(Suit.Clubs, Rank.Ace));
        session.PlayCard(3, new Card(Suit.Clubs, Rank.Eight));
        session.PlayCard(0, new Card(Suit.Clubs, Rank.Nine));

        session.CurrentDealerIndex.Should().Be(1);
    }
}
