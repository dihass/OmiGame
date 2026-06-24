namespace Omi.Api.Options;

public sealed class CorsOptions
{
    public const string Section = "Cors";

    public string[] AllowedOrigins { get; init; } = [];
}
