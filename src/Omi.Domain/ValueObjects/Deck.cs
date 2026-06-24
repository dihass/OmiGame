using System.Security.Cryptography;
using Omi.Domain.Enums;

namespace Omi.Domain.ValueObjects;

public sealed class Deck
{
    private readonly List<Card> _cards = new();

    public Deck()
    {
        foreach (Suit suit in Enum.GetValues<Suit>())
            foreach (Rank rank in Enum.GetValues<Rank>())
                _cards.Add(new Card(suit, rank));
    }

    public void Shuffle()
    {
        // Fisher-Yates with a CSPRNG — prevents an observer from predicting
        // the deal order if they know when the shuffle was called.
        int n = _cards.Count;
        while (n > 1)
        {
            n--;
            int k = RandomNumberGenerator.GetInt32(n + 1);
            (_cards[k], _cards[n]) = (_cards[n], _cards[k]);
        }
    }

    public Card Draw()
    {
        if (_cards.Count == 0)
            throw new InvalidOperationException("Cannot draw from an empty deck.");
        var card = _cards[0];
        _cards.RemoveAt(0);
        return card;
    }

    public List<Card> TakeRemainingCards()
    {
        var remaining = new List<Card>(_cards);
        _cards.Clear();
        return remaining;
    }
}
