using System.Text.Json.Serialization;
using Omi.Backend.Core.Domain.Enums;
using Omi.Backend.Core.Domain.ValueObjects;

namespace Omi.Backend.Core.Domain.Entities;

public class GameSession
{
    [JsonPropertyName("lobbyId")]
    public string LobbyId { get; set; } = string.Empty;

    [JsonPropertyName("phase")]
    public GamePhase Phase { get; set; } = GamePhase.Lobby;

    [JsonPropertyName("players")]
    public List<Player> Players { get; set; } = new();

    [JsonPropertyName("currentDealerIndex")]
    public int CurrentDealerIndex { get; set; } = 0;

    [JsonPropertyName("currentTurnIndex")]
    public int CurrentTurnIndex { get; set; } = 0;

    [JsonPropertyName("trumpSuit")]
    public Suit? TrumpSuit { get; set; }

    [JsonPropertyName("currentTrick")]
    public List<KeyValuePair<int, Card>> CurrentTrick { get; set; } = new(); // Key: SeatIndex, Value: Played Card

    [JsonPropertyName("teamATricksWon")]
    public int TeamATricksWon { get; set; } = 0;

    [JsonPropertyName("teamBTricksWon")]
    public int TeamBTricksWon { get; set; } = 0;

    [JsonPropertyName("teamAMatchPoints")]
    public int TeamAMatchPoints { get; set; } = 0;

    [JsonPropertyName("teamBMatchPoints")]
    public int TeamBMatchPoints { get; set; } = 0;

    [JsonPropertyName("carriedPoints")]
    public int CarriedPoints { get; set; } = 0;

    /// <summary>
    /// Executes Dealing Phase 1: Shuffles the deck and distributes exactly 4 cards to everyone.
    /// </summary>
    public void StartRound()
    {
        if (Players.Count != 4)
        {
            throw new InvalidOperationException("Exactly 4 players are required to start an Omi round.");
        }

        Phase = GamePhase.DealingPhase1;
        
        Deck deck = new Deck();
        deck.Shuffle();

        // Clear previous round tracking variables
        CurrentTrick.Clear();
        TeamATricksWon = 0;
        TeamBTricksWon = 0;
        TrumpSuit = null;
        foreach (var player in Players)
        {
            player.Hand.Clear();
        }

        // Deal 4 cards clockwise starting from (DealerIndex + 1) % 4
        int currentRecipient = (CurrentDealerIndex + 1) % 4;
        for (int i = 0; i < 16; i++)
        {
            Players[currentRecipient].AddCard(deck.Draw());
            currentRecipient = (currentRecipient + 1) % 4;
        }

        // Advance automatically to TrumpSelection
        Phase = GamePhase.TrumpSelection;
    }

    /// <summary>
    /// Set the trump suit. Only allowed by the selector ((DealerIndex + 1) % 4).
    /// </summary>
    public void SetTrump(int playerSeatIndex, Suit chosenSuit)
    {
        if (Phase != GamePhase.TrumpSelection)
        {
            throw new InvalidOperationException("Trump suit can only be chosen during the TrumpSelection phase.");
        }

        int expectedSelector = (CurrentDealerIndex + 1) % 4;
        if (playerSeatIndex != expectedSelector)
        {
            throw new UnauthorizedAccessException("Only the designated selector can choose the trump suit.");
        }

        TrumpSuit = chosenSuit;
        Phase = GamePhase.DealingPhase2;

        // Finish Stage 2 deal: Distribute remaining cards up to 8 per player
        Deck deck = new Deck();
        // Remove cards already held by players from our temporary engine deck to mimic correct linear sequence
        foreach (var player in Players)
        {
            foreach (var card in player.Hand)
            {
                // We draw cards that aren't already out
                // In real physical play, this is dealt from the remaining split sub-deck
            }
        }

        // To ensure consistency, generate remaining specific cards for execution
        List<Card> allCards = new();
        foreach (Suit s in Enum.GetValues<Suit>())
        {
            foreach (Rank r in Enum.GetValues<Rank>())
            {
                allCards.Add(new Card(s, r));
            }
        }

        foreach (var player in Players)
        {
            foreach (var heldCard in player.Hand)
            {
                allCards.RemoveAll(c => c.Suit == heldCard.Suit && c.Rank == heldCard.Rank);
            }
        }

        // Shuffle remainder
        Random rand = new Random();
        int n = allCards.Count;
        while (n > 1)
        {
            n--;
            int k = rand.Next(n + 1);
            (allCards[k], allCards[n]) = (allCards[n], allCards[k]);
        }

        // Deal remaining 4 cards each clockwise
        int currentDealTarget = (CurrentDealerIndex + 1) % 4;
        for (int i = 0; i < 16; i++)
        {
            Players[currentDealTarget].AddCard(allCards[0]);
            allCards.RemoveAt(0);
            currentDealTarget = (currentDealTarget + 1) % 4;
        }

        Phase = GamePhase.Playing;
        CurrentTurnIndex = (CurrentDealerIndex + 1) % 4; // Left of dealer leads trick 1
    }

