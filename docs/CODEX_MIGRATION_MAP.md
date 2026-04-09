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
| `plan` | `plan` |
| `implement` | `implement` |
| `debugme` | `debugme` |
| `test-quality-gate` | `test-quality-gate` |
| `backend-test-coverage` | `backend-test-coverage` |
| `frontend-unit-test-coverage` | `frontend-unit-test-coverage` |
| `frontend-e2e-test-coverage` | `frontend-e2e-test-coverage` |
| `e2e-user-flows-check` | `e2e-user-flows-check` |
| `new-feature-checklist` | `new-feature-checklist` |
| `methodology-setup` | `methodology-setup` |
| `git-commit` | `git-commit` |
| `git-sync` | `git-sync` |
| `deploy-staging` | `deploy-staging` |
| `deploy-and-check` | `deploy-and-check` |
| `server-diagnostic-report` | `server-diagnostic-report` |
| `fix-broken-tests` | `fix-broken-tests` |

Each Codex skill includes:

- `SKILL.md` with Codex frontmatter (`name`, `description`, and optional controls).
- `agents/openai.yaml` for UI metadata.

## 2) Workflow Equivalence (`.windsurf/workflows`)

| Windsurf workflow | Codex skill |
|---|---|
| `backend-test-coverage-goal.md` | `backend-test-coverage` |
| `debug.md` | `debugme` |
| `deploy-and-check.md` | `deploy-and-check` |
| `deploy-staging.md` | `deploy-staging` |
| `e2e-user-flows-check.md` | `e2e-user-flows-check` |
| `fix-broken-tests.md` | `fix-broken-tests` |
| `frontend-e2e-test-coverage-goal.md` | `frontend-e2e-test-coverage` |
| `frontend-unit-test-coverage-goal.md` | `frontend-unit-test-coverage` |
| `git-commit.md` | `git-commit` |
| `human.md` | `AGENTS.md` communication policy |
| `methodology-setup.md` | `methodology-setup` |
| `not-forget-fake-data-and-test.md` | `new-feature-checklist` |
| `server-diagnostic-report.md` | `server-diagnostic-report` |
| `test-quality-gate.md` | `test-quality-gate` |

## 3) Rules/Patterns Equivalence (`.windsurf/rules`)

| Windsurf rule | Codex target |
|---|---|
| `security-rules.md` | `AGENTS.md` security section |
| `testing-quality-standards.md` | `test-quality-gate` + `docs/TESTING_QUALITY_STANDARDS.md` |
| `jest-testing-rules.md` | `frontend-unit-test-coverage` + `fix-broken-tests` |
| `playwright-cursor-rules.md` | `frontend-e2e-test-coverage` + `e2e-user-flows-check` |
| `coverage-report-standard.md` | `backend-test-coverage` + `frontend-unit-test-coverage` |
| `e2e-flow-coverage-standard.md` | `frontend-e2e-test-coverage` + `e2e-user-flows-check` |
| `django-python-cursor-rules.md` | `AGENTS.md` + `implement` |
| `django-rest-api-development-rules-adnan.md` | `AGENTS.md` + `implement` |
| `tailwind-rules.md` | `AGENTS.md` + frontend implementation behavior |
| `i18n-rules.md` | `AGENTS.md` + implementation behavior |
| `seo-rules.md` | `AGENTS.md` + implementation behavior |
| `nuxtjs-vue-typescript-development-rules.md` | `AGENTS.md` + `implement` |
| `methodology/plan.md` | `plan` |
| `methodology/implement.md` | `implement` |
| `methodology/debug.md` | `debugme` |
| `methodology/memory.md` | `methodology-setup` |
| `methodology/directory-structure.md` | `methodology-setup` |
| `methodology/error-documentation.md` | `methodology-setup` + docs/methodology |
| `methodology/lessons-learned.md` | `methodology-setup` + docs/methodology |

Cross-source provenance references are embedded in:

- `methodology-setup/references/source-material.md`
- `test-quality-gate/references/source-material.md`
- `deploy-and-check/references/source-material.md`

## 4) Installation and Runtime

Repository skills are versioned in `.agents/skills/`. Codex auto-discovers them from the
repository root — no installation step required. Restart Codex after adding or modifying skills.
