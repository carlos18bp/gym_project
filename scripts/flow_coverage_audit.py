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

This audit replaces that credit rule with two conditions:

1. **Outcome completeness.** A flow declares the outcome classes it must cover
   (`success`, `error`, `failure`, `display`). It is covered only when every
   declared class has a qualifying test.
2. **Qualifying tests only.** A test disqualified by the junk detectors grants
   no credit, no matter that it passes.

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
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from quality import load_project_config  # noqa: E402
from quality.junk_detectors import (  # noqa: E402
    analyze_e2e_source,
    extract_test_blocks,
    resolve_flow_ids,
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
    return ["success"]


def audit(repo_root: Path) -> dict:
    """Cross-reference declared flows against the tests that truly cover them."""
    config = load_project_config(repo_root)
    e2e_root = repo_root / "frontend" / config.frontend_e2e_dir
    definitions = load_flow_definitions(e2e_root / "flow-definitions.json")

    # flow id -> outcome class -> counts of qualifying / disqualified tests
    evidence: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"qualifying": 0, "disqualified": 0})
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

        disqualified_lines = {
            f.line for f in analyze_e2e_source(source, rel, spec)
            if f.rule_id in DISQUALIFYING_RULES
        }

        for block in extract_test_blocks(source, rel):
            total_tests += 1
            flow_ids = resolve_flow_ids(block, source)
            if not flow_ids:
                untagged.append({"file": rel, "line": block.start_line, "test": block.name})
                continue

            # An untagged outcome cannot be credited to a specific class; it
            # counts as `success` so that pre-migration suites still register.
            outcomes = [o for o in block.outcomes if o in OUTCOME_CLASSES] or ["success"]
            key = "disqualified" if block.start_line in disqualified_lines else "qualifying"

            for flow_id in flow_ids:
                for outcome in outcomes:
                    evidence[flow_id][outcome][key] += 1

    flows: dict[str, dict] = {}
    for flow_id, definition in definitions.items():
        needed = required_outcomes(definition)
        seen = evidence.get(flow_id, {})

        satisfied = [o for o in needed if seen.get(o, {}).get("qualifying", 0) > 0]
        junk_only = [
            o for o in needed
            if seen.get(o, {}).get("qualifying", 0) == 0
            and seen.get(o, {}).get("disqualified", 0) > 0
        ]

        if not seen:
            status = "missing"
        elif len(satisfied) == len(needed):
            status = "covered"
        elif satisfied:
            status = "partial"
        elif junk_only:
            status = "junk-only"
        else:
            status = "missing"

        flows[flow_id] = {
            "module": definition.get("module", "unknown"),
            "priority": definition.get("priority", "P4"),
            "status": status,
            "required_outcomes": needed,
            "satisfied_outcomes": satisfied,
            "junk_only_outcomes": junk_only,
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
        "missing": counts["missing"],
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
    print(f"    missing:            {s['missing']}")
    print(f"  Flows with outcomes:  {s['declaring_outcomes']} / {s['flows']}")

    junk_only = sorted(k for k, v in result["flows"].items() if v["status"] == "junk-only")
    if junk_only:
        print(f"\n  JUNK-ONLY FLOWS ({len(junk_only)}) — counted as covered before this audit:")
        for flow_id in junk_only[:20]:
            print(f"    - {flow_id}")
        if len(junk_only) > 20:
            print(f"    ... and {len(junk_only) - 20} more")

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
                        help="Exit 1 when any flow is junk-only or partial")
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
        if s["junk_only"] or s["partial"]:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
