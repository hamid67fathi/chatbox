# Branching & merge policy — Chat-Box

> **Audience:** Humans + AI agents working in this repo.  
> **Related:** [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md).

## Default branch

- **`main`** is the integration branch for reviewed work.

## Naming convention

| Prefix | Use for |
|--------|---------|
| `feat/` | New user-visible behaviour or API |
| `fix/` | Bug fixes |
| `chore/` | Tooling, deps, housekeeping |
| `docs/` | Documentation-only changes |
| `refactor/` | Behaviour-preserving code structure changes |

Include a short slug after the prefix (ticket id optional): `feat/42-widget-bundle-size`.

## Merge strategy

- **Squash merge** into `main` is recommended for a linear history and cleaner revert story.
- Use a **merge commit** only when you intentionally need to preserve branch topology (rare).

## Protected branch (recommended on GitHub)

When the repo settings allow it:

- Require PR reviews before merge to `main`.
- Require status checks (CI) to pass before merge.

## Release branches (later)

- Optional `release/x.y` branches can be introduced with Product/DevOps agreement; document in an ADR when that happens.
