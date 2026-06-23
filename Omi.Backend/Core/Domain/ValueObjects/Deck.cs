using Omi.Backend.Core.Domain.Enums;

namespace Omi.Backend.Core.Domain.ValueObjects;

public class Deck
{
    private readonly List<Card> _cards = new();

    public Deck()
    {
        // Populate exactly 32 cards (Ranks 7 through Ace for all 4 suits)
        foreach (Suit suit in Enum.GetValues<Suit>())
        {
            foreach (Rank rank in Enum.GetValues<Rank>())
            {
                _cards.Add(new Card(suit, rank));
            }
        }
    }

    /// <summary>
    /// Shuffles the deck in O(N) linear time using an unbiased Fisher-Yates algorithm.
    /// </summary>
    public void Shuffle()
    {
        Random rand = new Random();
        int n = _cards.Count;
        while (n > 1)
        {
            n--;
            int k = rand.Next(n + 1);
            (_cards[k], _cards[n]) = (_cards[n], _cards[k]);
        }
    }

    public Card Draw()
    {
        if (_cards.Count == 0)
        {
            throw new InvalidOperationException("Cannot draw from an empty deck.");
        }

        Card card = _cards[0];
        _cards.RemoveAt(0);
        return card;
    }
}