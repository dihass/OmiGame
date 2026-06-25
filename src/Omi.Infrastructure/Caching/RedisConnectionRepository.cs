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

    private static string ConnKey(string connectionId) => $"conn:{connectionId}";
    private static string PlayerSetKey(string lobbyId, string playerId) => $"player-conns:{lobbyId}:{playerId}";

    public async Task<(string PlayerId, string LobbyId)?> GetAsync(string connectionId)
    {
        try
        {
            var raw = await _db.StringGetAsync(ConnKey(connectionId));
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
            var json    = JsonSerializer.Serialize(new Entry(playerId, lobbyId), _json);
            var expiry  = ttl ?? TimeSpan.FromHours(4);
            var setKey  = PlayerSetKey(lobbyId, playerId);

            // Connection-id → (player, lobby) AND lobby/player → set-of-connection-ids.
            // The set lets us count concurrent tabs so a single tab closing doesn't
            // mark the player disconnected when others are still live.
            var batch = _db.CreateBatch();
            var t1 = batch.StringSetAsync(ConnKey(connectionId), json, expiry);
            var t2 = batch.SetAddAsync(setKey, connectionId);
            var t3 = batch.KeyExpireAsync(setKey, expiry);
            batch.Execute();
            await Task.WhenAll(t1, t2, t3);
        }
        catch (Exception ex) { _log.LogError(ex, "Redis SAVE failed for connection {Id}", connectionId); throw; }
    }

    public async Task DeleteAsync(string connectionId)
    {
        try
        {
            // Read first so we know which player-set to remove from
            var raw = await _db.StringGetAsync(ConnKey(connectionId));
            if (raw.HasValue)
            {
                var e = JsonSerializer.Deserialize<Entry>(raw.ToString(), _json);
                if (e is not null)
                {
                    await Task.WhenAll(
                        _db.KeyDeleteAsync(ConnKey(connectionId)),
                        _db.SetRemoveAsync(PlayerSetKey(e.LobbyId, e.PlayerId), connectionId)
                    );
                    return;
                }
            }
            await _db.KeyDeleteAsync(ConnKey(connectionId));
        }
        catch (Exception ex) { _log.LogError(ex, "Redis DEL failed for connection {Id}", connectionId); throw; }
    }

    public async Task<int> CountForPlayerAsync(string lobbyId, string playerId)
    {
        try
        {
            return (int)await _db.SetLengthAsync(PlayerSetKey(lobbyId, playerId));
        }
        catch (Exception ex) { _log.LogError(ex, "Redis SCARD failed for player {PlayerId}", playerId); throw; }
    }
}
