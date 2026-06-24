using Omi.Application.Common.Interfaces;
using StackExchange.Redis;

namespace Omi.Infrastructure.Caching;

internal sealed class RedisLobbyLock : ILobbyLock
{
    // Lua script: delete the key only if the value still matches (prevents releasing another owner's lock)
    private const string ReleaseLua = """
        if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
        else
            return 0
        end
        """;

    private static readonly TimeSpan LockTtl      = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan AcquireLimit  = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RetryInterval = TimeSpan.FromMilliseconds(50);

    private readonly IDatabase _db;

    public RedisLobbyLock(IConnectionMultiplexer redis) => _db = redis.GetDatabase();

    public async Task<IAsyncDisposable> AcquireAsync(string lobbyId, CancellationToken ct = default)
    {
        string lockKey   = $"lock:{lobbyId}";
        string lockToken = Guid.NewGuid().ToString("N");
        var    deadline  = DateTime.UtcNow + AcquireLimit;

        while (DateTime.UtcNow < deadline)
        {
            ct.ThrowIfCancellationRequested();
            bool acquired = await _db.StringSetAsync(lockKey, lockToken, LockTtl, When.NotExists);
            if (acquired)
                return new LockHandle(_db, lockKey, lockToken);
            await Task.Delay(RetryInterval, ct);
        }

        throw new TimeoutException($"Could not acquire lock for lobby '{lobbyId}' within {AcquireLimit.TotalSeconds}s.");
    }

    private sealed class LockHandle : IAsyncDisposable
    {
        private readonly IDatabase _db;
        private readonly string    _key;
        private readonly string    _token;

        public LockHandle(IDatabase db, string key, string token)
        {
            _db    = db;
            _key   = key;
            _token = token;
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                await _db.ScriptEvaluateAsync(ReleaseLua,
                    new RedisKey[]   { _key },
                    new RedisValue[] { _token });
            }
            catch
            {
                // Lock auto-expires via TTL; best-effort release on Redis failure.
            }
        }
    }
}
