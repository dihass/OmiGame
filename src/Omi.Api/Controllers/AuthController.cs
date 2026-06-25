using System.Text;
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

        // Length + character-class only — React escapes on render so HTML encoding
        // here would just corrupt names with apostrophes ("Test's" → "Test&#39;s").
        string trimmed = request.DisplayName.Trim();
        if (trimmed.Length < 2 || trimmed.Length > 30)
            return BadRequest(new { error = "Display name must be 2–30 characters." });

        if (trimmed.Any(char.IsControl))
            return BadRequest(new { error = "Display name contains invalid characters." });

        var descriptor = new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object>
            {
                ["playerId"]    = request.PlayerId,
                ["lobbyId"]     = request.LobbyId,
                ["displayName"] = trimmed
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
