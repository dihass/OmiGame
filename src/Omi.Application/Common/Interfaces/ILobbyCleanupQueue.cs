namespace Omi.Application.Common.Interfaces;

/// <summary>
/// Schedules delayed work for a lobby (cleanup checks, deferred announcements)
/// on a long-lived BackgroundService so the operation survives the request scope.
/// </summary>
public interface ILobbyCleanupQueue
{
    /// <summary>
    /// After <paramref name="delay"/>, if the player is still disconnected,
    /// delete the session and broadcast LobbyClosed.
    /// </summary>
    void Enqueue(string lobbyId, string playerId, TimeSpan delay);

    /// <summary>
    /// After <paramref name="delay"/>, if the player is still disconnected,
    /// broadcast PlayerDisconnected. Lets us absorb fast reloads silently:
    /// reload completes &lt; delay → no one ever sees the disconnect overlay.
    /// </summary>
    void EnqueueDisconnectAnnouncement(string lobbyId, string playerId, TimeSpan delay);
}
