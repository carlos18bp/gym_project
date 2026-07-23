#!/usr/bin/env python3
"""Audit the Playwright suite for tests that never perform a user interaction.

A test earns its keep only if it drives the action its name describes and then
asserts the resulting transition. Tests that pre-cook a mock, `goto()` the end
state and assert that end state prove nothing: the product logic that produces
the transition is never exercised, so they stay green while the feature rots.

Three shapes are legitimately interaction-free and are excluded: route guards
(loading IS the flow), empty states, and role restrictions. Mark those in the
spec with `// audit: load-only flow (reason)` so they classify deterministically
instead of relying on the name heuristics below.

Usage:
    python3 scripts/audit_e2e_interactions.py [--list] [--json]

Exit code 1 when suspect tests remain, so CI or a pre-commit hook can gate on it.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

SPEC_ROOT = Path(__file__).resolve().parent.parent / "frontend" / "e2e"

INTERACTION = re.compile(
    r"\.(click|fill|press|setInputFiles|selectOption|check|uncheck|hover"
    r"|dblclick|type|dragTo|tap|setChecked|clear)\s*\("
)
TEST_START = re.compile(r"test\s*\(\s*[\"'`](.+?)[\"'`]")
EXPLICIT_MARKER = re.compile(r"//\s*audit:\s*load-only flow\s*\(", re.IGNORECASE)

# Name/body mismatch: the title promises an action the body never performs.
ACTION_VERB = re.compile(
    r"\b(clicks?|closes?|opens?|submits?|selects?|uploads?|types?|fills?|searches?"
    r"|filters?|creates?|deletes?|removes?|adds?|edits?|updates?|saves?|sends?"
    r"|navigates?|switch(es)?|toggles?|expands?|collapses?|signs?|rejects?"
    r"|approves?|cancels?|confirms?|drags?|scrolls?|enters?|chooses?|picks?"
    r"|marks?|archives?|restores?|downloads?|reassigns?|invites?|after \d+)\b",
    re.IGNORECASE,
)


def iter_tests(source):
    """Yield (name, body) for each test( block, matching parens to find the end."""
    for match in TEST_START.finditer(source):
        open_paren = source.index("(", match.start())
        depth, cursor = 0, open_paren
        while cursor < len(source):
            if source[cursor] == "(":
                depth += 1
            elif source[cursor] == ")":
                depth -= 1
                if depth == 0:
                    break
            cursor += 1
        yield match.group(1), source[open_paren:cursor]


def classify(name, body):
    """Return one of: interactive, load-only-marked, guard, empty-state,
    restriction, suspect."""
    if INTERACTION.search(body):
        return "interactive"
    if EXPLICIT_MARKER.search(body):
        return "load-only-marked"

    lowered_body = body.lower()
    lowered_name = name.lower()
    compact = lowered_body.replace(" ", "")

    if "tohaveurl" in lowered_body or "redirect" in lowered_name or "guard" in lowered_name:
        return "guard"
    if "empty" in lowered_name or "vacío" in lowered_name or "sin " in lowered_name:
        return "empty-state"
    if (
        "tohavecount(0)" in compact
        or ".tobehidden" in lowered_body
        or "not.tobevisible" in lowered_body
    ):
        return "restriction"
    return "suspect"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true", help="list every suspect test")
    parser.add_argument("--json", action="store_true", help="emit machine-readable output")
    args = parser.parse_args()

    counts = Counter()
    suspects = []
    per_file = defaultdict(int)

    for spec in sorted(SPEC_ROOT.rglob("*.spec.js")):
        source = spec.read_text()
        relative = spec.relative_to(SPEC_ROOT.parent)
        for name, body in iter_tests(source):
            kind = classify(name, body)
            counts[kind] += 1
            if kind == "suspect":
                per_file[str(relative)] += 1
                suspects.append(
                    {
                        "file": str(relative),
                        "test": name,
                        "name_promises_action": bool(ACTION_VERB.search(name)),
                    }
                )

    total = sum(counts.values())
    flagrant = sum(1 for s in suspects if s["name_promises_action"])

    if args.json:
        print(json.dumps({"total": total, "counts": dict(counts), "suspects": suspects}, indent=2))
    else:
        print(f"Playwright tests analysed: {total}")
        for kind in ("interactive", "guard", "empty-state", "restriction", "load-only-marked"):
            print(f"  {counts[kind]:4d}  {kind}")
        print(f"  {counts['suspect']:4d}  suspect (renders a mock without driving anything)")
        if counts["suspect"]:
            print(f"\n  of which {flagrant} are flagrant: the name promises an action the body never performs")
            print("\n  worst files:")
            for path, n in sorted(per_file.items(), key=lambda item: -item[1])[:15]:
                print(f"    {n:3d}  {path}")
        if args.list:
            print()
            for s in suspects:
                mark = "!" if s["name_promises_action"] else " "
                print(f"  {mark} {s['file']}: {s['test']}")

    return 1 if counts["suspect"] else 0


if __name__ == "__main__":
    sys.exit(main())