    /// <summary>
    /// Core execution rule for playing a card. Enforces state transitions and suit-following mechanics.
    /// </summary>
    public void PlayCard(int playerSeatIndex, Card card)
    {
        if (Phase != GamePhase.Playing)
        {
            throw new InvalidOperationException("Cards can only be played during the active Playing phase.");
        }

        if (playerSeatIndex != CurrentTurnIndex)
        {
            throw new InvalidOperationException("It is not this player's turn.");
        }

        Player player = Players[playerSeatIndex];
        Card? matchingCard = player.Hand.FirstOrDefault(c => c.Suit == card.Suit && c.Rank == card.Rank);
        if (matchingCard == null)
        {
            throw new InvalidOperationException("Player does not possess this card in their hand.");
        }

        // Enforce the Suit-Following Constraint
        if (CurrentTrick.Count > 0)
        {
            Suit ledSuit = CurrentTrick[0].Value.Suit;
            if (card.Suit != ledSuit && player.Hand.Any(c => c.Suit == ledSuit))
            {
                throw new InvalidOperationException("Suit-following constraint broken. You must play the led suit.");
            }
        }

        // Play card
        player.RemoveCard(matchingCard);
        CurrentTrick.Add(new KeyValuePair<int, Card>(playerSeatIndex, matchingCard));

        // Advance turn or resolve trick
        if (CurrentTrick.Count < 4)
        {
            CurrentTurnIndex = (CurrentTurnIndex + 1) % 4;
        }
        else
        {
            ResolveTrick();
        }
    }

    private void ResolveTrick()
    {
        Suit ledSuit = CurrentTrick[0].Value.Suit;
        int winningSeatIndex = CurrentTrick[0].Key;
        Card winningCard = CurrentTrick[0].Value;

        for (int i = 1; i < 4; i++)
        {
            var current = CurrentTrick[i];
            bool currentIsTrump = TrumpSuit.HasValue && current.Value.Suit == TrumpSuit.Value;
            bool winnerIsTrump = TrumpSuit.HasValue && winningCard.Suit == TrumpSuit.Value;

            if (currentIsTrump && !winnerIsTrump)
            {
                winningSeatIndex = current.Key;
                winningCard = current.Value;
            }
            else if (currentIsTrump && winnerIsTrump)
            {
                if (current.Value.Rank > winningCard.Rank)
                {
                    winningSeatIndex = current.Key;
                    winningCard = current.Value;
                }
            }
            else if (!currentIsTrump && !winnerIsTrump && current.Value.Suit == ledSuit)
            {
                if (current.Value.Rank > winningCard.Rank)
                {
                    winningSeatIndex = current.Key;
                    winningCard = current.Value;
                }
            }
        }

        // Allocate tricks won to respective teams
        if (winningSeatIndex == 0 || winningSeatIndex == 2)
        {
            TeamATricksWon++;
        }
        else
        {
            TeamBTricksWon++;
        }

        CurrentTrick.Clear();
        CurrentTurnIndex = winningSeatIndex; // Winner leads next trick

        // Check if all 8 tricks are complete
        if (TeamATricksWon + TeamBTricksWon == 8)
        {
            Phase = GamePhase.RoundSummary;
            EvaluateRoundScores();
        }
    }

    private void EvaluateRoundScores()
    {
        // Pure Scorecard Tally Core Logic
        if (TeamATricksWon >= 5)
        {
            int points = TeamATricksWon switch
            {
                5 or 6 => 1,
                7 => 2,
                8 => 3,
                _ => 0
            };
            TeamAMatchPoints += (points + CarriedPoints);
            CarriedPoints = 0;
        }
        else if (TeamBTricksWon >= 5)
        {
            int points = TeamBTricksWon switch
            {
                5 or 6 => 1,
                7 => 2,
                8 => 3,
                _ => 0
            };
            TeamBMatchPoints += (points + CarriedPoints);
            CarriedPoints = 0;
        }
        else
        {
            // 4-4 Split Draw Carryover accumulation rule
            CarriedPoints += 1;
        }

        // Check for complete Match Winning Criteria (>= 10 Points)
        if (TeamAMatchPoints >= 10 || TeamBMatchPoints >= 10)
        {
            Phase = GamePhase.MatchCompleted;
        }
        else
        {
            // Rotate dealer clockwise for next round iteration loop
            CurrentDealerIndex = (CurrentDealerIndex + 1) % 4;
            Phase = GamePhase.DealingPhase1;
        }
    }
}