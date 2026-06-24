using Omi.Domain.Enums;
using Omi.Domain.ValueObjects;

namespace Omi.Domain.Entities;

public class GameSession
{
    public string            LobbyId            { get; set; } = string.Empty;
    public GamePhase         Phase              { get; set; } = GamePhase.Lobby;
    public List<Player>      Players            { get; set; } = new();
    public int               CurrentDealerIndex { get; set; }
    public int               CurrentTurnIndex   { get; set; }
    public Suit?             TrumpSuit          { get; set; }
    public List<Card>        RemainingDeck      { get; set; } = [];
    public List<RoundResult> RoundHistory       { get; set; } = [];
    public List<TrickEntry>  CurrentTrick       { get; set; } = [];
    public int               TeamATricksWon     { get; set; }
    public int               TeamBTricksWon     { get; set; }
    public int               TeamAMatchPoints   { get; set; }
    public int               TeamBMatchPoints   { get; set; }
    public int               CarriedPoints      { get; set; }

    public void StartRound()
    {
        if (Players.Count != 4)
            throw new InvalidOperationException("Exactly 4 players are required to start an Omi round.");

        foreach (var player in Players) player.Hand.Clear();
        CurrentTrick.Clear();
        TeamATricksWon = 0;
        TeamBTricksWon = 0;
        TrumpSuit      = null;

        var deck = new Deck();
        deck.Shuffle();

        int recipient = (CurrentDealerIndex + 1) % 4;
        for (int i = 0; i < 16; i++)
        {
            Players[recipient].AddCard(deck.Draw());
            recipient = (recipient + 1) % 4;
        }

        RemainingDeck = deck.TakeRemainingCards();
        Phase         = GamePhase.TrumpSelection;
    }

    public void SetTrump(int playerSeatIndex, Suit chosenSuit)
    {
        if (Phase != GamePhase.TrumpSelection)
            throw new InvalidOperationException("Trump suit can only be chosen during the TrumpSelection phase.");

        int expectedSelector = (CurrentDealerIndex + 1) % 4;
        if (playerSeatIndex != expectedSelector)
            throw new UnauthorizedAccessException("Only the designated selector can choose the trump suit.");

        TrumpSuit = chosenSuit;
        Phase     = GamePhase.DealingPhase2;

        int recipient = (CurrentDealerIndex + 1) % 4;
        for (int i = 0; i < 16; i++)
        {
            Players[recipient].AddCard(RemainingDeck[0]);
            RemainingDeck.RemoveAt(0);
            recipient = (recipient + 1) % 4;
        }

        RemainingDeck.Clear();
        Phase            = GamePhase.Playing;
        CurrentTurnIndex = (CurrentDealerIndex + 1) % 4;
    }

    public void PlayCard(int playerSeatIndex, Card card)
    {
        if (Phase != GamePhase.Playing)
            throw new InvalidOperationException("Cards can only be played during the active Playing phase.");

        if (playerSeatIndex != CurrentTurnIndex)
            throw new InvalidOperationException("It is not this player's turn.");

        Player player = Players[playerSeatIndex];
        Card? matchingCard = player.Hand.FirstOrDefault(c => c.Suit == card.Suit && c.Rank == card.Rank)
            ?? throw new InvalidOperationException("Player does not possess this card in their hand.");

        if (CurrentTrick.Count > 0)
        {
            Suit ledSuit = CurrentTrick[0].Card.Suit;
            if (card.Suit != ledSuit && player.Hand.Any(c => c.Suit == ledSuit))
                throw new InvalidOperationException("Suit-following constraint broken. You must play the led suit.");
        }

        player.RemoveCard(matchingCard);
        CurrentTrick.Add(new TrickEntry(playerSeatIndex, matchingCard));

        if (CurrentTrick.Count < 4)
            CurrentTurnIndex = (CurrentTurnIndex + 1) % 4;
        else
            ResolveTrick();
    }

    private void ResolveTrick()
    {
        Suit ledSuit          = CurrentTrick[0].Card.Suit;
        int  winningSeatIndex = CurrentTrick[0].SeatIndex;
        Card winningCard      = CurrentTrick[0].Card;

        for (int i = 1; i < 4; i++)
        {
            var  current       = CurrentTrick[i];
            bool currentTrump  = TrumpSuit.HasValue && current.Card.Suit == TrumpSuit.Value;
            bool winnerTrump   = TrumpSuit.HasValue && winningCard.Suit  == TrumpSuit.Value;

            if (currentTrump && !winnerTrump)
            { winningSeatIndex = current.SeatIndex; winningCard = current.Card; }
            else if (currentTrump && winnerTrump && current.Card.Rank > winningCard.Rank)
            { winningSeatIndex = current.SeatIndex; winningCard = current.Card; }
            else if (!currentTrump && !winnerTrump && current.Card.Suit == ledSuit && current.Card.Rank > winningCard.Rank)
            { winningSeatIndex = current.SeatIndex; winningCard = current.Card; }
        }

        if (winningSeatIndex % 2 == 0) TeamATricksWon++;
        else                            TeamBTricksWon++;

        CurrentTrick.Clear();
        CurrentTurnIndex = winningSeatIndex;

        if (TeamATricksWon + TeamBTricksWon == 8)
        {
            Phase = GamePhase.RoundSummary;
            EvaluateRoundScores();
        }
    }

    private void EvaluateRoundScores()
    {
        int teamAEarned = 0, teamBEarned = 0, carryAdded = 0;

        if (TeamATricksWon >= 5)
        {
            int base_ = TeamATricksWon switch { 5 or 6 => 1, 7 => 2, 8 => 3, _ => 0 };
            teamAEarned = base_ + CarriedPoints;
            TeamAMatchPoints += teamAEarned;
            CarriedPoints = 0;
        }
        else if (TeamBTricksWon >= 5)
        {
            int base_ = TeamBTricksWon switch { 5 or 6 => 1, 7 => 2, 8 => 3, _ => 0 };
            teamBEarned = base_ + CarriedPoints;
            TeamBMatchPoints += teamBEarned;
            CarriedPoints = 0;
        }
        else
        {
            carryAdded = 1;
            CarriedPoints += 1;
        }

        RoundHistory.Add(new RoundResult(
            RoundHistory.Count + 1,
            TeamATricksWon, TeamBTricksWon,
            teamAEarned, teamBEarned,
            carryAdded, TrumpSuit));

        if (TeamAMatchPoints >= 10 || TeamBMatchPoints >= 10)
            Phase = GamePhase.MatchCompleted;
        else
        {
            CurrentDealerIndex = (CurrentDealerIndex + 1) % 4;
            Phase = GamePhase.DealingPhase1;
        }
    }
}
