using System.Net;
using System.Text.Json;
using Omi.Application.Common.Exceptions;

namespace Omi.Api.Middleware;

/// <summary>Converts well-known application exceptions to HTTP problem responses.</summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate                       _next;
    private readonly ILogger<ExceptionHandlingMiddleware>  _log;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> log)
    {
        _next = next;
        _log  = log;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (NotFoundException ex)
        {
            await WriteError(ctx, HttpStatusCode.NotFound, ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            await WriteError(ctx, HttpStatusCode.Forbidden, ex.Message);
        }
        catch (GameException ex)
        {
            await WriteError(ctx, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            await WriteError(ctx, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception");
            await WriteError(ctx, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
        }
    }

    private static Task WriteError(HttpContext ctx, HttpStatusCode status, string message)
    {
        ctx.Response.StatusCode  = (int)status;
        ctx.Response.ContentType = "application/json";
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
    }
}
