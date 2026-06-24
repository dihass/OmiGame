namespace Omi.Api.Middleware;

/// <summary>
/// Adds defensive HTTP security headers to every response.
/// Must be registered before UseAuthentication / UseAuthorization so
/// headers are present even on 401/403 responses.
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx)
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"]  = "nosniff";
        h["X-Frame-Options"]         = "DENY";
        h["Referrer-Policy"]         = "strict-origin-when-cross-origin";
        h["Permissions-Policy"]      = "camera=(), microphone=(), geolocation=(), payment=()";
        // Explicitly disable legacy XSS auditor — modern browsers ignore it but old ones
        // can be tricked into blocking legitimate script via header manipulation.
        h["X-XSS-Protection"]        = "0";
        await _next(ctx);
    }
}
