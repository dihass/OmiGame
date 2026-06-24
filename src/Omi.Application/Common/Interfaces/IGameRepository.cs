using Omi.Domain.Entities;

namespace Omi.Application.Common.Interfaces;

public interface IGameRepository
{
    Task<GameSession?> GetAsync(string lobbyId);
    Task SaveAsync(string lobbyId, GameSession session);
    Task DeleteAsync(string lobbyId);
}
