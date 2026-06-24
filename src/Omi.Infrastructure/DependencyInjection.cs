using Microsoft.Extensions.DependencyInjection;
using Omi.Application.Common.Interfaces;
using Omi.Application.Services;
using Omi.Infrastructure.Background;
using Omi.Infrastructure.Caching;
using Omi.Infrastructure.Realtime;
using StackExchange.Redis;

namespace Omi.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        string redisConnectionString)
    {
        try
        {
            var redis = ConnectionMultiplexer.Connect(redisConnectionString);
            services.AddSingleton<IConnectionMultiplexer>(redis);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(
                $"[STARTUP] Cannot connect to Redis at '{redisConnectionString}': {ex.Message}");
            Console.Error.WriteLine(
                "Start Redis before running: docker run -d -p 6379:6379 redis");
            throw;
        }

        // Singleton: stateless, backed only by the singleton IConnectionMultiplexer
        services.AddSingleton<ILobbyLock, RedisLobbyLock>();

        // Singleton BackgroundService that also implements ILobbyCleanupQueue
        services.AddSingleton<LobbyCleanupService>();
        services.AddSingleton<ILobbyCleanupQueue>(sp => sp.GetRequiredService<LobbyCleanupService>());
        services.AddHostedService(sp => sp.GetRequiredService<LobbyCleanupService>());

        services.AddScoped<IGameRepository,       RedisGameRepository>();
        services.AddScoped<IConnectionRepository, RedisConnectionRepository>();
        services.AddScoped<IGameNotifier,         SignalRGameNotifier>();
        services.AddScoped<GameService>();

        return services;
    }
}
