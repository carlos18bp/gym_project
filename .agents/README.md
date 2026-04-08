# Codex Agent Assets

This directory contains repository-managed Codex assets.

## Skills

- Skills are stored in `.agents/skills/gym-*/`.
- Each skill includes:
  - `SKILL.md`
  - `agents/openai.yaml`

Install skills into Codex discovery path:

```bash
scripts/install-codex-skills.sh --force --remove-stale
scripts/check-codex-skills.sh
```

See:

- `docs/CODEX_METHODOLOGY_GUIDE.md`
- `docs/CODEX_SETUP.md`
- `docs/CODEX_MIGRATION_MAP.md`
