namespace Omi.Api.Options;

public sealed class JwtOptions
{
    public const string Section = "Jwt";

    public string SigningKey { get; init; } = string.Empty;
    public string Issuer     { get; init; } = "omi-platform";
    public string Audience   { get; init; } = "omi-client";
    public int    ExpiryHours { get; init; } = 4;
}
