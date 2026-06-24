using Microsoft.AspNetCore.SignalR;
using Omi.Application.Common.Interfaces;
using Omi.Application.DTOs;
using Omi.Domain.ValueObjects;

namespace Omi.Infrastructure.Realtime;

internal sealed class SignalRGameNotifier : IGameNotifier
{
    private readonly IHubContext<GameHub> _hub;

    public SignalRGameNotifier(IHubContext<GameHub> hub) => _hub = hub;

    // ── Group broadcasts ──────────────────────────────────────────────────────
    public Task LobbyUpdatedAsync(string lobbyId, GameSessionDto s)      => _hub.Clients.Group(lobbyId).SendAsync("LobbyUpdated", s);
    public Task RoundStartedAsync(string lobbyId, GameSessionDto s)      => _hub.Clients.Group(lobbyId).SendAsync("RoundStarted", s);
    public Task TrumpSelectedAsync(string lobbyId, GameSessionDto s)     => _hub.Clients.Group(lobbyId).SendAsync("TrumpSelected", s);
    public Task CardPlayedAsync(string lobbyId, GameSessionDto s)        => _hub.Clients.Group(lobbyId).SendAsync("CardPlayed", s);
    public Task PlayerReconnectedAsync(string lobbyId, string playerId)  => _hub.Clients.Group(lobbyId).SendAsync("PlayerReconnected", playerId);
    public Task PlayerDisconnectedAsync(string lobbyId, string playerId) => _hub.Clients.Group(lobbyId).SendAsync("PlayerDisconnected", playerId);
    public Task LobbyClosedAsync(string lobbyId)                         => _hub.Clients.Group(lobbyId).SendAsync("LobbyClosed");

    // ── Personal messages ─────────────────────────────────────────────────────

    /// <summary>
    /// Sends hand cards to the personal group "player:{playerId}".
    /// Each connection is added to this group on connect, so the player
    /// receives their own cards even after a reconnect on a new connection.
    /// </summary>
    public Task HandDealtAsync(string playerId, IReadOnlyList<Card> hand)
        => _hub.Clients.Group($"player:{playerId}").SendAsync("HandDealt", hand);

    public Task GameResumedAsync(string connectionId, GameSessionDto s)  => _hub.Clients.Client(connectionId).SendAsync("GameResumed", s);
    public Task LobbyNotFoundAsync(string connectionId)                  => _hub.Clients.Client(connectionId).SendAsync("LobbyNotFound");
}
