using Omi.Application.DTOs;
using Omi.Domain.ValueObjects;

namespace Omi.Application.Common.Interfaces;

/// <summary>Abstracts over SignalR so the Application layer has no hub dependency.</summary>
public interface IGameNotifier
{
    // ── Group broadcasts (no hand data) ──────────────────────────────────────
    Task LobbyUpdatedAsync(string lobbyId, GameSessionDto session);
    Task RoundStartedAsync(string lobbyId, GameSessionDto session);
    Task TrumpSelectedAsync(string lobbyId, GameSessionDto session);
    Task CardPlayedAsync(string lobbyId, GameSessionDto session);
    Task PlayerReconnectedAsync(string lobbyId, string playerId);
    Task PlayerDisconnectedAsync(string lobbyId, string playerId);
    Task LobbyClosedAsync(string lobbyId);

    // ── Personal messages (hand data, connection-specific) ────────────────────
    /// <summary>
    /// Sends the player's private hand to their personal SignalR group.
    /// Must only be called for the owning player — never broadcast to a lobby group.
    /// </summary>
    Task HandDealtAsync(string playerId, IReadOnlyList<Card> hand);

    /// <summary>Sends full session state to one reconnecting connection (no other players' hands).</summary>
    Task GameResumedAsync(string connectionId, GameSessionDto session);
    Task LobbyNotFoundAsync(string connectionId);
}
