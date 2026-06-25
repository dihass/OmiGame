using Omi.Application.Common.Exceptions;
using Omi.Application.Common.Interfaces;
using Omi.Application.DTOs;
using Omi.Domain.Entities;
using Omi.Domain.Enums;
using Omi.Domain.ValueObjects;

namespace Omi.Application.Services;

/// <summary>
/// Orchestrates all game use-cases. Controllers and the hub delegate here;
/// neither layer touches session state directly.
///
/// Hand-privacy contract:
///   • Group broadcasts (lobby, round, trick) use hand-less GameSessionDto.
///   • After any deal event, each player's hand is sent individually via
///     IGameNotifier.HandDealtAsync to their personal "player:{id}" group.
///   • This ensures no player ever receives another player's cards.
/// </summary>
public sealed class GameService
{
    private readonly IGameRepository    _games;
    private readonly IGameNotifier      _notifier;
    private readonly ILobbyLock         _lock;
    private readonly ILobbyCleanupQueue _cleanupQueue;

    public GameService(
        IGameRepository    games,
        IGameNotifier      notifier,
        ILobbyLock         lobbyLock,
        ILobbyCleanupQueue cleanupQueue)
    {
        _games        = games;
        _notifier     = notifier;
        _lock         = lobbyLock;
        _cleanupQueue = cleanupQueue;
    }

    public async Task<GameSessionDto> CreateRoomAsync(string lobbyId)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        if (await _games.GetAsync(lobbyId) is not null)
            throw new GameException("Room already exists.");

