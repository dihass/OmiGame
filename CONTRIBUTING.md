# Contributing to Omi

Thanks for considering a contribution. This project is licensed under **AGPL-3.0** — by submitting a contribution, you agree it will be distributed under that same license.

## Getting set up

See the [README](README.md#running-locally) for local setup (Docker for backend + Redis, `npm run dev` for the client).

## Workflow

1. Fork the repo and create a branch off `main` (`feature/short-description` or `fix/short-description`).
2. Make your change. Keep PRs focused — one fix or feature per PR is easier to review than a bundle of unrelated changes.
3. Run tests locally before opening a PR:
   ```bash
   dotnet test
   cd Omi.Client && npm run lint
   ```
4. Open a PR against `main`. The CI checks (build, test, Docker build) must pass, and at least one review is required before merge — this is enforced automatically.
5. Describe *why* the change is needed in the PR description, not just what changed.

## Code style

- Backend: standard .NET/C# conventions, matching the existing layered structure (`Omi.Domain` → `Omi.Application` → `Omi.Infrastructure` → `Omi.Api`). Domain logic stays free of infrastructure concerns.
- Frontend: TypeScript, functional React components, Tailwind for styling. Run `npm run lint` before submitting.
- No commented-out code, no unrelated formatting-only diffs mixed into functional changes.

## Reporting bugs / requesting features

Use the issue templates. For security vulnerabilities, do **not** open a public issue — see [SECURITY.md](SECURITY.md).

## Questions

Open a discussion or issue if anything about the setup or architecture is unclear.
