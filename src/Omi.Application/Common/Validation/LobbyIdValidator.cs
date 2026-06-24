using System.Text.RegularExpressions;

namespace Omi.Application.Common.Validation;

public static partial class LobbyIdValidator
{
    // Alphanumeric + hyphens only, 4–50 chars. Prevents Redis key injection and log poisoning.
    [GeneratedRegex(@"^[a-zA-Z0-9\-]{4,50}$", RegexOptions.Compiled)]
    private static partial Regex ValidPattern();

    public static bool IsValid(string? lobbyId) =>
        !string.IsNullOrEmpty(lobbyId) && ValidPattern().IsMatch(lobbyId);
}
