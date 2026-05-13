# ADR-00001: Use ADRs for significant engineering decisions

## Status

Accepted

## Context

Chat-Box is developed primarily by AI agents and a solo founder. Without written decisions, agents may re-litigate stack choices (ORM, bus, hosting) and produce inconsistent PRs.

## Decision

Adopt lightweight Markdown ADRs under `docs/adr/` for any significant, hard-to-reverse engineering decision. Each ADR is numbered sequentially and linked from the implementing PR.

## Options considered

- **Wiki only** — Rejected: not versioned with code, poor for AI context.
- **Long architecture doc edits only** — Rejected: noisy history, hard to find one decision.
- **ADRs in-repo** — Accepted: PR-reviewable, grep-friendly, portable.

## Consequences

- **Positive:** Clear rationale for onboarding humans and agents.
- **Negative:** Small overhead to write ADRs; must enforce in PR template.
- **Risks:** ADR drift if not updated when superseded — mitigate with status field.

## Links

- [`13-ARCHITECTURE-DECISION-RECORDS.md`](../13-ARCHITECTURE-DECISION-RECORDS.md)
