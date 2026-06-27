# Omi Build Story

This is the story version of the Omi backend. The technical manual is the map. This page is the road trip.

Imagine you are a first-year student opening this project and thinking: "Okay cool, multiplayer game engine, but where do I even start?" This page is for that moment. We are going to walk from the first idea all the way to deployment, without pretending everything was obvious from day one.

## The Idea

The goal was simple to say and secretly not simple to build:

> Let four people play Omi online, in real time, without cheating, broken turns, or leaked cards.

That sentence already contains most of the backend architecture.

Four people means we need lobbies. Online means we need networking. Real time means players must see updates instantly. No cheating means the server, not the browser, must decide whether a move is legal. No leaked cards means public game state and private hand state must be handled differently.

So the backend is not just "save a card and send a message." It is a tiny game referee living on the server.

## Chapter 1: Start With The Rules, Not The Network

The first big lesson: do not start a multiplayer game by thinking about WebSockets.

That sounds backwards, because multiplayer feels like a networking problem. But the actual heart of the project is the game state:

- Who are the players?
- Whose turn is it?
- What phase is the game in?
- What cards does each player hold?
- What is trump?
- Who won the trick?
- Did the round end?
- Did the match end?

That is why the most important file is:

```text
src/Omi.Domain/Entities/GameSession.cs
```

This file is the game brain. It does not care about HTTP, SignalR, React, Redis, or deployment. It only cares about Omi.

The best early move was putting rules into the domain layer. That gave the project a clean center of gravity. Once the rules worked in plain C#, the rest of the app could wrap around them.

## Chapter 2: Build A Tiny Universe Called `GameSession`

`GameSession` is basically one lobby's universe.

It remembers:

- the lobby id
- the current phase
- the four players
- the dealer
- the current turn
- trump suit
- current trick
- tricks won by each team
- match points
- carried points
- round history

At first glance, that looks like a lot of fields. But for a turn-based card game, this is actually pretty neat. Everything important about a match lives in one object.

That means when someone plays a card, we can ask one object:

```text
"Hey GameSession, is this legal?"
```

And `GameSession` can answer with authority.

## Chapter 3: Phases Are The Game's Traffic Lights

The backend uses `GamePhase` to stop players from doing random things at random times.

The phases are:

```text
Lobby
DealingPhase1
TrumpSelection
DealingPhase2
Playing
RoundSummary
MatchCompleted
```

Think of phases as traffic lights.

In `Lobby`, joining is okay. Playing a card is not okay.

In `TrumpSelection`, choosing trump is okay. Playing a card is not okay.

In `Playing`, playing cards is okay. Choosing trump again is not okay.

This is one of those patterns that looks basic but saves the whole game from nonsense. Without phases, the backend becomes a pile of "wait, should this be allowed right now?" checks scattered everywhere.

## Chapter 4: Dealing The Cards

Omi uses a 32-card deck:

```text
Seven, Eight, Nine, Ten, Jack, Queen, King, Ace
in Hearts, Diamonds, Clubs, Spades
```

The `Deck` object creates those cards and shuffles them.

The shuffle uses a secure random number generator. That might sound extra for a student project, but for a card game, predictable shuffle equals cooked game. If someone can guess the deck order, the game is basically over.

The round starts with a half-deal:

1. Every player gets 4 cards.
2. The player after the dealer chooses trump.
3. Everyone gets 4 more cards.
4. Play begins.

That split is not just implementation detail. It is part of Omi's personality. The selector chooses trump without seeing the full hand, which adds risk and drama.

## Chapter 5: Trump Selection Is A Permission Check

Only one player can choose trump.

The backend calculates that player like this:

```text
(CurrentDealerIndex + 1) % 4
```

The `% 4` part wraps the seat number back to `0` after seat `3`. So if the dealer is seat `3`, the selector is seat `0`.

This small formula is doing a lot:

- keeps turn order circular
- prevents random players choosing trump
- matches table seating logic

This is the kind of code that looks tiny but represents a real game rule.

## Chapter 6: Playing A Card Is Not Just "Remove Card From Hand"

When a player clicks a card, the server does not just trust them.

The backend checks:

1. Is the game actually in `Playing` phase?
2. Is this player the current turn?
3. Does this player actually have that card?
4. If a suit was led, does this player need to follow suit?

Only after all of that does the card get removed from the hand and added to the current trick.

This is server-authoritative design in action. The client can be pretty and helpful, but the backend is the referee.

Why so strict? Because browsers are not trusted. A curious user can open dev tools, edit requests, or call APIs manually. The server has to be the final boss of validation.

