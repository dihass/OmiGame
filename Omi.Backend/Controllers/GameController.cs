using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Omi.Backend.Core.Domain.Entities;
using Omi.Backend.Core.Domain.Enums;
using Omi.Backend.Core.Domain.ValueObjects;
using Omi.Backend.Core.Interfaces;
using Omi.Backend.Infrastructure.Realtime;

namespace Omi.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController : ControllerBase
{
    private readonly IStateRepository<GameSession> _repository;
    private readonly IHubContext<GameHub> _hubContext;

    public GameController(IStateRepository<GameSession> repository, IHubContext<GameHub> hubContext)
    {
        _repository = repository;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Creates a brand new stateless game session room.
    /// </summary>
    [HttpPost("create/{lobbyId}")]
    public async Task<IActionResult> CreateRoom(string lobbyId)
    {
        var session = await _repository.GetAsync(lobbyId);
        if (session != null)
        {
            return BadRequest("Room already exists.");
        }

        session = new GameSession
        {
            LobbyId = lobbyId,
            Phase = GamePhase.Lobby
        };

        await _repository.SetAsync(lobbyId, session);
        return Ok(session);
    }

    /// <summary>
    /// Seats a player inside an active room lobby.
    /// </summary>
    [HttpPost("join/{lobbyId}")]
    public async Task<IActionResult> JoinRoom(string lobbyId, [FromBody] PlayerRegistrationDto request)
    {
        var session = await _repository.GetAsync(lobbyId);
        if (session == null) return NotFound("Room not found.");
        if (session.Phase != GamePhase.Lobby) return BadRequest("Game has already started.");
        if (session.Players.Count >= 4) return BadRequest("Room lobby is completely full.");
        if (session.Players.Any(p => p.PlayerId == request.PlayerId)) return BadRequest("Player already joined.");

        var newPlayer = new Player
        {
            PlayerId = request.PlayerId,
            DisplayName = request.DisplayName,
            SeatIndex = session.Players.Count
        };

        session.Players.Add(newPlayer);
        await _repository.SetAsync(lobbyId, session);

        // Broadcast to SignalR Group
        await _hubContext.Clients.Group(lobbyId).SendAsync("LobbyUpdated", session);

        return Ok(session);
    }

    /// <summary>
    /// Starts the game round and triggers dealing phase 1.
    /// </summary>
    [HttpPost("start/{lobbyId}")]
    public async Task<IActionResult> StartRound(string lobbyId)
    {
        var session = await _repository.GetAsync(lobbyId);
        if (session == null) return NotFound("Room not found.");

        try
        {
            session.StartRound(); // Transitions to TrumpSelection internally
            await _repository.SetAsync(lobbyId, session);

            await _hubContext.Clients.Group(lobbyId).SendAsync("RoundStarted", session);
            return Ok(session);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Assigns the trump suit choice for the current round loop.
    /// </summary>
    [HttpPost("set-trump/{lobbyId}")]
    public async Task<IActionResult> SetTrump(string lobbyId, [FromQuery] int seatIndex, [FromQuery] Suit suit)
    {
        var session = await _repository.GetAsync(lobbyId);
        if (session == null) return NotFound("Room not found.");

        try
        {
            session.SetTrump(seatIndex, suit);
            await _repository.SetAsync(lobbyId, session);

            await _hubContext.Clients.Group(lobbyId).SendAsync("TrumpSelected", session);
            return Ok(session);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Executes a dynamic active gameplay card step evaluation.
    /// </summary>
    [HttpPost("play-card/{lobbyId}")]
    public async Task<IActionResult> PlayCard(string lobbyId, [FromQuery] int seatIndex, [FromBody] Card card)
    {
        var session = await _repository.GetAsync(lobbyId);
        if (session == null) return NotFound("Room not found.");

        try
        {
            session.PlayCard(seatIndex, card);
            await _repository.SetAsync(lobbyId, session);

            await _hubContext.Clients.Group(lobbyId).SendAsync("CardPlayed", session);
            return Ok(session);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}

public record PlayerRegistrationDto(string PlayerId, string DisplayName);