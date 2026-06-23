using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Omi.Backend.Infrastructure.Realtime;

public class GameHub : Hub
{
    private readonly ILogger<GameHub> _logger;

    public GameHub(ILogger<GameHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Connects a player's real-time socket channel directly to a specific game room group.
    /// </summary>
    public async Task JoinRoom(string lobbyId, string playerId)
    {
        if (string.IsNullOrWhiteSpace(lobbyId) || string.IsNullOrWhiteSpace(playerId))
        {
            throw new HubException("Invalid room connection parameters.");
        }

        // Add the unique connection ID to the isolated SignalR room group
        await Groups.AddToGroupAsync(Context.ConnectionId, lobbyId);
        
        _logger.LogInformation("Player {PlayerId} with connection {ConnectionId} successfully joined room group {LobbyId}", 
            playerId, Context.ConnectionId, lobbyId);

        // Notify other players in the room that a peer has connected securely
        await Clients.Group(lobbyId).SendAsync("PlayerConnected", playerId);
    }

    /// <summary>
    /// Cleanly removes a player's real-time connection from a game room group.
    /// </summary>
    public async Task LeaveRoom(string lobbyId, string playerId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, lobbyId);
        
        _logger.LogInformation("Player {PlayerId} left room group {LobbyId}", playerId, lobbyId);
        
        await Clients.Group(lobbyId).SendAsync("PlayerDisconnected", playerId);
    }
}