## Chapter 7: Following Suit

Following suit is one of the most important rules.

If the first card in a trick is Spades, every other player must play Spades if they have one.

So the backend asks:

```text
Did the player play the led suit?
If not, does their hand contain the led suit?
If yes, reject the play.
```

That rule lives in `GameSession.PlayCard()`.

This is also why the server must know each player's hand. If the client alone decided legality, a cheater could simply say, "trust me, I had no Spades." The server says, "nice try, I can literally see your hand."

## Chapter 8: Resolving A Trick

After four cards are played, the backend resolves the trick.

The logic is:

1. Start with the first card as the current winner.
2. Compare each next card.
3. Trump beats non-trump.
4. Higher trump beats lower trump.
5. If no trump is involved, highest led-suit card wins.
6. Off-suit non-trump cards cannot win.

Then the winning seat gets the trick point for their team.

The team logic is currently seat-based:

```text
Even seats: Team A
Odd seats: Team B
```

So seats `0` and `2` are partners, and seats `1` and `3` are partners.

Is that simple? Yes.

Is it something future-you should remember if custom seating gets added? Also yes.

## Chapter 9: Scoring The Round

A round has 8 tricks because every player starts with 8 cards.

At the end:

| Tricks Won | Score |
| --- | --- |
| 5 or 6 | 1 point |
| 7 | 2 points |
| 8 | 3 points |
| 4-4 | carry 1 point |

The 4-4 draw is spicy because nobody scores immediately. Instead, one carried point waits for the next non-draw winner.

So if Team A and Team B draw 4-4, then Team A wins the next round 5-3, Team A gets:

```text
1 normal point + 1 carried point = 2 points
```

The backend tracks that with `CarriedPoints`.

## Chapter 10: Why We Needed An Application Layer

At this point, `GameSession` knows the rules. But it should not know about Redis or SignalR.

That is where `GameService` enters.

`GameService` is the organizer. It does the use-case flow:

```text
lock lobby
load session
find player
call domain method
save session
send realtime notification
unlock lobby
```

This is why controllers stay small. A controller receives an HTTP request, checks basic auth/lobby stuff, then hands the real work to `GameService`.

This separation is low-key one of the biggest wins in the codebase.

## Chapter 11: Why Redis Shows Up

At first, you might think: "Why not just store game sessions in memory?"

For local testing, memory would work. But multiplayer apps have annoying realities:

- the server can restart
- the app can run on multiple instances
- SignalR connections can move around
- lobbies should expire eventually
- two requests can hit at almost the same time

Redis solves the active-game-state problem nicely.

The backend stores each lobby session as JSON in Redis. It also gives the session a TTL, so forgotten lobbies do not live forever.

Redis is not being used as permanent history. It is more like a fast shared memory layer for live games.

## Chapter 12: The Race Condition Problem

Here is a classic multiplayer bug:

```text
Player A plays a card.
Player B somehow sends a request at almost the same time.
Both requests load the same old game state.
Both mutate it.
Both save.
One update overwrites the other.
The game is now cursed.
```

This is why the backend uses a per-lobby distributed lock.

Before changing a lobby, `GameService` acquires a Redis lock for that lobby id. Only one mutation can happen at a time.

This matters even in a turn-based game. Actually, especially in a turn-based game, because order is everything.

## Chapter 13: Realtime Without Trusting Realtime

The project uses SignalR for realtime events.

But here is the important design choice:

```text
HTTP changes the game.
SignalR tells everyone what changed.
```

SignalR is not the main command system. Players do not directly mutate game state through hub methods. They call HTTP endpoints like:

```text
POST /api/game/play-card/{lobbyId}
```

Then the server broadcasts events like:

```text
CardPlayed
TrumpSelected
RoundStarted
HandDealt
```

This split makes the backend easier to debug. HTTP endpoints are easier to test, rate-limit, and secure. SignalR stays focused on delivery.

## Chapter 14: The Hand Privacy Plot Twist

Card games have one rule that is not negotiable:

> Do not leak hands.

The backend has two kinds of messages:

| Message Type | Who Gets It | Contains Hands? |
| --- | --- | --- |
| Lobby broadcast | everyone in the lobby | no |
| Personal message | one player group | yes, only that player's hand |

`GameSessionDto` intentionally excludes hands and remaining deck.

When cards need to be sent, the backend sends `HandDealt` to:

```text
player:{playerId}
```

That means every player receives only their own hand.

This is a great example of backend design protecting gameplay. The UI cannot accidentally hide what it never receives.

