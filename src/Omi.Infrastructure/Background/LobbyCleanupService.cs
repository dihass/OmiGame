using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Omi.Application.Common.Interfaces;
using Omi.Application.DTOs;

namespace Omi.Infrastructure.Background;

internal enum JobKind { CleanupLobby, AnnounceDisconnect }

internal sealed record CleanupJob(string LobbyId, string PlayerId, DateTimeOffset ExecuteAt, JobKind Kind);

/// <summary>
/// Long-lived hosted service that processes delayed lobby work — cleanup checks
/// after a disconnect grace window, and deferred disconnect announcements that
/// absorb fast reloads. Replaces fire-and-forget Task.Run so jobs survive the
/// originating request scope and are cancelled cleanly on shutdown.
/// </summary>
internal sealed class LobbyCleanupService : BackgroundService, ILobbyCleanupQueue
{
    private readonly Channel<CleanupJob>          _channel = Channel.CreateUnbounded<CleanupJob>();
    private readonly IServiceScopeFactory         _scopeFactory;
    private readonly ILobbyLock                   _lock;
    private readonly ILogger<LobbyCleanupService> _log;

    public LobbyCleanupService(
        IServiceScopeFactory         scopeFactory,
        ILobbyLock                   lobbyLock,
        ILogger<LobbyCleanupService> log)
    {
        _scopeFactory = scopeFactory;
        _lock         = lobbyLock;
        _log          = log;
    }

    public void Enqueue(string lobbyId, string playerId, TimeSpan delay)
        => _channel.Writer.TryWrite(new CleanupJob(lobbyId, playerId, DateTimeOffset.UtcNow + delay, JobKind.CleanupLobby));

    public void EnqueueDisconnectAnnouncement(string lobbyId, string playerId, TimeSpan delay)
        => _channel.Writer.TryWrite(new CleanupJob(lobbyId, playerId, DateTimeOffset.UtcNow + delay, JobKind.AnnounceDisconnect));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            _ = ProcessAsync(job, stoppingToken);
        }
    }

    private async Task ProcessAsync(CleanupJob job, CancellationToken ct)
    {
        var remaining = job.ExecuteAt - DateTimeOffset.UtcNow;
        if (remaining > TimeSpan.Zero)
        {
            try { await Task.Delay(remaining, ct); }
            catch (OperationCanceledException) { return; }
        }

        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var games    = scope.ServiceProvider.GetRequiredService<IGameRepository>();
            var notifier = scope.ServiceProvider.GetRequiredService<IGameNotifier>();

            // ILobbyLock is Singleton — use the directly-injected instance
            await using var _ = await _lock.AcquireAsync(job.LobbyId, ct);

            var session = await games.GetAsync(job.LobbyId);
            var player  = session?.Players.FirstOrDefault(p => p.PlayerId == job.PlayerId);
            if (player?.IsDisconnected != true) return;

            switch (job.Kind)
            {
                case JobKind.AnnounceDisconnect:
                    await notifier.PlayerDisconnectedAsync(job.LobbyId, job.PlayerId);
                    _log.LogInformation(
                        "Disconnect announced for {PlayerId} in {LobbyId} (still disconnected after grace)",
                        job.PlayerId, job.LobbyId);
                    break;

                case JobKind.CleanupLobby:
                    await games.DeleteAsync(job.LobbyId);
                    await notifier.LobbyClosedAsync(job.LobbyId);
                    _log.LogInformation(
                        "Lobby {LobbyId} closed — player {PlayerId} did not reconnect within grace period",
                        job.LobbyId, job.PlayerId);
                    break;
            }
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Lobby job failed for {LobbyId} / {PlayerId} ({Kind})", job.LobbyId, job.PlayerId, job.Kind);
        }
    }
}
