# Codex Agent Assets

This directory contains repository-managed Codex assets.

## Skills

- Skills are stored in `.agents/skills/gym-*/`.
- Each skill includes:
  - `SKILL.md`
  - `agents/openai.yaml`
- `.agents/skills/` is the repository source of truth; install the skills into the global Codex discovery path at `~/.agents/skills`.
- If legacy duplicates exist in `~/.codex/skills/gym-*`, treat them as cleanup targets after verifying the links in `~/.agents/skills`.

Install skills into Codex discovery path:

```bash
scripts/install-codex-skills.sh --force --remove-stale
scripts/check-codex-skills.sh
```

See:

- `docs/CODEX_METHODOLOGY_GUIDE.md`
- `docs/CODEX_SETUP.md`
- `docs/CODEX_MIGRATION_MAP.md`
