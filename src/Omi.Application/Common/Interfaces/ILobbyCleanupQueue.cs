namespace Omi.Application.Common.Interfaces;

/// <summary>
/// Schedules a delayed lobby-cleanup check after a player disconnects.
/// Implemented by a long-lived BackgroundService so the operation survives
/// the request scope.
/// </summary>
public interface ILobbyCleanupQueue
{
    void Enqueue(string lobbyId, string playerId, TimeSpan delay);
}
