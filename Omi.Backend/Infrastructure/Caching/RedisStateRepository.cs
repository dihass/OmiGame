using System.Text.Json;
using Microsoft.Extensions.Logging;
using Omi.Backend.Core.Interfaces;
using StackExchange.Redis;

namespace Omi.Backend.Infrastructure.Caching;

public class RedisStateRepository<T> : IStateRepository<T> where T : class
{
    private readonly IDatabase _database;
    private readonly ILogger<RedisStateRepository<T>> _logger;
    
    // Configured for optimal native performance and case insensitivity
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public RedisStateRepository(IConnectionMultiplexer redis, ILogger<RedisStateRepository<T>> logger)
    {
        _database = redis.GetDatabase();
        _logger = logger;
    }

    public async Task<T?> GetAsync(string key)
    {
        try
        {
            RedisValue value = await _database.StringGetAsync(key);
            if (!value.HasValue)
            {
                _logger.LogWarning("Redis cache miss for key: {Key}", key);
                return null;
            }

            return JsonSerializer.Deserialize<T>(value.ToString(), JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read key {Key} from Redis cluster.", key);
            throw;
        }
    }

    public async Task SetAsync(string key, T value, TimeSpan? expiry = null)
    {
        try
        {
            // Default TTL to 2 hours if not explicitly assigned to auto-cleanup abandoned games
            TimeSpan ttl = expiry ?? TimeSpan.FromHours(2);
            string jsonString = JsonSerializer.Serialize(value, JsonOptions);

            bool success = await _database.StringSetAsync(key, jsonString, ttl);
            if (!success)
            {
                throw new RedisException($"Failed to write data to Redis cluster for key: {key}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write key {Key} to Redis cluster.", key);
            throw;
        }
    }

    public async Task DeleteAsync(string key)
    {
        try
        {
            await _database.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to evict key {Key} from Redis cluster.", key);
            throw;
        }
    }
}