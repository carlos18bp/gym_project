# Codex Setup

This document covers first-time setup, configuration, and daily validation for OpenAI Codex in this repository.

---

## 1. Prerequisites

- Codex CLI installed and authenticated (`codex --version`)
- Working from the repository root: `/home/ryzepeck/webapps/gym_project_staging`

---

## 2. Project configuration

Project-scoped defaults live in `.codex/config.toml` at the repository root:

```toml
model                  = "gpt-5.4"
model_reasoning_effort = "xhigh"

approval_policy = "never"           # valid: untrusted | on-request | never
sandbox_mode    = "workspace-write" # valid: read-only | workspace-write | danger-full-access
web_search      = "live"            # valid: disabled | cached | live

file_opener = "windsurf"            # opens file citations in Windsurf IDE
```

These settings take effect for any Codex session started from within this repository.

---

## 3. Global configuration

User-level config lives in `~/.codex/config.toml`. The recommended minimum for this project:

```toml
model = "gpt-5.4"
model_reasoning_effort = "xhigh"

[projects."/home/ryzepeck/webapps/gym_project_staging"]
trust_level = "trusted"

[projects."/home/ryzepeck/webapps/gym_project"]
trust_level = "trusted"
```

`trust_level = "trusted"` marks these directories as safe so Codex does not prompt on startup.

### Local AGENTS overrides (optional, uncommitted)

Codex reads `AGENTS.override.md` before `AGENTS.md` in every scope it scans. Use it for personal, local-only guidance that should not live in the repository:

- `~/.codex/AGENTS.override.md` — global override across every project.
- `<repo-subdir>/AGENTS.override.md` — override for a specific folder in this repo (git-ignore it; do **not** commit).

Discovery order (highest precedence first): subdirectory override → subdirectory `AGENTS.md` → repo root override → repo root `AGENTS.md` → `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md`.

---

## 4. Skills — auto-discovery

Skills in `.agents/skills/` are **auto-discovered** by Codex when started from within the repository. No installation step is required.

Each skill follows this structure:

```
.agents/skills/<skill-name>/
├── SKILL.md             ← skill instructions + frontmatter (name, description)
└── agents/openai.yaml   ← UI metadata (display_name, short_description)
```

Three invocation modes are available (see `developers.openai.com/codex/skills`):

1. **Implicit** — Codex auto-selects a skill whose `description` matches the user's prompt. Blocked when the skill sets `disable-model-invocation: true` (our manual-only skills).
2. **Explicit via `/`** — Skills appear in the slash-command autocomplete next to built-in commands. Type `/plan`, `/implement`, `/debugme`, etc. The built-in `/skills` command opens a searchable picker of every discoverable skill.
3. **Explicit via `$`** — Mention a skill inside a prompt with `$skill-name`.

---

## 5. Validate skill compliance

After adding or modifying any skill, run:

```bash
scripts/check-codex-skills.sh
```

Expected output: `Codex skills compliance: PASS` for all 16 skills.

---

## 6. Restart Codex

Restart the Codex client/session after adding or modifying skills so the updated definitions are loaded.

---

## 7. Adding a new skill

1. Create `.agents/skills/<skill-name>/SKILL.md` with required frontmatter:
   ```yaml
   ---
   name: skill-name
   description: One-line description of what this skill does.
   ---
   ```
2. Create `.agents/skills/<skill-name>/agents/openai.yaml`:
   ```yaml
   interface:
     display_name: "Skill Name"
     short_description: "One-line description."
   ```
3. If the skill should only run when explicitly invoked (deploy, git ops), add to `SKILL.md` frontmatter:
   ```yaml
   disable-model-invocation: true
   allowed-tools: [Bash, Read]
   ```
4. Run `scripts/check-codex-skills.sh` — must pass before committing.
5. Mirror the skill in `.claude/skills/` if Claude Code parity is needed.

---

## 8. Source of truth

| Resource | Purpose |
|----------|---------|
| `AGENTS.md` | Project-wide guardrails and operating policy for Codex |
| `docs/CODEX_METHODOLOGY_GUIDE.md` | Skill taxonomy, invocation model, daily routine |
| `docs/CODEX_MIGRATION_MAP.md` | Equivalence map: Claude/Windsurf assets → Codex skills |
| `.agents/skills/` | All 16 repository-managed Codex skills |
| `.codex/config.toml` | Project-scoped Codex defaults |
