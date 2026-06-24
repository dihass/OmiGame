namespace Omi.Domain.Exceptions;

public sealed class InvalidPlayException : Exception
{
    public InvalidPlayException(string message) : base(message) { }
}
