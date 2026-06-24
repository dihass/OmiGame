using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Omi.Application.Common.Interfaces;
using Omi.Domain.Entities;
using StackExchange.Redis;

namespace Omi.Infrastructure.Caching;

internal sealed class RedisGameRepository : IGameRepository
{
    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
        WriteIndented               = false,
        Converters                  = { new JsonStringEnumConverter() }
    };

    private readonly IDatabase                    _db;
    private readonly ILogger<RedisGameRepository> _log;

    public RedisGameRepository(IConnectionMultiplexer redis, ILogger<RedisGameRepository> log)
    {
        _db  = redis.GetDatabase();
        _log = log;
    }

    public async Task<GameSession?> GetAsync(string lobbyId)
    {
        try
        {
            var raw = await _db.StringGetAsync(lobbyId);
            return raw.HasValue ? JsonSerializer.Deserialize<GameSession>(raw.ToString(), _json) : null;
        }
        catch (Exception ex) { _log.LogError(ex, "Redis GET failed for lobby {Id}", lobbyId); throw; }
    }

    public async Task SaveAsync(string lobbyId, GameSession session)
    {
        try
        {
            var json = JsonSerializer.Serialize(session, _json);
            bool ok  = await _db.StringSetAsync(lobbyId, json, TimeSpan.FromHours(2));
            if (!ok) throw new RedisException($"Redis SET failed for lobby {lobbyId}");
        }
        catch (Exception ex) { _log.LogError(ex, "Redis SET failed for lobby {Id}", lobbyId); throw; }
    }

    public async Task DeleteAsync(string lobbyId)
    {
        try   { await _db.KeyDeleteAsync(lobbyId); }
        catch (Exception ex) { _log.LogError(ex, "Redis DEL failed for lobby {Id}", lobbyId); throw; }
    }
}
