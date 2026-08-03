#!/usr/bin/env python3
"""
Flow coverage audit — coverage credit that a render assertion cannot buy.

The runtime reporter (`frontend/e2e/reporters/flow-coverage-reporter.mjs`) marks
a flow `covered` as soon as one test tagged `@flow:<id>` passes:

    else if (stats.tests.passed > 0 && stats.tests.skipped === 0)
        stats.status = 'covered';

Nothing checks that the test performs the flow. Measured on a real suite, 301 of
966 E2E tests carried out no user interaction at all, and every one of them was
buying coverage credit for a flow. That is the incentive that manufactures junk
tests: the cheapest way to turn a flow green is `goto` plus `toBeVisible`.

This audit replaces that credit rule with three conditions:

1. **Outcome completeness.** A flow declares the outcome classes it must cover
   (`success`, `error`, `failure`, `display`). It is covered only when every
   declared class has a qualifying test.
2. **Qualifying tests only.** A test disqualified by the junk detectors grants
   no credit, no matter that it passes.
3. **Executed tests only.** A spec file carrying the `// qa: draft-unvalidated`
   marker holds tests that were authored without ever running (no app was
   reachable). They are structurally sound but unproven — measured across four
   /qa pilots, 4 of 4 draft batches failed on first live execution. Draft
   evidence never grants credit and never subtracts from credit earned by real
   tests in other files; a flow backed only by drafts reports `unvalidated`.

It runs statically, so it needs no browser and no test run, and it works on
hosts where frontend dev dependencies are pruned. It is deliberately a separate
tool rather than a patch to the reporter: that reporter exists in three
divergent versions across the fleet, while this stays canonical.

Usage:
    python3 flow_coverage_audit.py --repo-root <path> [--json <out>] [--strict]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from quality import load_project_config  # noqa: E402
from quality.junk_detectors import (  # noqa: E402
    analyze_e2e_source,
    extract_test_blocks,
    resolve_tag_ids,
    zero_assertion_lines,
)

# Outcome classes a flow can declare. They mirror how a user actually
# experiences a feature: it works, it complains, it fails, or it shows data.
OUTCOME_CLASSES: tuple[str, ...] = ("success", "error", "failure", "display")

# Findings that make a test worthless as evidence the flow is covered. Weak
# assertions and duplicates are quality problems but the test still exercises
# the flow, so they do not revoke credit.
DISQUALIFYING_RULES: frozenset[str] = frozenset({
    "no_user_interaction",
    "flow_tag_mismatch",
})

# File-level marker written by the /qa e2e engineer on specs authored while no
# app was reachable, removed only after the spec first runs green live. The
# `qa:` prefix is deliberate: `quality:` markers are block-scoped exemptions
# (they promote), this one is file-scoped and demotes — and it stays inert to
# the junk detectors and the quality gate, so repos on an older core see it as
# a plain comment. Marker semantics: "never executed green once", NOT "green
# forever" — a validated spec that later regresses is an ordinary red test.
DRAFT_MARKER_RE = re.compile(r"^\s*//\s*qa:\s*draft-unvalidated\b", re.MULTILINE)


def load_flow_definitions(path: Path) -> dict:
    """Read flow-definitions.json, tolerating the pre-outcomes schema."""
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data.get("flows", {})


def required_outcomes(definition: dict) -> list[str]:
    """
    Outcome classes a flow must cover.

    Flows written before this schema existed declare only `expectedSpecs`. They
    fall back to requiring `success`, which keeps the audit meaningful without
    inventing requirements nobody has reviewed yet — the migration to explicit
    outcomes is what tightens them.
    """
    declared = definition.get("outcomes")
    if isinstance(declared, list) and declared:
        return [o for o in declared if o in OUTCOME_CLASSES]
    # `expectedSpecs: 0` is the legacy "intentionally uncovered" sentinel
    # (honored by check-flow-definitions-sync.mjs). It has no outcomes-schema
    # equivalent yet, so it must not fall through to requiring `success` —
    # that would turn every deliberate exemption into a phantom `missing`.
    if definition.get("expectedSpecs") == 0:
        return []
    return ["success"]


def audit(repo_root: Path) -> dict:
    """Cross-reference declared flows against the tests that truly cover them."""
    config = load_project_config(repo_root)
    e2e_root = repo_root / "frontend" / config.frontend_e2e_dir
    definitions = load_flow_definitions(e2e_root / "flow-definitions.json")

    # flow id -> outcome class -> counts of qualifying / disqualified /
    # unvalidated (drafted, never executed) tests
    evidence: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"qualifying": 0, "disqualified": 0, "unvalidated": 0})
    )
    untagged: list[dict] = []
    total_tests = 0

    specs = sorted(
        p for suffix in config.js_e2e_suffixes for p in e2e_root.rglob(f"*{suffix}")
    )

    for spec in specs:
        try:
            source = spec.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        rel = spec.relative_to(repo_root).as_posix()
        file_drafted = bool(DRAFT_MARKER_RE.search(source))

        disqualified_lines = {
            f.line for f in analyze_e2e_source(source, rel, spec)
            if f.rule_id in DISQUALIFYING_RULES
        }
        # F49: a test with no expect() anywhere in its reach (helpers resolved)
        # proves nothing — it is disqualified evidence, same bucket as junk.
        # Neither disqualifying rule catches it and the AST-side NO_ASSERTIONS
        # twin does not run on degraded hosts, so the audit checks directly.
        disqualified_lines |= zero_assertion_lines(source, rel, spec)

        for block in extract_test_blocks(source, rel):
            total_tests += 1
            # F48: outcome tags may live inside the resolved tag constants, not
            # just inline — both sources merge before the success default.
            flow_ids, const_outcomes = resolve_tag_ids(block, source, spec)
            if not flow_ids:
                untagged.append({"file": rel, "line": block.start_line, "test": block.name})
                continue

            # An untagged outcome cannot be credited to a specific class; it
            # counts as `success` so that pre-migration suites still register.
            outcomes = [
                o for o in dict.fromkeys([*block.outcomes, *const_outcomes])
                if o in OUTCOME_CLASSES
            ] or ["success"]
            # Junk wins over draft: a drafted test that is ALSO junk stays
            # junk after validation, so name the worse state now.
            if block.start_line in disqualified_lines:
                key = "disqualified"
            elif file_drafted:
                key = "unvalidated"
            else:
                key = "qualifying"

            for flow_id in flow_ids:
                for outcome in outcomes:
                    evidence[flow_id][outcome][key] += 1

    flows: dict[str, dict] = {}
    for flow_id, definition in definitions.items():
        needed = required_outcomes(definition)
        seen = evidence.get(flow_id, {})
        declared = definition.get("outcomes")

        if needed and not (isinstance(declared, list) and declared):
            # Legacy fallback (no `outcomes:` declared): keep the expectedSpecs
            # semantics — a qualifying test of ANY class (or untagged) satisfies it.
            # Most fleet maps are still pre-outcomes, so this is the COMMON path:
            # without the third arm a drafted spec would fall through to
            # `missing`, misnaming the exact state the marker exists to report.
            has_qualifying = any(c.get("qualifying", 0) > 0 for c in seen.values())
            has_junk = any(c.get("disqualified", 0) > 0 for c in seen.values())
            has_draft = any(c.get("unvalidated", 0) > 0 for c in seen.values())
            satisfied = list(needed) if has_qualifying else []
            junk_only = list(needed) if has_junk and not has_qualifying else []
            unvalidated_out = (
                list(needed) if has_draft and not has_qualifying and not has_junk else []
            )
            stray = []
        else:
            satisfied = [o for o in needed if seen.get(o, {}).get("qualifying", 0) > 0]
            junk_only = [
                o for o in needed
                if seen.get(o, {}).get("qualifying", 0) == 0
                and seen.get(o, {}).get("disqualified", 0) > 0
            ]
            unvalidated_out = [
                o for o in needed
                if seen.get(o, {}).get("qualifying", 0) == 0
                and seen.get(o, {}).get("disqualified", 0) == 0
                and seen.get(o, {}).get("unvalidated", 0) > 0
            ]
            # Evidence credited to a class the flow never declared. The common
            # cause is a flow-tagged test with no `@outcome` tag defaulting to
            # `success` on a display/error/failure-only flow: the report then
            # says `missing`/`partial` when the truth may be masked junk or
            # masked coverage (proven live on tuhuella's shelter-browse, F47).
            stray = sorted(
                o for o, c in seen.items()
                if o not in needed and any(c.get(k, 0) for k in
                                           ("qualifying", "disqualified", "unvalidated"))
            )

        if not needed:
            # Declared exempt (expectedSpecs: 0) — no required outcomes.
            status = "exempt"
        elif not seen:
            status = "missing"
        elif len(satisfied) == len(needed):
            status = "covered"
        elif satisfied:
            status = "partial"
        elif junk_only:
            status = "junk-only"
        elif unvalidated_out:
            # Only draft evidence: authored but never executed. Better than
            # missing (the work exists) and better-named than covered (it is
            # unproven) — the state /qa heals on its next run with the app up.
            status = "unvalidated"
        else:
            status = "missing"

        flows[flow_id] = {
            "module": definition.get("module", "unknown"),
            "priority": definition.get("priority", "P4"),
            "status": status,
            "required_outcomes": needed,
            "satisfied_outcomes": satisfied,
            "junk_only_outcomes": junk_only,
            "unvalidated_outcomes": unvalidated_out,
            # Suspect only while a required class is unsatisfied — on a fully
            # covered flow stray evidence is a tagging nit, not a masked state,
            # and an exempt flow is intentionally uncovered by declaration.
            "stray_evidence_outcomes": stray if status not in ("covered", "exempt") else [],
            "declares_outcomes": isinstance(definition.get("outcomes"), list),
        }

    # Flows tagged in specs but absent from the definitions file: coverage is
    # being claimed for something nobody declared.
    undeclared = sorted(set(evidence) - set(definitions))

    return {
        "summary": _summarize(flows, total_tests, len(specs)),
        "flows": flows,
        "undeclared_flows": undeclared,
        "untagged_tests": untagged,
        "outcome_gaps": _outcome_gaps(flows),
    }


def _summarize(flows: dict, total_tests: int, spec_count: int) -> dict:
    counts = defaultdict(int)
    for flow in flows.values():
        counts[flow["status"]] += 1
    return {
        "specs": spec_count,
        "tests": total_tests,
        "flows": len(flows),
        "covered": counts["covered"],
        "partial": counts["partial"],
        "junk_only": counts["junk-only"],
        "unvalidated": counts["unvalidated"],
        "missing": counts["missing"],
        "exempt": counts["exempt"],
        "suspect": sum(1 for f in flows.values() if f["stray_evidence_outcomes"]),
        "declaring_outcomes": sum(1 for f in flows.values() if f["declares_outcomes"]),
    }


def _outcome_gaps(flows: dict) -> list[dict]:
    """
    Modules whose flows only ever declare the happy path.

    A module with no `error` or `failure` flow anywhere has not been thought
    about beyond the case where everything works — which is precisely where
    users find the bugs.
    """
    by_module: dict[str, set[str]] = defaultdict(set)
    for flow in flows.values():
        by_module[flow["module"]].update(flow["required_outcomes"])

    return [
        {"module": module, "declared": sorted(outcomes), "missing": ["error", "failure"]}
        for module, outcomes in sorted(by_module.items())
        if not outcomes & {"error", "failure"}
    ]


def print_report(result: dict) -> None:
    s = result["summary"]
    print("\n" + "=" * 62)
    print(" FLOW COVERAGE AUDIT — credit requires a qualifying test")
    print("=" * 62)
    print(f"  Specs scanned:        {s['specs']}")
    print(f"  Tests examined:       {s['tests']}")
    print(f"  Flows declared:       {s['flows']}")
    print(f"    covered:            {s['covered']}")
    print(f"    partial:            {s['partial']}")
    print(f"    junk-only:          {s['junk_only']}   (tests exist, none qualify)")
    # Label discipline: qa-agent.sh scrapes these counters with
    # `grep -oE '<label>:\s+[0-9]+'` — never add a label that is a substring
    # of another (e.g. a future `validated:` would match inside this line).
    if s.get("unvalidated"):
        print(f"    unvalidated:        {s['unvalidated']}   (drafted, never executed — qa: draft-unvalidated)")
    print(f"    missing:            {s['missing']}")
    if s.get("exempt"):
        print(f"    exempt:             {s['exempt']}   (expectedSpecs: 0 — intentionally uncovered)")
    print(f"  Flows with outcomes:  {s['declaring_outcomes']} / {s['flows']}")

    junk_only = sorted(k for k, v in result["flows"].items() if v["status"] == "junk-only")
    if junk_only:
        print(f"\n  JUNK-ONLY FLOWS ({len(junk_only)}) — counted as covered before this audit:")
        for flow_id in junk_only[:20]:
            print(f"    - {flow_id}")
        if len(junk_only) > 20:
            print(f"    ... and {len(junk_only) - 20} more")

    unvalidated = sorted(k for k, v in result["flows"].items() if v["status"] == "unvalidated")
    if unvalidated:
        print(f"\n  UNVALIDATED FLOWS ({len(unvalidated)}) — authored but never executed:")
        for flow_id in unvalidated[:20]:
            print(f"    - {flow_id}")
        if len(unvalidated) > 20:
            print(f"    ... and {len(unvalidated) - 20} more")

    missing = sorted(
        (k for k, v in result["flows"].items() if v["status"] == "missing"),
        key=lambda k: (result["flows"][k].get("priority") or "P4", k),
    )
    if missing:
        print(f"\n  MISSING FLOWS ({len(missing)}) — declared but no qualifying test found:")
        for flow_id in missing[:20]:
            print(f"    - {flow_id}")
        if len(missing) > 20:
            print(f"    ... and {len(missing) - 20} more")

    suspect = sorted(
        (k for k, v in result["flows"].items() if v.get("stray_evidence_outcomes")),
        key=lambda k: (result["flows"][k].get("priority") or "P4", k),
    )
    if suspect:
        print(f"\n  SUSPECT FLOWS ({len(suspect)}) — evidence exists only in undeclared "
              "classes (untagged tests default to `success`):")
        print("    the reported status may mask junk or real coverage — apply the "
              "@outcome tagging pass before trusting it")
        for flow_id in suspect[:20]:
            v = result["flows"][flow_id]
            print(f"    - {flow_id} ({v['status']}; stray: {', '.join(v['stray_evidence_outcomes'])})")
        if len(suspect) > 20:
            print(f"    ... and {len(suspect) - 20} more")

    if result["undeclared_flows"]:
        print(f"\n  UNDECLARED FLOWS ({len(result['undeclared_flows'])}) — tagged but not in flow-definitions.json:")
        for flow_id in result["undeclared_flows"][:10]:
            print(f"    - {flow_id}")

    if result["untagged_tests"]:
        print(f"\n  UNTAGGED TESTS: {len(result['untagged_tests'])} (grant no coverage credit)")

    gaps = result["outcome_gaps"]
    if gaps:
        print(f"\n  MODULES WITHOUT ERROR/FAILURE FLOWS ({len(gaps)}):")
        for gap in gaps[:15]:
            print(f"    - {gap['module']}: declares only {', '.join(gap['declared'])}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path("."))
    parser.add_argument("--json", type=Path, help="Write the full result as JSON")
    parser.add_argument("--strict", action="store_true",
                        help="Exit 1 when any flow is junk-only, partial or unvalidated")
    args = parser.parse_args()

    repo_root = args.repo_root.resolve()
    result = audit(repo_root)
    print_report(result)

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Report: {args.json}")

    if args.strict:
        s = result["summary"]
        if s["junk_only"] or s["partial"] or s["unvalidated"]:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
