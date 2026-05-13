<!--
Chat-Box — PR body template (aligned with docs/09-AI-AGENT-GUIDE.md).
Delete HTML comments before merge if you prefer a clean public view.
-->

## Role & scope

```text
PRIMARY_ROLE: ENGINEERING
RELATED_DOCS: 05-API-SPEC.md
MVP_LABEL: MVP
TEST: pnpm test --filter …
ROLLBACK: revert commit / migration down / feature flag KEY
```

| Field | Value |
|--------|--------|
| **PRIMARY_ROLE** | One of: `PRODUCT`, `UX_CONTENT`, `ENGINEERING`, `AI_ML`, `SECURITY`, `DEVOPS`, `GTM_MARKETING`, `LEGAL_COMPLIANCE`, `SUPPORT_CS` — see [`docs/00-GOVERNANCE-ROLES.md`](../docs/00-GOVERNANCE-ROLES.md) |
| **RELATED_DOCS** | Numbered docs touched (e.g. `05-API-SPEC.md`, `04-DATABASE-SCHEMA.md`) |
| **MVP_LABEL** | `MVP` or `Phase 2` or `North Star` (per [`docs/08-ROADMAP.md`](../docs/08-ROADMAP.md)) |
| **TEST** | Command(s) you ran, or `TEST_DEFERRED` + reason + tracking issue |
| **ROLLBACK** | How to undo safely (revert, migration, flag) |

## Summary

<!-- What changed and why (for humans). -->

## Checklist

- [ ] One primary role; no mixed product + engineering scope without `EXCEPTION` (see governance)
- [ ] No secrets committed; only `.env.example` / placeholders for env
- [ ] If `docs/*.md` changed: regenerate paired HTML when applicable (`python docs/scripts/build_doc_html.py <STEM>`)
- [ ] If roadmap phase completed: update [`docs/16-DEVELOPMENT-STATUS.md`](../docs/16-DEVELOPMENT-STATUS.md)
