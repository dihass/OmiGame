namespace Omi.Application.Common.Interfaces;

/// <summary>Maps a SignalR connection ID → (playerId, lobbyId).</summary>
public interface IConnectionRepository
{
    Task<(string PlayerId, string LobbyId)?> GetAsync(string connectionId);
    Task SaveAsync(string connectionId, string playerId, string lobbyId, TimeSpan? ttl = null);
    Task DeleteAsync(string connectionId);
}
