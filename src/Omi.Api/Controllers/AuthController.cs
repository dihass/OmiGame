using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Omi.Api.Options;
using Omi.Application.Common.Validation;

namespace Omi.Api.Controllers;

[ApiController]
public sealed partial class AuthController : ControllerBase
{
    // PlayerId: UUID or alphanumeric, 4–64 chars. Prevents identity spoofing with weird chars.
    [GeneratedRegex(@"^[a-zA-Z0-9\-_]{4,64}$")]
    private static partial Regex PlayerIdPattern();

    private readonly JwtOptions _jwt;

    public AuthController(IOptions<JwtOptions> jwt) => _jwt = jwt.Value;

    [EnableRateLimiting("auth")]
    [HttpPost("/api/lobby/auth")]
    public IActionResult GenerateToken([FromBody] LobbyAuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PlayerId)    ||
            string.IsNullOrWhiteSpace(request.DisplayName) ||
            string.IsNullOrWhiteSpace(request.LobbyId))
            return BadRequest(new { error = "PlayerId, DisplayName, and LobbyId are all required." });

        if (!PlayerIdPattern().IsMatch(request.PlayerId))
            return BadRequest(new { error = "PlayerId must be 4–64 alphanumeric characters (hyphens and underscores allowed)." });

        if (!LobbyIdValidator.IsValid(request.LobbyId))
            return BadRequest(new { error = "LobbyId must be 4–50 alphanumeric characters (hyphens allowed)." });

        // Pre-encoding guard: HTML encoding can expand characters (< → &lt;) so we
        // also check the raw input length to avoid unnecessary work on huge inputs.
        string trimmed = request.DisplayName.Trim();
        if (trimmed.Length > 100)
            return BadRequest(new { error = "Display name must not exceed 50 characters." });

        string sanitized = HtmlEncoder.Default.Encode(trimmed);
        if (sanitized.Length > 50)
            return BadRequest(new { error = "Display name must not exceed 50 characters." });

        var descriptor = new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object>
            {
                ["playerId"]    = request.PlayerId,
                ["lobbyId"]     = request.LobbyId,
                ["displayName"] = sanitized
            },
            Issuer             = _jwt.Issuer,
            Audience           = _jwt.Audience,
            Expires            = DateTime.UtcNow.AddHours(_jwt.ExpiryHours),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SigningKey)),
                SecurityAlgorithms.HmacSha256)
        };

        return Ok(new { token = new JsonWebTokenHandler().CreateToken(descriptor) });
    }
}

public record LobbyAuthRequest(
    [property: JsonPropertyName("playerId")]    string PlayerId,
    [property: JsonPropertyName("displayName")] string DisplayName,
    [property: JsonPropertyName("lobbyId")]     string LobbyId
);