        var session = new GameSession { LobbyId = lobbyId };
        await _games.SaveAsync(lobbyId, session);
        return GameSessionDto.From(session);
    }

    public async Task<GameSessionDto> JoinAsync(string lobbyId, string playerId, string displayName)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId)
            ?? throw new NotFoundException("Room not found.");

        if (session.Phase != GamePhase.Lobby)                 throw new GameException("Game has already started.");
        if (session.Players.Count >= 4)                       throw new GameException("Room is full.");
        if (session.Players.Any(p => p.PlayerId == playerId)) throw new GameException("Player already joined.");

        // Names must be unique per lobby (case-insensitive, ignoring surrounding whitespace).
        // Without this, two players named "Dihas" would be indistinguishable in the UI.
        var normalized = displayName.Trim();
        if (session.Players.Any(p => string.Equals(p.DisplayName.Trim(), normalized, StringComparison.OrdinalIgnoreCase)))
            throw new GameException("That name is already taken in this lobby.");

        session.Players.Add(new Player
        {
            PlayerId    = playerId,
            DisplayName = normalized,
            SeatIndex   = session.Players.Count
        });

        await _games.SaveAsync(lobbyId, session);
        var dto = GameSessionDto.From(session);
        await _notifier.LobbyUpdatedAsync(lobbyId, dto);
        return dto;
    }

    public async Task<GameSessionDto> StartRoundAsync(string lobbyId)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId)
            ?? throw new NotFoundException("Room not found.");

        session.StartRound();
        await _games.SaveAsync(lobbyId, session);

        var dto = GameSessionDto.From(session);
        await _notifier.RoundStartedAsync(lobbyId, dto);

        // Deal each player's initial 4 cards privately — never in the group broadcast
        foreach (var p in session.Players)
            await _notifier.HandDealtAsync(p.PlayerId, p.Hand);

        return dto;
    }

    public async Task<GameSessionDto> SetTrumpAsync(string lobbyId, string callerPlayerId, Suit suit)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId)
            ?? throw new NotFoundException("Room not found.");

        var player = session.Players.FirstOrDefault(p => p.PlayerId == callerPlayerId)
            ?? throw new GameException("Player is not in this lobby.");

        session.SetTrump(player.SeatIndex, suit);
        await _games.SaveAsync(lobbyId, session);

        var dto = GameSessionDto.From(session);
        await _notifier.TrumpSelectedAsync(lobbyId, dto);

        // Phase-2 deal adds 4 more cards to each hand — push updated hands privately
        foreach (var p in session.Players)
            await _notifier.HandDealtAsync(p.PlayerId, p.Hand);

        return dto;
    }

    public async Task<GameSessionDto> PlayCardAsync(string lobbyId, string callerPlayerId, Card card)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId)
            ?? throw new NotFoundException("Room not found.");

        var player = session.Players.FirstOrDefault(p => p.PlayerId == callerPlayerId)
            ?? throw new GameException("Player is not in this lobby.");

        session.PlayCard(player.SeatIndex, card);
        await _games.SaveAsync(lobbyId, session);

        var dto = GameSessionDto.From(session);
        await _notifier.CardPlayedAsync(lobbyId, dto);
        // No HandDealtAsync needed: clients track hand locally by removing the played card

        return dto;
    }

    public async Task HandleReconnectAsync(string connectionId, string playerId, string lobbyId)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId);
        if (session is null)
        {
            await _notifier.LobbyNotFoundAsync(connectionId);
            return;
        }

        var player = session.Players.FirstOrDefault(p => p.PlayerId == playerId);
        // Player was cleaned up after the disconnect grace window — surface this so the
        // client clears stale state instead of hanging on a "Reconnecting…" overlay.
        if (player is null)
        {
            await _notifier.LobbyNotFoundAsync(connectionId);
            return;
        }

        // Already connected (e.g. a second tab opened the same lobby) — push current state
        // so the new connection isn't blank, but skip the reconnect notification.
        if (!player.IsDisconnected)
        {
            var currentDto = GameSessionDto.From(session);
            await _notifier.GameResumedAsync(connectionId, currentDto);
            if (player.Hand.Count > 0)
                await _notifier.HandDealtAsync(playerId, player.Hand);
            return;
        }

        player.IsDisconnected      = false;
        player.DisconnectTimestamp = null;
        await _games.SaveAsync(lobbyId, session);

        // Send hand-less session state to the reconnecting connection
        var dto = GameSessionDto.From(session);
        await _notifier.GameResumedAsync(connectionId, dto);
        await _notifier.PlayerReconnectedAsync(lobbyId, playerId);

        // Restore the reconnecting player's private hand — only their own, not others'
        if (player.Hand.Count > 0)
            await _notifier.HandDealtAsync(playerId, player.Hand);
    }

    public async Task<GameSessionDto?> LeaveAsync(string lobbyId, string playerId)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId);
        if (session is null) return null;

        var player = session.Players.FirstOrDefault(p => p.PlayerId == playerId);
        if (player is null) return GameSessionDto.From(session);

        session.Players.Remove(player);

        // Last player out closes the lobby entirely — no point keeping an empty room around
        if (session.Players.Count == 0)
        {
            await _games.DeleteAsync(lobbyId);
            await _notifier.LobbyClosedAsync(lobbyId);
            return null;
        }

        // Re-seat remaining players so SeatIndex stays contiguous (0..N-1)
        for (int i = 0; i < session.Players.Count; i++)
            session.Players[i].SeatIndex = i;

        await _games.SaveAsync(lobbyId, session);
        var dto = GameSessionDto.From(session);
        await _notifier.LobbyUpdatedAsync(lobbyId, dto);
        return dto;
    }

    public async Task HandleDisconnectAsync(string playerId, string lobbyId)
    {
        await using var _ = await _lock.AcquireAsync(lobbyId);

        var session = await _games.GetAsync(lobbyId);
        var player  = session?.Players.FirstOrDefault(p => p.PlayerId == playerId);
        if (player is null || session is null) return;

        player.IsDisconnected      = true;
        player.DisconnectTimestamp = DateTime.UtcNow;
        await _games.SaveAsync(lobbyId, session);
        await _notifier.PlayerDisconnectedAsync(lobbyId, playerId);

        _cleanupQueue.Enqueue(lobbyId, playerId, TimeSpan.FromSeconds(10));
    }
}