## Chapter 15: Reconnects Are Sneakier Than They Look

Realtime apps have this very normal problem:

User refreshes the page.

Old socket disconnects.

New socket connects.

For a moment, the server might think the player left.

If we instantly closed the lobby, refreshing the page would destroy the match. Not ideal. Very uncool.

So the backend tracks connections in Redis:

```text
connection id -> player/lobby
player/lobby -> set of active connections
```

If a player has multiple tabs open, closing one tab does not mark them disconnected. If all connections disappear, the backend marks the player disconnected and starts a short grace period.

There are two delayed jobs:

| Delay | Action |
| --- | --- |
| 2 seconds | announce disconnect if still gone |
| 10 seconds | close lobby if still gone |

This is a practical compromise. It absorbs fast refreshes but does not leave broken games open forever.

## Chapter 16: Auth Without Full Accounts

This project does not need full user accounts yet.

Instead, the backend creates a JWT for a player joining a lobby. The token contains:

- player id
- lobby id
- display name

That token scopes the player to one lobby. So if someone has a token for lobby `ABC123`, they cannot use it to play in lobby `XYZ999`.

The controller checks this with `GuardLobby()`.

This is simple, but it gives the backend a real identity boundary.

## Chapter 17: The API Layer

The HTTP API is the front door.

The main endpoints are:

| Endpoint | What It Does |
| --- | --- |
| `/api/lobby/auth` | creates a JWT for a lobby identity |
| `/api/game/create/{lobbyId}` | creates a room |
| `/api/game/join/{lobbyId}` | joins the room |
| `/api/game/start/{lobbyId}` | starts the round |
| `/api/game/set-trump/{lobbyId}` | selects trump |
| `/api/game/play-card/{lobbyId}` | attempts to play a card |
| `/api/game/leave/{lobbyId}` | leaves or closes the active lobby |

Each endpoint should feel boring. That is good. Boring controllers usually mean the architecture is doing its job.

## Chapter 18: Error Handling So The App Does Not Panic

Game actions fail all the time:

- wrong turn
- invalid card
- room full
- lobby not found
- token expired
- someone tried to pick trump at the wrong time

Instead of random exceptions leaking everywhere, the backend has exception middleware.

That middleware turns known errors into JSON responses like:

```json
{
  "error": "It is not this player's turn."
}
```

This is better for the frontend and better for humans debugging the app.

## Chapter 19: Tests Are The Safety Net

The strongest tests right now are domain tests.

That is exactly where the first tests should be, because game rules are the most expensive thing to get wrong.

The tests prove things like:

- you need 4 players
- trump selector is enforced
- wrong turns are rejected
- follow-suit is enforced
- trump wins correctly
- scoring works
- dealer rotates
- match completion happens

This is the best kind of test suite for a game engine: small, fast, and aimed directly at the rules.

## Chapter 20: What Happens When A Player Clicks A Card

Here is the full journey.

Player clicks a card in React.

The client calls:

```text
POST /api/game/play-card/{lobbyId}
```

The backend:

1. Validates the JWT.
2. Confirms the token belongs to that lobby.
3. Rate-limits the action.
4. Acquires the Redis lobby lock.
5. Loads the `GameSession`.
6. Finds the player by `playerId`.
7. Calls `GameSession.PlayCard()`.
8. The domain validates turn, card ownership, and follow-suit.
9. The card is added to the trick.
10. If four cards are present, the trick resolves.
11. If eight tricks are done, the round scores.
12. The session is saved back to Redis.
13. A hand-less `CardPlayed` event goes to the lobby.
14. The client updates the table.

That is the whole stack doing one clean move.

## Chapter 21: Local Development

To run this locally, you need the backend, Redis, and the frontend.

The repo includes Docker Compose for the backend and Redis:

```text
docker-compose up
```

The frontend is a Vite app:

```text
cd Omi.Client
npm install
npm run dev
```

In development, Vite proxies:

```text
/api -> backend
/ws  -> backend SignalR
```

That means the frontend can call relative URLs without hardcoding the backend origin.

## Chapter 22: Preparing For Deployment

Deployment adds a new set of questions:

- Where does the API run?
- Where does Redis live?
- What frontend URL is allowed by CORS?
- What signing key is used for JWTs?
- Does SignalR need a managed backplane?
- How does the platform know the app is healthy?

The backend is Dockerized with `Dockerfile`.

The frontend is configured for Vercel with `Omi.Client/vercel.json`.

The backend also has `render.yaml`, which describes a Render web service.

## Chapter 23: Backend Deployment Story

The backend deploys as a Docker container.

