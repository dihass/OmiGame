using Omi.Backend.Core.Interfaces;
using Omi.Backend.Infrastructure.Caching;
using Omi.Backend.Infrastructure.Realtime;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ==========================================================================
// 1. REAL-TIME SIGNALR CONFIGURATION
// ==========================================================================
// Injects the SignalR framework infrastructure into the dependency injection container
builder.Services.AddSignalR();

// ==========================================================================
// 2. DISTRIBUTED STATE CACHE REGISTER (REDIS)
// ==========================================================================
// Extract the Redis Connection String from host configurations (e.g., appsettings.json)
// Defaulting to localhost:6379 to support immediate local development environments
string redisConnectionString = builder.Configuration.GetConnectionString("Redis") 
                               ?? "localhost:6379";

try
{
    // Initialize the physical Connection Multiplexer as a Singleton instance.
    // This is an expensive object engineered to remain open, warm, and shared across the lifecycle.
    var redisConnection = ConnectionMultiplexer.Connect(redisConnectionString);
    builder.Services.AddSingleton<IConnectionMultiplexer>(redisConnection);
}
catch (Exception ex)
{
    // Graceful console fallback warning to ensure early project building works even if local Redis isn't running yet
    Console.WriteLine($"[CRITICAL WARNING] Failed to establish direct connection to Redis cluster at {redisConnectionString}: {ex.Message}");
}

// Register our Generic Distributed State Cache Repository mapping.
// Scoped lifecycle isolates instances to distinct API request threads or message loop executions.
builder.Services.AddScoped(typeof(IStateRepository<>), typeof(RedisStateRepository<>));

// ==========================================================================
// 3. CORE PRESENTATION ENGINE DEPENDENCIES
// ==========================================================================
builder.Services.AddControllers();
builder.Services.AddOpenApi(); // Native .NET 10 OpenAPI specification metadata support

var app = builder.Build();

// ==========================================================================
// 4. HTTP REQUEST PIPELINE MIDDLEWARE BOOTSTRAP
// ==========================================================================
if (app.Environment.IsDevelopment())
{
    // Exposes the interactive open API developer interface routes
    app.MapOpenApi();
}

app.UseAuthorization();
app.MapControllers();

// ==========================================================================
// 5. APPLICATION GATEWAY ROUTE ROUTING
// ==========================================================================
// Map the real-time bi-directional messaging pipeline endpoint route for player connections
app.MapHub<GameHub>("/ws/game");

app.Run();