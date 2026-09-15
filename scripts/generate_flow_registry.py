#!/usr/bin/env python3
"""
generate_flow_registry.py — derived views of the E2E flow registry (F46).

Under the sharded registry layout (`flow_definitions_dir` in .testquality.yml,
one JSON per flow) the aggregate files stop being hand-merged surfaces — they
are GENERATED, deterministically, from the shards:

  1. `flow-tags.js`  — the spec-tagging constants
     (`export const <ID> = ['@flow:<id>', '@module:<m>', '@priority:<p>'];`),
     grouped by module, sorted by flow id. An optional authored passthrough
     `flow-tags.extra.js` next to the output is appended verbatim (constants
     that are not flow-derived: role tags, column sets, …).
  2. `USER_FLOW_MAP.md` — assembled from authored per-flow docs under
     `docs/user-flows/` (`_preamble.md` + `<flow-id>.md` + `_assembly.json`
     declaring section order and module→section mapping), plus a generated
     TOC and a generated coverage-index table from the definitions.
     Skipped silently when `docs/user-flows/` does not exist (repo not
     migrated to sharded docs yet).

Why: measured 2026-08-16, every flow-adding PR collided on these aggregates —
zero file-disjoint pairs, the whole merge queue serialized. With shards, two
sessions adding flows touch two different files; conflicts on the aggregates
are resolved by REGENERATING, never by hand-merging.

Modes (3-mode convention, read-only by default is not useful here so the
default WRITES; `--check` compares and exits 1 on drift — CI-friendly):

  python3 generate_flow_registry.py --repo-root .            # write derived files
  python3 generate_flow_registry.py --repo-root . --check    # drift check only

Both layouts are accepted: on the monolith layout this is still the canonical
generator for flow-tags.js (the monolith is the source instead of shards).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_CORE = Path(__file__).resolve().parent
sys.path.insert(0, str(_CORE))

from quality.base import load_project_config  # noqa: E402
from flow_coverage_audit import load_flow_definitions  # noqa: E402

GENERATED_HEADER_JS = (
    "/**\n"
    " * Flow tag constants for consistent E2E test tagging.\n"
    " *\n"
    " * GENERATED FILE — do not edit by hand and do not resolve merge\n"
    " * conflicts manually: regenerate with\n"
    " *   python3 scripts/generate_flow_registry.py --repo-root .\n"
    " * Source of truth: the flow registry (flow-definitions shards or\n"
    " * flow-definitions.json). Authored extras live in flow-tags.extra.js.\n"
    " *\n"
    " * Usage:\n"
    " *   import { ADMIN_LOGIN } from '../helpers/flow-tags.js';\n"
    " *   test('...', { tag: [...ADMIN_LOGIN, '@role:admin'] }, async ({ page }) => { ... });\n"
    " */\n"
)


def _const_name(flow_id: str) -> str:
    return flow_id.replace("-", "_").upper()


def read_meta(e2e_root: Path, flow_dir: str) -> dict:
    if flow_dir:
        meta = e2e_root / flow_dir / "_meta.json"
        if meta.is_file():
            try:
                return json.loads(meta.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return {}
    mono = e2e_root / "flow-definitions.json"
    if mono.is_file():
        try:
            data = json.loads(mono.read_text(encoding="utf-8"))
            return {k: v for k, v in data.items() if k != "flows"}
        except (OSError, json.JSONDecodeError):
            return {}
    return {}


def render_flow_tags(flows: dict, meta: dict, extra: str | None) -> str:
    """Deterministic flow-tags.js: modules sorted, flows sorted by id inside."""
    by_module: dict[str, list[tuple[str, dict]]] = {}
    for fid in sorted(flows):
        d = flows[fid]
        if not isinstance(d, dict):
            continue
        by_module.setdefault(str(d.get("module", "misc")), []).append((fid, d))

    lines: list[str] = [GENERATED_HEADER_JS]
    version = meta.get("version")
    if version:
        lines.append(f"// Registry version: {version}\n")
    for module in sorted(by_module):
        lines.append(f"// ── {module} ──")
        for fid, d in by_module[module]:
            tags = [f"'@flow:{fid}'", f"'@module:{module}'"]
            prio = d.get("priority")
            if prio:
                tags.append(f"'@priority:{prio}'")
            lines.append(f"export const {_const_name(fid)} = [{', '.join(tags)}];")
        lines.append("")
    if extra:
        lines.append("// ── authored extras (flow-tags.extra.js, appended verbatim) ──")
        lines.append(extra.rstrip("\n"))
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def render_coverage_index(flows: dict) -> str:
    rows = ["| Flow | Module | Priority | Outcomes | expectedSpecs |",
            "|---|---|---|---|---|"]
    for fid in sorted(flows):
        d = flows[fid]
        if not isinstance(d, dict):
            continue
        outcomes = ",".join(d.get("outcomes", []) or []) or "—"
        rows.append(
            f"| `{fid}` | {d.get('module', '—')} | {d.get('priority', '—')} "
            f"| {outcomes} | {d.get('expectedSpecs', '—')} |"
        )
    return "\n".join(rows) + "\n"


def render_user_flow_map(repo: Path, flows: dict, meta: dict) -> str | None:
    """Assemble docs/USER_FLOW_MAP.md from docs/user-flows/. None = not migrated."""
    src = repo / "docs" / "user-flows"
    if not src.is_dir():
        return None
    assembly = {}
    af = src / "_assembly.json"
    if af.is_file():
        try:
            assembly = json.loads(af.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            assembly = {}
    sections: list[dict] = assembly.get("sections", [])
    module_of = {fid: str(d.get("module", "misc")) for fid, d in flows.items() if isinstance(d, dict)}

    out: list[str] = []
    out.append("<!-- GENERATED FILE — assembled from docs/user-flows/ by "
               "generate_flow_registry.py. Edit the per-flow files, never this "
               "one; on merge conflict, regenerate. -->\n")
    preamble = src / "_preamble.md"
    if preamble.is_file():
        out.append(preamble.read_text(encoding="utf-8").rstrip("\n") + "\n")

    used: set[str] = set()

    def flow_doc(fid: str) -> str | None:
        if fid in used:
            return None      # ya lo reclamó una sección anterior — nunca duplicar
        f = src / f"{fid}.md"
        if f.is_file():
            used.add(fid)
            return f.read_text(encoding="utf-8").rstrip("\n") + "\n"
        return None

    for sec in sections:
        title = sec.get("title", "")
        out.append(f"\n## {title}\n")
        if sec.get("coverage_index"):
            out.append(render_coverage_index(flows))
            continue
        # Narrative intro of the section (authored file under user-flows/).
        intro_name = sec.get("intro")
        if intro_name:
            intro_f = src / intro_name
            if intro_f.is_file():
                out.append(intro_f.read_text(encoding="utf-8").rstrip("\n") + "\n")
        # Placement, in order: (1) `flows` — explicit ids in the section's own
        # order (faithful to historically organized maps); (2) `modules` —
        # auto-placement so future flows of a module need no assembly edit.
        # The used-guard makes the first claiming section win; never duplicates.
        for fid in sec.get("flows", []):
            doc = flow_doc(fid)
            if doc:
                out.append(doc)
        wanted = set(sec.get("modules", []))
        if wanted:
            for fid in sorted(flows):
                if module_of.get(fid) in wanted:
                    doc = flow_doc(fid)
                    if doc:
                        out.append(doc)
    # Any per-flow doc file not consumed above is appended, never dropped — a
    # silently dropped doc would read as deleted documentation.
    leftovers = sorted(
        f.stem for f in src.glob("*.md")
        if not f.name.startswith("_") and f.stem not in used
    )
    if leftovers:
        out.append("\n## Unsectioned flows\n")
        for fid in leftovers:
            doc = flow_doc(fid)
            if doc:
                out.append(doc)
    return "\n".join(out).rstrip("\n") + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo-root", type=Path, default=Path("."))
    ap.add_argument("--check", action="store_true", help="exit 1 if derived files drift from the registry")
    ap.add_argument("--tags-out", type=Path, default=None,
                    help="flow-tags output path (default frontend/<e2e>/helpers/flow-tags.js)")
    ap.add_argument("--map-out", type=Path, default=None,
                    help="assembled map output (default docs/USER_FLOW_MAP.md)")
    args = ap.parse_args()

    repo = args.repo_root.resolve()
    cfg = load_project_config(repo)
    e2e_dir = getattr(cfg, "frontend_e2e_dir", "e2e") or "e2e"
    flow_dir = getattr(cfg, "flow_definitions_dir", "") or ""
    e2e_root = repo / "frontend" / e2e_dir

    flows = load_flow_definitions(e2e_root, cfg)
    if not flows:
        print(f"no flows found under frontend/{e2e_dir}/ — nothing to generate", file=sys.stderr)
        return 2
    meta = read_meta(e2e_root, flow_dir)

    targets: list[tuple[Path, str]] = []

    tags_out = args.tags_out or (e2e_root / "helpers" / "flow-tags.js")
    extra_f = tags_out.with_name(tags_out.stem + ".extra" + tags_out.suffix)
    extra = extra_f.read_text(encoding="utf-8") if extra_f.is_file() else None
    targets.append((tags_out, render_flow_tags(flows, meta, extra)))

    map_content = render_user_flow_map(repo, flows, meta)
    if map_content is not None:
        targets.append((args.map_out or (repo / "docs" / "USER_FLOW_MAP.md"), map_content))

    drift = 0
    for path, content in targets:
        rel = path.relative_to(repo) if path.is_relative_to(repo) else path
        current = path.read_text(encoding="utf-8") if path.is_file() else None
        if current == content:
            print(f"  ok        {rel}")
            continue
        if args.check:
            print(f"  DRIFT     {rel} — regenerate: python3 {Path(sys.argv[0]).name} --repo-root .")
            drift = 1
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            print(f"  written   {rel}")
    return drift


if __name__ == "__main__":
    sys.exit(main())
