using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Omi.Api.HealthChecks;
using Omi.Api.Middleware;
using Omi.Api.Options;
using Omi.Infrastructure;
using Omi.Infrastructure.Realtime;

var builder = WebApplication.CreateBuilder(args);

// ── Kestrel: hard cap on request body size ────────────────────────────────────
// Prevents memory exhaustion from oversized payloads. Game API requests are tiny.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 64 * 1024);

// ── Options ───────────────────────────────────────────────────────────────────
builder.Services.AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<CorsOptions>()
    .BindConfiguration(CorsOptions.Section);

var jwtOpts = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>()
    ?? throw new InvalidOperationException($"Missing '{JwtOptions.Section}' configuration section.");

if (string.IsNullOrWhiteSpace(jwtOpts.SigningKey) || jwtOpts.SigningKey.Length < 32)
    throw new InvalidOperationException(
        "Jwt:SigningKey must be at least 32 characters. " +
        "Set it via appsettings, environment variable, or Azure Key Vault.");

var corsOpts = builder.Configuration.GetSection(CorsOptions.Section).Get<CorsOptions>() ?? new CorsOptions();

// ── Forwarded headers (trust Azure / load-balancer proxy) ─────────────────────
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Clear the default allowed-networks so the proxy's IP isn't restricted
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    var origins = corsOpts.AllowedOrigins;
    if (origins.Length > 0)
        p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    else if (builder.Environment.IsDevelopment())
        p.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    else
        p.WithOrigins("http://localhost").AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));

// ── JWT ───────────────────────────────────────────────────────────────────────
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOpts.SigningKey)),
            ValidateIssuer           = true,
            ValidIssuer              = jwtOpts.Issuer,
            ValidateAudience         = true,
            ValidAudience            = jwtOpts.Audience,
            ClockSkew                = TimeSpan.Zero
        };
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/ws/game"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── Rate limiting ─────────────────────────────────────────────────────────────
builder.Services.AddRateLimiter(o =>
{
    // Auth endpoint: strict fixed window per IP — prevents token-farm abuse
    o.AddFixedWindowLimiter("auth", opt =>
    {
        opt.Window               = TimeSpan.FromMinutes(1);
        opt.PermitLimit          = 10;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit           = 0;
    });

    // Game actions: per-player sliding window keyed on JWT playerId claim
    o.AddPolicy("game", ctx =>
    {
        var playerId = ctx.User.FindFirst("playerId")?.Value
                    ?? ctx.Connection.RemoteIpAddress?.ToString()
                    ?? "anonymous";
        return RateLimitPartition.GetSlidingWindowLimiter(playerId,
            _ => new SlidingWindowRateLimiterOptions
            {
                Window               = TimeSpan.FromMinutes(1),
                PermitLimit          = 120,  // 2 actions/sec sustained
                SegmentsPerWindow    = 6,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit           = 0
            });
    });

    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// ── SignalR (with optional Azure SignalR Service backplane) ───────────────────
var signalRBuilder = builder.Services.AddSignalR()
    .AddJsonProtocol(o =>
    {
        o.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

string? azureSignalRCs = builder.Configuration.GetConnectionString("AzureSignalR");
if (!string.IsNullOrWhiteSpace(azureSignalRCs))
    signalRBuilder.AddAzureSignalR(azureSignalRCs);

// ── Infrastructure (Redis + repositories + GameService) ───────────────────────
string redisCs = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
builder.Services.AddInfrastructure(redisCs);

// ── MVC / OpenAPI ─────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();

// ── Health checks ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddCheck<RedisHealthCheck>("redis");

// ── Build ─────────────────────────────────────────────────────────────────────
var app = builder.Build();

// Must be first — trusts X-Forwarded-Proto so HTTPS detection works behind Azure proxy
app.UseForwardedHeaders();

// HTTPS: redirect in dev (we own TLS); HSTS in production (proxy already enforces HTTPS)
if (app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
else
    app.UseHsts();

app.UseCors();
app.UseRateLimiter();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<GameHub>("/ws/game");
app.MapHealthChecks("/healthz");

app.Run();
