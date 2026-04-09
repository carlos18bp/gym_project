# Codex Setup

Skills in `.agents/skills/` are auto-discovered by Codex when run from within the repository.
No installation step is required.

## 1. Validate skill compliance

```bash
scripts/check-codex-skills.sh
```

## 2. Restart Codex

Restart the Codex client/session after adding or modifying skills.

## 3. Source of truth

- Global project guardrails: `AGENTS.md`
- Canon methodology and workflow standard: `docs/CODEX_METHODOLOGY_GUIDE.md`
- Legacy-to-Codex parity map: `docs/CODEX_MIGRATION_MAP.md`
- Codex skills source: `.agents/skills/`