The Dockerfile does the classic multi-stage build:

1. Use a .NET SDK image to restore/build/publish.
2. Copy the published app into a smaller runtime image.
3. Run as a non-root user.
4. Start `Omi.Api.dll`.

That matters because deployment should not ship the whole SDK if the app only needs the runtime.

The backend needs environment variables:

| Variable | Why |
| --- | --- |
| `ConnectionStrings__Redis` | tells the app where Redis is |
| `Jwt__SigningKey` | signs tokens |
| `Jwt__Issuer` | token issuer validation |
| `Jwt__Audience` | token audience validation |
| `Cors__AllowedOrigins__0` | allows the deployed frontend |

The health check lives at:

```text
/healthz
```

It checks Redis, because if Redis is down, active games cannot work.

## Chapter 24: Frontend Deployment Story

The frontend is a Vite static app.

During production build, Vite turns React/TypeScript into static files in:

```text
dist/
```

Vercel serves that folder.

Because this is a client-side app, deep routes like `/docs` need to return `index.html`. That is why `vercel.json` has a rewrite:

```json
{
  "source": "/(.*)",
  "destination": "/index.html"
}
```

Without that, typing `/docs` directly could produce a 404. With the rewrite, Vercel serves React, and React decides that `/docs` means the docs page.

For API calls in production, the frontend uses:

```text
VITE_API_URL
```

That points at the deployed backend.

## Chapter 25: CORS, The Classic Deployment Boss Fight

When the frontend and backend live on different domains, the browser asks:

> Is this frontend allowed to call this backend?

That is CORS.

The backend reads allowed origins from config:

```text
Cors__AllowedOrigins__0=https://your-frontend-url.vercel.app
```

If this is wrong, the backend might be perfectly fine, the frontend might be perfectly fine, and the browser still blocks everything.

That is not the app being broken. That is the browser doing security.

Annoying? Yes.

Important? Also yes.

## Chapter 26: Redis In Production

In local dev, Redis can be a Docker container.

In production, Redis should be managed. The current deployment notes mention Upstash-style Redis connection strings.

The important part is that Redis must support:

- string get/set for sessions
- sets for connection tracking
- key expiry
- basic Lua script execution for safe lock release

If Redis is slow or unavailable, the game will feel broken because every action depends on it.

## Chapter 27: Optional Azure SignalR

The backend supports Azure SignalR if a connection string is configured.

Why would that matter?

If one backend instance is running, normal SignalR can work.

If multiple backend instances are running, realtime messages need a shared backplane so all connected clients get the right broadcasts. Azure SignalR can handle that.

For a small MVP, you can keep this optional. For scaling, it becomes more important.

## Chapter 28: What I Would Tell My First-Year Self

Do not try to understand the whole app at once.

Read it in this order:

1. `Card`, `Suit`, and `Rank`
2. `Deck`
3. `Player`
4. `GameSession`
5. `GameSessionTests`
6. `GameService`
7. `GameController`
8. `GameHub`
9. Redis repositories
10. `Program.cs`

That path moves from simple to complex. You start with one card, then a deck, then a player, then a game, then the network.

That is way less overwhelming than opening `Program.cs` first and wondering why the app is talking about CORS, rate limiting, JWTs, SignalR, Redis, health checks, and forwarded headers before you even know how a trick works.

## Chapter 29: The Biggest Lessons

### Keep The Rules Pure

The rules should be easy to test without a browser.

That is why `GameSession` is so important.

### Trust The Server

The client is for UX. The server is for truth.

That one sentence is the whole multiplayer security model.

### Make Private Data Actually Private

Do not send all hands to the client and hope the UI hides them.

Only send each player their own hand.

### Think About Disconnects Early

Realtime apps are not just "connected" or "disconnected." They are full of refreshes, duplicate tabs, stale sockets, and mobile network weirdness.

### Deployment Is Part Of The App

CORS, environment variables, Redis URLs, health checks, and rewrites are not boring side quests. They are what make the app survive outside localhost.

## The Whole Story In One Breath

We built Omi by first making the game rules live in a pure domain model. Then we wrapped those rules in an application service that locks a lobby, loads state from Redis, applies one legal move, saves the result, and notifies players through SignalR. HTTP endpoints became the command surface, JWTs scoped each player to a lobby, Redis became the shared state and coordination layer, and private hand delivery stayed separate from public broadcasts. Finally, Docker, Render config, Vercel rewrites, environment variables, CORS, and health checks turned the local game into something deployable.

That is the project.

Not magic. Just a lot of small decisions stacked in the right order.
