# Codex Methodology and Memory Bank Guide

This is the canonical methodology guide for Codex in this repository.

## 1) Canon and Precedence

When sources disagree, apply this order:

1. `AGENT.md` (project-wide guardrails and operating policy)
2. `docs/CODEX_METHODOLOGY_GUIDE.md` (this document)
3. `docs/CODEX_SETUP.md` (runtime setup and installation)
4. `.agents/skills/gym-*/SKILL.md` (workflow-specific behavior)
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

- Planning: `gym-plan`
- Implementation: `gym-implement`
- Debug (read-only): `gym-debugme`

Memory refresh workflow:

- `gym-methodology-setup`

## 3) Codex Skill Contract (Hard Requirements)

Every repository skill under `.agents/skills/gym-*` must satisfy:

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
  - `gym-git-commit`
  - `gym-git-sync`
  - `gym-deploy-staging`
  - `gym-deploy-and-check`
  - `gym-server-diagnostic-report`

## 4) Skill Taxonomy

Shared base skills (methodology and quality):

- `gym-plan`
- `gym-implement`
- `gym-debugme`
- `gym-methodology-setup`
- `gym-test-quality-gate`
- `gym-backend-test-coverage`
- `gym-frontend-unit-test-coverage`
- `gym-frontend-e2e-test-coverage`
- `gym-e2e-user-flows-check`
- `gym-new-feature-checklist`

Shared operational skills:

- `gym-git-commit`
- `gym-git-sync`
- `gym-fix-broken-tests`

Project-specific skills:

- `gym-deploy-staging`
- `gym-deploy-and-check`
- `gym-server-diagnostic-report`

## 5) Invocation Model in Codex

Use skills by naming them explicitly in your prompt, for example:

- `Use skill gym-plan: plan feature X and list risks.`
- `Use skill gym-debugme: analyze this traceback.`
- `Use skill gym-deploy-staging with branch release/march-2026.`

For deploy and git operations, explicit user intent is mandatory (manual-only skills).

## 6) Runtime Setup

Install repository-managed skills:

```bash
scripts/install-codex-skills.sh --force --remove-stale
```

Optional dry-run:

```bash
scripts/install-codex-skills.sh --dry-run
```

Validate compliance:

```bash
scripts/check-codex-skills.sh
```

After install or updates, restart Codex so skills are reloaded from `${CODEX_HOME:-~/.codex}/skills`.

## 7) Daily Operating Routine

1. Ensure skills are installed and current.
2. Start with `gym-plan` for non-trivial work.
3. Implement with `gym-implement`.
4. Use `gym-debugme` for diagnosis-first incidents.
5. Run testing/quality skills before finalizing critical changes.
6. Refresh memory files with `gym-methodology-setup` after significant product or architecture changes.

## 8) Codex Compliance Checklist

- [ ] `AGENT.md` exists and reflects current project policy.
- [ ] All `gym-*` skills exist with valid `SKILL.md` + `agents/openai.yaml`.
- [ ] Frontmatter `name` matches skill directory.
- [ ] Manual-only skills include `disable-model-invocation: true` and constrained `allowed-tools`.
- [ ] `scripts/install-codex-skills.sh` runs idempotently.
- [ ] `scripts/check-codex-skills.sh` passes.
- [ ] `docs/CODEX_MIGRATION_MAP.md` is updated when skill taxonomy changes.

## 9) Legacy Compatibility Policy

- `.claude/` and `.windsurf/` remain in the repository as historical references.
- New operational changes must be implemented in Codex assets first (`AGENT.md`, `.agents/skills`, Codex docs).
- Legacy docs may be updated for context, but not treated as the active standard.
