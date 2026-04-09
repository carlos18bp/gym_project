# Codex Migration Map

This document tracks the equivalence between legacy assistant assets (`.claude`, `.windsurf`) and the Codex-native setup in this repository.

Canonical Codex standards are defined in:

- `AGENTS.md`
- `docs/CODEX_METHODOLOGY_GUIDE.md`
- `docs/CODEX_SETUP.md`

`CODEX_MIGRATION_MAP.md` is a compatibility/reference map, not the operational source of truth.

## 1) Skill Equivalence (`.claude/skills` -> `.agents/skills`)

| Legacy skill | Codex skill |
|---|---|
| `plan` | `gym-plan` |
| `implement` | `gym-implement` |
| `debugme` | `gym-debugme` |
| `test-quality-gate` | `gym-test-quality-gate` |
| `backend-test-coverage` | `gym-backend-test-coverage` |
| `frontend-unit-test-coverage` | `gym-frontend-unit-test-coverage` |
| `frontend-e2e-test-coverage` | `gym-frontend-e2e-test-coverage` |
| `e2e-user-flows-check` | `gym-e2e-user-flows-check` |
| `new-feature-checklist` | `gym-new-feature-checklist` |
| `methodology-setup` | `gym-methodology-setup` |
| `git-commit` | `gym-git-commit` |
| `git-sync` | `gym-git-sync` |
| `deploy-staging` | `gym-deploy-staging` |
| `deploy-and-check` | `gym-deploy-and-check` |
| `server-diagnostic-report` | `gym-server-diagnostic-report` |
| `fix-broken-tests` | `gym-fix-broken-tests` |

Each Codex skill includes:

- `SKILL.md` with Codex frontmatter (`name`, `description`, and optional controls).
- `agents/openai.yaml` for UI metadata.

## 2) Workflow Equivalence (`.windsurf/workflows`)

| Windsurf workflow | Codex target |
|---|---|
| `backend-test-coverage-goal.md` | `gym-backend-test-coverage` |
| `debug.md` | `gym-debugme` |
| `deploy-and-check.md` | `gym-deploy-and-check` |
| `deploy-staging.md` | `gym-deploy-staging` |
| `e2e-user-flows-check.md` | `gym-e2e-user-flows-check` |
| `fix-broken-tests.md` | `gym-fix-broken-tests` |
| `frontend-e2e-test-coverage-goal.md` | `gym-frontend-e2e-test-coverage` |
| `frontend-unit-test-coverage-goal.md` | `gym-frontend-unit-test-coverage` |
| `git-commit.md` | `gym-git-commit` |
| `human.md` | `AGENTS.md` communication policy |
| `methodology-setup.md` | `gym-methodology-setup` |
| `not-forget-fake-data-and-test.md` | `gym-new-feature-checklist` |
| `server-diagnostic-report.md` | `gym-server-diagnostic-report` |
| `test-quality-gate.md` | `gym-test-quality-gate` |

## 3) Rules/Patterns Equivalence (`.windsurf/rules`)

| Windsurf rule | Codex target |
|---|---|
| `security-rules.md` | `AGENTS.md` security section |
| `testing-quality-standards.md` | `gym-test-quality-gate` + `docs/TESTING_QUALITY_STANDARDS.md` |
| `jest-testing-rules.md` | `gym-frontend-unit-test-coverage` + `gym-fix-broken-tests` |
| `playwright-cursor-rules.md` | `gym-frontend-e2e-test-coverage` + `gym-e2e-user-flows-check` |
| `coverage-report-standard.md` | `gym-backend-test-coverage` + `gym-frontend-unit-test-coverage` |
| `e2e-flow-coverage-standard.md` | `gym-frontend-e2e-test-coverage` + `gym-e2e-user-flows-check` |
| `django-python-cursor-rules.md` | `AGENTS.md` + `gym-implement` |
| `django-rest-api-development-rules-adnan.md` | `AGENTS.md` + `gym-implement` |
| `tailwind-rules.md` | `AGENTS.md` + frontend implementation behavior |
| `i18n-rules.md` | `AGENTS.md` + implementation behavior |
| `seo-rules.md` | `AGENTS.md` + implementation behavior |
| `nuxtjs-vue-typescript-development-rules.md` | `AGENTS.md` + `gym-implement` |
| `methodology/plan.md` | `gym-plan` |
| `methodology/implement.md` | `gym-implement` |
| `methodology/debug.md` | `gym-debugme` |
| `methodology/memory.md` | `gym-methodology-setup` |
| `methodology/directory-structure.md` | `gym-methodology-setup` |
| `methodology/error-documentation.md` | `gym-methodology-setup` + docs/methodology |
| `methodology/lessons-learned.md` | `gym-methodology-setup` + docs/methodology |

Cross-source provenance references are embedded in:

- `gym-methodology-setup/references/source-material.md`
- `gym-test-quality-gate/references/source-material.md`
- `gym-deploy-and-check/references/source-material.md`

## 4) Installation and Runtime

Repository skills are versioned in `.agents/skills/` and installed into Codex discovery path via:

```bash
scripts/install-codex-skills.sh --force --remove-stale
```

Default destination is `~/.agents/skills`.
After installation, restart Codex to reload skills.
If `~/.codex/skills/gym-*` exists, treat it as legacy duplicate state and clean it after verifying `~/.agents/skills`.
