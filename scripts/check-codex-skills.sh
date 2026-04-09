#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.agents/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "ERROR: skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

required_skills=(
  plan
  implement
  debugme
  methodology-setup
  test-quality-gate
  backend-test-coverage
  frontend-unit-test-coverage
  frontend-e2e-test-coverage
  e2e-user-flows-check
  new-feature-checklist
  git-commit
  git-sync
  fix-broken-tests
  deploy-staging
  deploy-and-check
  server-diagnostic-report
)

manual_only_skills=(
  git-commit
  git-sync
  deploy-staging
  deploy-and-check
  server-diagnostic-report
)

errors=0

for skill in "${required_skills[@]}"; do
  skill_dir="$SKILLS_DIR/$skill"
  skill_file="$skill_dir/SKILL.md"
  ui_file="$skill_dir/agents/openai.yaml"

  if [[ ! -d "$skill_dir" ]]; then
    echo "ERROR: missing skill directory: $skill"
    errors=$((errors + 1))
    continue
  fi

  if [[ ! -f "$skill_file" ]]; then
    echo "ERROR: missing SKILL.md: $skill"
    errors=$((errors + 1))
    continue
  fi

  if [[ ! -f "$ui_file" ]]; then
    echo "ERROR: missing agents/openai.yaml: $skill"
    errors=$((errors + 1))
  fi

  name_value="$(sed -n 's/^name:[[:space:]]*//p' "$skill_file" | head -n 1)"
  description_value="$(sed -n 's/^description:[[:space:]]*//p' "$skill_file" | head -n 1)"

  if [[ -z "$name_value" ]]; then
    echo "ERROR: missing frontmatter name in $skill"
    errors=$((errors + 1))
  elif [[ "$name_value" != "$skill" ]]; then
    echo "ERROR: frontmatter name mismatch in $skill (found: $name_value)"
    errors=$((errors + 1))
  fi

  if [[ -z "$description_value" ]]; then
    echo "ERROR: missing frontmatter description in $skill"
    errors=$((errors + 1))
  fi

  echo "OK: $skill"
done

for skill in "${manual_only_skills[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if ! grep -q '^disable-model-invocation:[[:space:]]*true' "$skill_file"; then
    echo "ERROR: manual-only skill missing disable-model-invocation: true ($skill)"
    errors=$((errors + 1))
  fi
  if ! grep -q '^allowed-tools:' "$skill_file"; then
    echo "ERROR: manual-only skill missing allowed-tools ($skill)"
    errors=$((errors + 1))
  fi
done

echo
if [[ $errors -eq 0 ]]; then
  echo "Codex skills compliance: PASS"
  exit 0
fi

echo "Codex skills compliance: FAIL ($errors errors)"
exit 1
