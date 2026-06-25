namespace Omi.Application.Common.Interfaces;

/// <summary>Maps a SignalR connection ID → (playerId, lobbyId).</summary>
public interface IConnectionRepository
{
    Task<(string PlayerId, string LobbyId)?> GetAsync(string connectionId);
    Task SaveAsync(string connectionId, string playerId, string lobbyId, TimeSpan? ttl = null);
    Task DeleteAsync(string connectionId);

    /// <summary>
    /// How many active SignalR connections this player currently holds in this lobby.
    /// Used by OnDisconnectedAsync to avoid marking a player disconnected when they
    /// still have other tabs open (or when an old TCP socket times out late after
    /// a fast reload).
    /// </summary>
    Task<int> CountForPlayerAsync(string lobbyId, string playerId);
}
