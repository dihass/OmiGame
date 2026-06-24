using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Omi.Application.Common.Interfaces;
using Omi.Application.Services;

namespace Omi.Infrastructure.Realtime;

[Authorize]
public sealed class GameHub : Hub
{
    private readonly GameService           _gameService;
    private readonly IConnectionRepository _connections;
    private readonly ILogger<GameHub>      _log;

    public GameHub(GameService gameService, IConnectionRepository connections, ILogger<GameHub> log)
    {
        _gameService = gameService;
        _connections = connections;
        _log         = log;
    }

    public override async Task OnConnectedAsync()
    {
        string? playerId = Context.User?.FindFirst("playerId")?.Value;
        string? lobbyId  = Context.User?.FindFirst("lobbyId")?.Value;

        if (string.IsNullOrWhiteSpace(playerId) || string.IsNullOrWhiteSpace(lobbyId))
        {
            Context.Abort();
            return;
        }

        await _connections.SaveAsync(Context.ConnectionId, playerId, lobbyId, TimeSpan.FromHours(4));

        // Lobby group — receives shared state broadcasts (no hand data)
        await Groups.AddToGroupAsync(Context.ConnectionId, lobbyId);

        // Personal group — receives private hand-dealt messages for this player only
        await Groups.AddToGroupAsync(Context.ConnectionId, $"player:{playerId}");

        await _gameService.HandleReconnectAsync(Context.ConnectionId, playerId, lobbyId);

        _log.LogInformation("Player {PlayerId} connected to lobby {LobbyId}", playerId, lobbyId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var entry = await _connections.GetAsync(Context.ConnectionId);
        await _connections.DeleteAsync(Context.ConnectionId);

        if (entry is var (playerId, lobbyId))
        {
            await _gameService.HandleDisconnectAsync(playerId, lobbyId);
            _log.LogInformation("Player {PlayerId} disconnected from lobby {LobbyId}", playerId, lobbyId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
