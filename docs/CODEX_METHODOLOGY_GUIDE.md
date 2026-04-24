# Codex Methodology and Memory Bank Guide

This is the canonical methodology guide for Codex in this repository.

## 1) Canon and Precedence

When sources disagree, apply this order:

1. `AGENTS.md` (project-wide guardrails and operating policy)
2. `docs/CODEX_METHODOLOGY_GUIDE.md` (this document)
3. `docs/CODEX_SETUP.md` (runtime setup and installation)
4. `.agents/skills/*/SKILL.md` (workflow-specific behavior)
5. Legacy references (`.claude/`, `.windsurf/`) for historical traceability only

Legacy assets are not normative for day-to-day Codex operation.

## 2) Memory Bank Model

The Memory Bank is persistent project context used across sessions. The required core files are:

1. `docs/methodology/product_requirement_docs.md`
2. `docs/methodology/technical.md`
3. `docs/methodology/architecture.md`
4. `tasks/tasks_plan.md`
5. `tasks/active_context.md`
6. `docs/methodology/error-documentation.md`
7. `docs/methodology/lessons-learned.md`

Primary workflows:

- Planning: `plan`
- Implementation: `implement`
- Debug (read-only): `debugme`

Memory refresh workflow:

- `methodology-setup`

## 3) Codex Skill Contract (Hard Requirements)

Every repository skill under `.agents/skills/` must satisfy:

- Folder name equals `name` in `SKILL.md` frontmatter.
- `SKILL.md` must define:
  - `name`
  - `description`
- `agents/openai.yaml` must exist with:
  - `interface.display_name`
  - `interface.short_description`
- Skill instructions must be Codex-native (no `/project:*` command dependency).

Safety controls:

- Manual-only skills must set `disable-model-invocation: true`.
- Manual-only skills must set `allowed-tools` to the minimum required set.
- Project manual-only set:
  - `git-commit`
  - `git-sync`
  - `deploy-staging`
  - `deploy-and-check`
  - `server-diagnostic-report`

## 4) Skill Taxonomy

Taxonomy criterion: **base = model-invokable** (implicit or explicit), **operational = manual-only** (require `disable-model-invocation: true` and explicit user intent).

Shared base skills (methodology, quality, and fix work — model-invokable):

- `plan`
- `implement`
- `debugme`
- `methodology-setup`
- `test-quality-gate`
- `backend-test-coverage`
- `frontend-unit-test-coverage`
- `frontend-e2e-test-coverage`
- `e2e-user-flows-check`
- `new-feature-checklist`
- `fix-broken-tests`

Operational skills (manual-only — git and deploy/diagnostic flows):

- `git-commit`
- `git-sync`
- `deploy-staging`
- `deploy-and-check`
- `server-diagnostic-report`

## 5) Invocation Model in Codex

Codex supports three ways to invoke a skill (per `developers.openai.com/codex/skills`):

1. **Implicit** — Codex auto-selects a skill when the user's prompt matches its `description`. Disabled per-skill when `disable-model-invocation: true` is set in frontmatter (all manual-only skills).
2. **Explicit via slash menu** — Type `/` in the composer; skills appear in the autocomplete alongside built-in commands. Examples: `/plan`, `/implement`, `/debugme`. The built-in `/skills` command opens a searchable picker of all available skills.
3. **Explicit via mention** — Type `$skill-name` to mention a skill directly inside a longer prompt.

Typical usage in this repo:

- `/plan` — plan a feature or approach before coding
- `/implement` — systematic multi-file implementation
- `/debugme` — read-only diagnosis of a bug or error
- `/deploy-staging branch release/april-2026-c` — deploy a release branch

For deploy and git operations, explicit user intent is mandatory — these skills are manual-only and never auto-invoked.

## 6) Runtime Setup

Skills in `.agents/skills/` are auto-discovered by Codex from the repository root — no installation needed.

Validate compliance:

```bash
scripts/check-codex-skills.sh
```

Restart Codex after adding or modifying skills.

## 6b) Project Configuration

Project-scoped Codex defaults are defined in `.codex/config.toml`:

| Field | Value | Effect |
|-------|-------|--------|
| `model` | `gpt-5.4` | Model used for all sessions in this repo |
| `model_reasoning_effort` | `xhigh` | Maximum reasoning depth |
| `approval_policy` | `never` | No approval prompts — full auto execution |
| `sandbox_mode` | `workspace-write` | Can read/write workspace files; network is restricted |
| `web_search` | `live` | Fetches live pages (not cached) |
| `file_opener` | `windsurf` | File citations open in Windsurf IDE |

Global user config (`~/.codex/config.toml`) sets the same model/reasoning and marks both project paths as `trust_level = "trusted"`.

## 7) Daily Operating Routine

1. Validate skills are compliant: `scripts/check-codex-skills.sh`.
2. Start with `/plan` for non-trivial work.
3. Implement with `/implement`.
4. Use `/debugme` for diagnosis-first incidents.
5. Run testing/quality skills before finalizing critical changes.
6. Refresh memory files with `/methodology-setup` after significant product or architecture changes.

## 8) Codex Compliance Checklist

- [ ] `AGENTS.md` exists and reflects current project policy.
- [ ] All skills exist with valid `SKILL.md` + `agents/openai.yaml`.
- [ ] Frontmatter `name` matches skill directory name.
- [ ] Manual-only skills include `disable-model-invocation: true` and constrained `allowed-tools`.
- [ ] `scripts/check-codex-skills.sh` passes.
- [ ] `docs/CODEX_MIGRATION_MAP.md` is updated when skill taxonomy changes.

## 9) Legacy Compatibility Policy

- `.claude/` and `.windsurf/` remain in the repository as active tools for Claude Code and Windsurf respectively.
- New Codex operational changes are implemented in Codex assets (`AGENTS.md`, `.agents/skills`, Codex docs).
- `~/.codex/skills` is not the canonical location for repository-managed skills in this project.
