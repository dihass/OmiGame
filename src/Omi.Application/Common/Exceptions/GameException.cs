namespace Omi.Application.Common.Exceptions;

public sealed class GameException : Exception
{
    public GameException(string message) : base(message) { }
}
