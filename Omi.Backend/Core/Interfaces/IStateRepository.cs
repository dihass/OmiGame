namespace Omi.Backend.Core.Interfaces;

public interface IStateRepository<T> where T : class
{
    /// <summary>
    /// Fetches the latest state snapshot from the distributed cache using a unique string key.
    /// </summary>
    Task<T?> GetAsync(string key);

    /// <summary>
    /// Atomically updates or inserts the state data inside the cluster equipped with a TTL constraint.
    /// </summary>
    Task SetAsync(string key, T value, TimeSpan? expiry = null);

    /// <summary>
    /// Evicts the state from cache completely when a match terminates or fails.
    /// </summary>
    Task DeleteAsync(string key);
}