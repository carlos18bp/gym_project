#!/usr/bin/env python3
"""
propose_flow_definitions.py — freshness check + outcomes-schema migration proposer.

Two read-only modes that keep a project's `frontend/<e2e>/flow-definitions.json`
honest without ever clobbering the hand-curated map:

  --mode freshness         Exit 1 if the map is older than the newest route /
                           component / endpoint change. An ADVISORY pre-flight for
                           the /qa conductor — deliberately NOT a merge gate, and
                           NOT the same axis as the CI `e2e-flow-definitions-sync`
                           check (that one compares specs↔map; this compares
                           source↔map).

  --mode migrate-outcomes  Propose an `outcomes: [...]` list per flow (inferred
                           from existing `@outcome:` tags on its specs, else from
                           module/name heuristics), for operator review. NEVER
                           writes the map in place — emits `<map>.proposed.json`.
                           Where a `flow-definitions.schema.json` with
                           `additionalProperties: false` would reject `outcomes`,
                           it also emits `<schema>.proposed.json`. Leaves
                           `expectedSpecs: 0` ("intentionally uncovered") untouched
                           — the new schema has no equivalent sentinel yet.

The map stays authored by `e2e-user-flows-check`; this tool only proposes.
The audit already tolerates both schemas, so migration is per-flow incremental.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

_CORE = Path(__file__).resolve().parent
sys.path.insert(0, str(_CORE))

from quality.base import load_project_config  # noqa: E402
from quality.junk_detectors import extract_test_blocks, resolve_flow_ids  # noqa: E402
from flow_coverage_audit import load_flow_definitions  # noqa: E402  (dual-layout loader, F46)

OUTCOME_CLASSES = ("success", "error", "failure", "display")


def _registry_files(repo: Path, e2e_dir: str, flow_dir: str) -> list[Path]:
    """Files that constitute the flow registry in the active layout (F46)."""
    e2e = repo / "frontend" / e2e_dir
    if flow_dir and (e2e / flow_dir).is_dir():
        return sorted((e2e / flow_dir).glob("*.json"))
    mapf = e2e / "flow-definitions.json"
    return [mapf] if mapf.is_file() else []


def _registry_label(e2e_dir: str, flow_dir: str) -> str:
    return f"frontend/{e2e_dir}/" + (f"{flow_dir}/" if flow_dir else "flow-definitions.json")


# ---------------------------------------------------------------------------
# freshness
# ---------------------------------------------------------------------------

def _git_ctime(repo: Path, *paths: str) -> int:
    """Epoch of the last commit that touched any of `paths` (0 if none / no git)."""
    if not paths:
        return 0
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), "log", "-1", "--format=%ct", "--", *paths],
            capture_output=True, text=True, timeout=15,
        )
        v = out.stdout.strip()
        return int(v) if v.isdigit() else 0
    except Exception:
        return 0


def _mtime(p: Path) -> int:
    try:
        return int(p.stat().st_mtime)
    except OSError:
        return 0


def _source_paths(repo: Path) -> list[str]:
    """Repo-relative paths whose change should invalidate the flow map."""
    paths: list[str] = []
    for d in ("frontend/src", "frontend/components", "frontend/pages"):
        if (repo / d).is_dir():
            paths.append(d)
    for pattern in ("backend/**/urls.py", "backend/**/views.py", "backend/**/views/*.py",
                    "backend/**/serializers.py"):
        for f in repo.glob(pattern):
            paths.append(str(f.relative_to(repo)))
    return paths


def freshness(repo: Path, e2e_dir: str, flow_dir: str = "") -> tuple[int, list[str]]:
    """(exit, reasons). exit 1 = the map is stale relative to the source."""
    reg = _registry_files(repo, e2e_dir, flow_dir)
    if not reg:
        return 1, [f"missing {_registry_label(e2e_dir, flow_dir)}"]
    rels = [str(p.relative_to(repo)) for p in reg]
    map_t = max(_git_ctime(repo, *rels), max(_mtime(p) for p in reg))
    srcs = _source_paths(repo)
    if not srcs:
        return 0, []
    src_t = _git_ctime(repo, *srcs)
    if src_t > map_t:
        try:
            newer = subprocess.run(
                ["git", "-C", str(repo), "log", f"--since=@{map_t}", "--name-only",
                 "--format=", "--", *srcs],
                capture_output=True, text=True, timeout=15,
            ).stdout
            files = sorted({ln for ln in newer.splitlines() if ln.strip()})[:15]
        except Exception:
            files = []
        return 1, files
    return 0, []


# ---------------------------------------------------------------------------
# migrate-outcomes
# ---------------------------------------------------------------------------

def _spec_outcomes(repo: Path, e2e_dir: str) -> dict[str, set[str]]:
    """flow-id -> set of @outcome classes actually tagged on its specs."""
    m: dict[str, set[str]] = {}
    e2e = repo / "frontend" / e2e_dir
    if not e2e.is_dir():
        return m
    for spec in list(e2e.rglob("*.spec.js")) + list(e2e.rglob("*.spec.ts")):
        try:
            src = spec.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for block in extract_test_blocks(src, spec.name):
            for fid in resolve_flow_ids(block, src, spec):
                m.setdefault(fid, set()).update(o.lower() for o in block.outcomes)
    return m


_ERR = re.compile(r"login|signin|signup|register|form|validat|invalid|error|reject|denied|unauthor|require|forbid")
_MUT = re.compile(r"create|update|delete|remove|submit|pay|checkout|purchase|send|save|edit|publish|assign|invite|cancel|archive|approve")
_DISP = re.compile(r"list|table|detail|overview|display|view|show|render|dashboard|load|page|gallery|feed")


def infer_outcomes(flow_id: str, flow: dict, tagged: set[str]) -> list[str]:
    """Outcome classes for a flow: prefer real @outcome tags, else name/module heuristics."""
    if tagged:
        keep = [o for o in OUTCOME_CLASSES if o in tagged]
        if keep:
            return keep
    text = f"{flow_id} {flow.get('name', '')} {flow.get('module', '')}".lower()
    out: set[str] = set()
    if _ERR.search(text):
        out.add("error")
    if _MUT.search(text):
        out.update(("success", "failure"))
    if _DISP.search(text):
        out.add("display")
    if not out:
        out.add("success")
    # a form/error flow still has a happy path
    if "error" in out and "success" not in out and "display" not in out:
        out.add("success")
    return [o for o in OUTCOME_CLASSES if o in out]


def migrate_outcomes(repo: Path, e2e_dir: str, flow_dir: str = ""):
    """Return (migrated_data, diff_rows, migrated_count, sentinel_skipped)."""
    if flow_dir and (repo / "frontend" / e2e_dir / flow_dir).is_dir():
        # Sharded layout (F46): aggregate the shards in memory; the proposal is
        # still ONE reviewable file — applying it re-distributes per shard.
        cfg = load_project_config(repo)
        data = {"flows": load_flow_definitions(repo / "frontend" / e2e_dir, cfg)}
    else:
        mapf = repo / "frontend" / e2e_dir / "flow-definitions.json"
        data = json.loads(mapf.read_text(encoding="utf-8"))
    tagged = _spec_outcomes(repo, e2e_dir)
    diff: list[tuple] = []
    migrated = 0
    sentinel = 0
    for fid, flow in data.get("flows", {}).items():
        if not isinstance(flow, dict) or "outcomes" in flow:
            continue
        if flow.get("expectedSpecs") == 0:  # intentionally-uncovered: no equivalent yet
            sentinel += 1
            continue
        oc = infer_outcomes(fid, flow, tagged.get(fid, set()))
        flow["outcomes"] = oc
        migrated += 1
        diff.append((fid, flow.get("expectedSpecs", "-"), oc, bool(tagged.get(fid))))
    return data, diff, migrated, sentinel


def patch_schema(schema_path: Path):
    """Add `outcomes`/`expectedSpecs` to the flow-object node of an additionalProperties:false schema."""
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except Exception:
        return None, False
    patched = [False]

    def walk(node):
        if isinstance(node, dict):
            props = node.get("properties")
            if node.get("additionalProperties") is False and isinstance(props, dict) \
                    and "name" in props and "module" in props:
                props.setdefault("outcomes", {
                    "type": "array",
                    "items": {"type": "string", "enum": list(OUTCOME_CLASSES)},
                })
                props.setdefault("expectedSpecs", {"type": "integer", "minimum": 0})
                patched[0] = True
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)
    return schema, patched[0]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo-root", type=Path, default=Path("."))
    ap.add_argument("--mode", choices=("freshness", "migrate-outcomes"), default="freshness")
    ap.add_argument("--out", type=Path, default=None, help="where to write the proposal (default: <map>.proposed.json)")
    ap.add_argument("--emit-diff", action="store_true", help="print the per-flow expectedSpecs->outcomes mapping")
    args = ap.parse_args()

    repo = args.repo_root.resolve()
    cfg = load_project_config(repo)
    e2e_dir = getattr(cfg, "frontend_e2e_dir", "e2e") or "e2e"
    flow_dir = getattr(cfg, "flow_definitions_dir", "") or ""
    reg_label = _registry_label(e2e_dir, flow_dir)

    if args.mode == "freshness":
        rc, reasons = freshness(repo, e2e_dir, flow_dir)
        if rc == 0:
            print(f"flow-map fresh ({reg_label} up to date with routes/components/endpoints)")
        else:
            print(f"flow-map STALE — source changed after the map ({reg_label}):")
            for r in reasons:
                print(f"  - {r}")
            print("  → refresh via /e2e-user-flows-check before auditing coverage")
        return rc

    # migrate-outcomes
    if not _registry_files(repo, e2e_dir, flow_dir):
        print(f"no flow registry at {reg_label} — nothing to migrate", file=sys.stderr)
        return 2
    data, diff, migrated, sentinel = migrate_outcomes(repo, e2e_dir, flow_dir)
    mapf = repo / "frontend" / e2e_dir / "flow-definitions.json"
    out = args.out or mapf.with_suffix(".proposed.json")
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"outcomes proposal: {migrated} flow(s) migrated, {sentinel} expectedSpecs:0 sentinel(s) left untouched")
    print(f"  proposal written: {out}")

    schema_path = repo / "frontend" / e2e_dir / "flow-definitions.schema.json"
    if schema_path.is_file():
        patched, ok = patch_schema(schema_path)
        if ok:
            sout = schema_path.with_suffix(".proposed.json")
            sout.write_text(json.dumps(patched, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"  schema has additionalProperties:false → patch written: {sout} (adds outcomes + expectedSpecs)")
        else:
            print(f"  ⚠️  schema {schema_path.name} exists but no flow-object node matched — add `outcomes` manually")

    if args.emit_diff:
        print("\n  flow-id → expectedSpecs → outcomes (t=from tags):")
        for fid, es, oc, tags in diff:
            print(f"    {fid}: {es} → {oc}{'  [t]' if tags else ''}")
    print("\n  review the .proposed.json, then let e2e-user-flows-check apply it. The map is never written in place.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
