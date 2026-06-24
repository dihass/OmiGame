namespace Omi.Application.Common.Interfaces;

/// <summary>
/// Provides a per-lobby distributed lock so that read-modify-write operations
/// on game state are serialised even under horizontal scaling.
/// </summary>
public interface ILobbyLock
{
    /// <summary>
    /// Acquires an exclusive lock for <paramref name="lobbyId"/>.
    /// Dispose the returned handle to release it.
    /// Throws <see cref="TimeoutException"/> if the lock cannot be acquired within the deadline.
    /// </summary>
    Task<IAsyncDisposable> AcquireAsync(string lobbyId, CancellationToken ct = default);
}
