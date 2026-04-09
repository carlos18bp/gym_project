#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Install repository Codex skills into ~/.agents/skills.

Usage:
  scripts/install-codex-skills.sh [--dry-run] [--force] [--remove-stale] [--target <dir>]

Options:
  --dry-run       Show planned actions without modifying anything.
  --force         Replace existing destinations if needed.
  --remove-stale  Remove stale symlinks from target skills directory.
  --target <dir>  Override destination skills directory (default: ~/.agents/skills).
  -h, --help      Show this help.
USAGE
}

DRY_RUN=0
FORCE=0
REMOVE_STALE=0
TARGET_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --remove-stale)
      REMOVE_STALE=1
      shift
      ;;
    --target)
      [[ $# -lt 2 ]] && { echo "Missing value for --target" >&2; exit 1; }
      TARGET_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/.agents/skills"
TARGET_DIR="${TARGET_DIR:-$HOME/.agents/skills}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source skills directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ $DRY_RUN -eq 0 ]]; then
  mkdir -p "$TARGET_DIR"
else
  echo "[dry-run] mkdir -p $TARGET_DIR"
fi

installed=0
updated=0
skipped=0
removed=0
errors=0

# Install all skill directories found in source
for source_path in "$SOURCE_DIR"/*/; do
  [[ -d "$source_path" ]] || continue
  skill_name="$(basename "$source_path")"
  # Skip if no SKILL.md (not a valid skill directory)
  [[ -f "$source_path/SKILL.md" ]] || continue
  target_path="$TARGET_DIR/$skill_name"
  replaced_this_item=0

  if [[ -L "$target_path" ]]; then
    link_target="$(readlink "$target_path")"
    # Normalize: strip trailing slash for comparison
    source_path_norm="${source_path%/}"
    if [[ "$link_target" == "$source_path_norm" ]]; then
      echo "OK    $skill_name already linked"
      skipped=$((skipped + 1))
      continue
    fi
    if [[ $FORCE -eq 1 ]]; then
      if [[ $DRY_RUN -eq 0 ]]; then
        rm -f "$target_path"
      else
        echo "[dry-run] rm -f $target_path"
      fi
      replaced_this_item=1
      updated=$((updated + 1))
    else
      echo "SKIP  $skill_name exists as different symlink (use --force)"
      skipped=$((skipped + 1))
      continue
    fi
  elif [[ -e "$target_path" ]]; then
    if [[ $FORCE -eq 1 ]]; then
      if [[ $DRY_RUN -eq 0 ]]; then
        rm -rf "$target_path"
      else
        echo "[dry-run] rm -rf $target_path"
      fi
      replaced_this_item=1
      updated=$((updated + 1))
    else
      echo "SKIP  $skill_name exists and is not a symlink (use --force)"
      skipped=$((skipped + 1))
      continue
    fi
  fi

  if [[ $DRY_RUN -eq 0 ]]; then
    if ln -s "${source_path%/}" "$target_path"; then
      echo "LINK  $skill_name -> ${source_path%/}"
      if [[ $replaced_this_item -eq 0 ]]; then
        installed=$((installed + 1))
      fi
    else
      echo "ERR   Failed to link $skill_name" >&2
      errors=$((errors + 1))
    fi
  else
    echo "[dry-run] ln -s ${source_path%/} $target_path"
    if [[ $replaced_this_item -eq 0 ]]; then
      installed=$((installed + 1))
    fi
  fi
done

# Remove stale symlinks: links in target that no longer have a matching source skill
# Use * (not */) so broken symlinks are included in the glob
if [[ $REMOVE_STALE -eq 1 ]]; then
  for existing in "$TARGET_DIR"/*; do
    [[ -L "$existing" ]] || continue
    existing_name="$(basename "$existing")"
    source_skill="$SOURCE_DIR/$existing_name"
    if [[ ! -d "$source_skill" ]] || [[ ! -f "$source_skill/SKILL.md" ]]; then
      if [[ $DRY_RUN -eq 0 ]]; then
        rm -f "$existing"
      else
        echo "[dry-run] rm -f $existing"
      fi
      echo "DROP  removed stale link $existing_name"
      removed=$((removed + 1))
    fi
  done
fi

echo
echo "Summary:"
echo "  Source: $SOURCE_DIR"
echo "  Target: $TARGET_DIR"
echo "  Installed: $installed"
echo "  Updated/Replaced: $updated"
echo "  Removed stale: $removed"
echo "  Skipped: $skipped"
echo "  Errors: $errors"

if [[ $errors -gt 0 ]]; then
  exit 1
fi
