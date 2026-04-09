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
  --remove-stale  Remove stale gym-* symlinks from target skills directory.
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
legacy_duplicates=0

for source_path in "$SOURCE_DIR"/gym-*; do
  [[ -d "$source_path" ]] || continue
  skill_name="$(basename "$source_path")"
  target_path="$TARGET_DIR/$skill_name"
  replaced_this_item=0

  if [[ -L "$target_path" ]]; then
    link_target="$(readlink "$target_path")"
    if [[ "$link_target" == "$source_path" ]]; then
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
    if ln -s "$source_path" "$target_path"; then
      echo "LINK  $skill_name -> $source_path"
      if [[ $replaced_this_item -eq 0 ]]; then
        installed=$((installed + 1))
      fi
    else
      echo "ERR   Failed to link $skill_name" >&2
      errors=$((errors + 1))
    fi
  else
    echo "[dry-run] ln -s $source_path $target_path"
    if [[ $replaced_this_item -eq 0 ]]; then
      installed=$((installed + 1))
    fi
  fi
done

if [[ $REMOVE_STALE -eq 1 ]]; then
  for existing in "$TARGET_DIR"/gym-*; do
    [[ -e "$existing" || -L "$existing" ]] || continue
    [[ -L "$existing" ]] || continue
    existing_name="$(basename "$existing")"
    if [[ ! -d "$SOURCE_DIR/$existing_name" ]]; then
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

LEGACY_CODEX_SKILLS_DIR="$HOME/.codex/skills"
if [[ "$TARGET_DIR" != "$LEGACY_CODEX_SKILLS_DIR" && -d "$LEGACY_CODEX_SKILLS_DIR" ]]; then
  for legacy in "$LEGACY_CODEX_SKILLS_DIR"/gym-*; do
    [[ -e "$legacy" || -L "$legacy" ]] || continue
    legacy_duplicates=$((legacy_duplicates + 1))
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
if [[ $legacy_duplicates -gt 0 ]]; then
  echo "  Legacy ~/.codex/skills duplicates: $legacy_duplicates"
  echo "  Cleanup after verification: find \"$LEGACY_CODEX_SKILLS_DIR\" -maxdepth 1 -type l -name 'gym-*' -delete"
fi

if [[ $errors -gt 0 ]]; then
  exit 1
fi
