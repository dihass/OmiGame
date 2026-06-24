using System.Text.Json;
using Microsoft.Extensions.Logging;
using Omi.Application.Common.Interfaces;
using StackExchange.Redis;

namespace Omi.Infrastructure.Caching;

internal sealed class RedisConnectionRepository : IConnectionRepository
{
    private static readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    private readonly IDatabase                          _db;
    private readonly ILogger<RedisConnectionRepository> _log;

    private record Entry(string PlayerId, string LobbyId);

    public RedisConnectionRepository(IConnectionMultiplexer redis, ILogger<RedisConnectionRepository> log)
    {
        _db  = redis.GetDatabase();
        _log = log;
    }

    public async Task<(string PlayerId, string LobbyId)?> GetAsync(string connectionId)
    {
        try
        {
            var raw = await _db.StringGetAsync(Key(connectionId));
            if (!raw.HasValue) return null;
            var e = JsonSerializer.Deserialize<Entry>(raw.ToString(), _json);
            return e is null ? null : (e.PlayerId, e.LobbyId);
        }
        catch (Exception ex) { _log.LogError(ex, "Redis GET failed for connection {Id}", connectionId); throw; }
    }

    public async Task SaveAsync(string connectionId, string playerId, string lobbyId, TimeSpan? ttl = null)
    {
        try
        {
            var json = JsonSerializer.Serialize(new Entry(playerId, lobbyId), _json);
            await _db.StringSetAsync(Key(connectionId), json, ttl ?? TimeSpan.FromHours(4));
        }
        catch (Exception ex) { _log.LogError(ex, "Redis SET failed for connection {Id}", connectionId); throw; }
    }

    public async Task DeleteAsync(string connectionId)
    {
        try   { await _db.KeyDeleteAsync(Key(connectionId)); }
        catch (Exception ex) { _log.LogError(ex, "Redis DEL failed for connection {Id}", connectionId); throw; }
    }

    private static string Key(string connectionId) => $"conn:{connectionId}";
}
