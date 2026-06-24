using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Omi.Application.DTOs;
using Omi.Application.Services;
using Omi.Application.Common.Validation;
using Omi.Domain.Enums;
using Omi.Domain.ValueObjects;

namespace Omi.Api.Controllers;

[Authorize]
[EnableRateLimiting("game")]
[ApiController]
[Route("api/[controller]")]
public sealed class GameController : ControllerBase
{
    private readonly GameService _game;

    public GameController(GameService game) => _game = game;

    private string CallerId    => User.FindFirst("playerId")!.Value;
    private string CallerLobby => User.FindFirst("lobbyId")!.Value;

    /// <summary>
    /// Validates that the route lobbyId is well-formed and matches the
    /// lobbyId the caller's JWT was scoped to. Prevents a player from
    /// acting on a lobby they never authenticated for.
    /// </summary>
    private ActionResult? GuardLobby(string routeLobbyId)
    {
        if (!LobbyIdValidator.IsValid(routeLobbyId))
            return BadRequest(new { error = "Invalid lobby ID format." });
        if (CallerLobby != routeLobbyId)
            return Forbid();
        return null;
    }

    [HttpPost("create/{lobbyId}")]
    public async Task<ActionResult<GameSessionDto>> CreateRoom(string lobbyId)
    {
        var guard = GuardLobby(lobbyId);
        if (guard is not null) return guard;
        return Ok(await _game.CreateRoomAsync(lobbyId));
    }

    [HttpPost("join/{lobbyId}")]
    public async Task<ActionResult<GameSessionDto>> JoinRoom(string lobbyId)
    {
        var guard = GuardLobby(lobbyId);
        if (guard is not null) return guard;
        string displayName = User.FindFirst("displayName")!.Value;
        return Ok(await _game.JoinAsync(lobbyId, CallerId, displayName));
    }

    [HttpPost("start/{lobbyId}")]
    public async Task<ActionResult<GameSessionDto>> StartRound(string lobbyId)
    {
        var guard = GuardLobby(lobbyId);
        if (guard is not null) return guard;
        return Ok(await _game.StartRoundAsync(lobbyId));
    }

    [HttpPost("set-trump/{lobbyId}")]
    public async Task<ActionResult<GameSessionDto>> SetTrump(string lobbyId, [FromQuery] Suit suit)
    {
        var guard = GuardLobby(lobbyId);
        if (guard is not null) return guard;
        return Ok(await _game.SetTrumpAsync(lobbyId, CallerId, suit));
    }

    [HttpPost("play-card/{lobbyId}")]
    public async Task<ActionResult<GameSessionDto>> PlayCard(string lobbyId, [FromBody] Card card)
    {
        var guard = GuardLobby(lobbyId);
        if (guard is not null) return guard;
        return Ok(await _game.PlayCardAsync(lobbyId, CallerId, card));
    }
}
