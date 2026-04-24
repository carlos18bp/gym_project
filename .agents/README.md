# Codex Agent Assets

This directory contains repository-managed Codex skills for the GM Consultores Juridicos project.

## Skills

Skills are stored in `.agents/skills/<skill-name>/`. Each skill includes:
- `SKILL.md` — skill instructions and frontmatter (`name`, `description`, optional controls)
- `agents/openai.yaml` — UI metadata (`display_name`, `short_description`)

Codex auto-discovers skills from `.agents/skills/` when run from within the repository — no installation step required.

Validate skill structure:

```bash
scripts/check-codex-skills.sh
```

## Available Skills

### Base Skills

| Skill | Description |
|---|---|
| `plan` | Planning workflow before coding |
| `implement` | Systematic implementation with dependency analysis |
| `debugme` | Read-only diagnosis — no code changes |
| `methodology-setup` | Initialize or refresh Memory Bank files |
| `test-quality-gate` | Raise the test quality gate score |
| `backend-test-coverage` | Increase pytest coverage |
| `frontend-unit-test-coverage` | Increase Jest unit coverage |
| `frontend-e2e-test-coverage` | Increase Playwright flow coverage |
| `e2e-user-flows-check` | Audit coverage gaps against all product flows |
| `new-feature-checklist` | Validate fake data and tests for new features |
| `fix-broken-tests` | Fix a specific list of failing tests |

### Operational Skills (manual-only)

| Skill | Description |
|---|---|
| `git-commit` | Stage, commit, and push changes |
| `git-sync` | Fetch, pull, and rebase current branch |
| `deploy-staging` | Deploy a release branch to staging |
| `deploy-and-check` | Deploy to production with pre/post checks |
| `server-diagnostic-report` | Run 13-phase server diagnostic |

See `docs/CODEX_SETUP.md` for installation details and `docs/CODEX_METHODOLOGY_GUIDE.md` for usage.
