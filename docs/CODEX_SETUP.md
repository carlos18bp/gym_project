# Codex Setup

## 1. Install repo-managed skills

From repository root:

```bash
scripts/install-codex-skills.sh --force --remove-stale
```

Optional preview:

```bash
scripts/install-codex-skills.sh --dry-run
```

## 2. Validate skill compliance

```bash
scripts/check-codex-skills.sh
```

## 3. Restart Codex

Restart the Codex client/session so new skills are loaded from `${CODEX_HOME:-~/.codex}/skills`.

## 4. Verify installed skills

```bash
find "${CODEX_HOME:-$HOME/.codex}/skills" -maxdepth 1 -type l -name "gym-*" | sort
```

## 5. Source of truth

- Global project guardrails: `AGENT.md`
- Canon methodology and workflow standard: `docs/CODEX_METHODOLOGY_GUIDE.md`
- Contributor conventions: `AGENTS.md`
- Legacy-to-Codex parity map: `docs/CODEX_MIGRATION_MAP.md`
- Codex skills source: `.agents/skills/`
