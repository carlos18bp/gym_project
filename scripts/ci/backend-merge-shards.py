#!/usr/bin/env python3
"""Merge backend shard coverage data and JUnit into canonical artifacts."""
from __future__ import annotations

import argparse
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
ARTIFACTS = BACKEND / "shard-artifacts"
JUNIT_OUT = BACKEND / "test-results" / "results.xml"
SUMMED = ("tests", "errors", "failures", "skipped")


def run_coverage(*args: str) -> None:
    command = [sys.executable, "-m", "coverage", *args]
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=BACKEND, check=True)


def collect_coverage_data(expected_shards: int) -> int:
    data_files = sorted(ARTIFACTS.rglob(".coverage*"))
    shard_names = {path.parent.name for path in data_files if path.is_file()}
    if len(shard_names) != expected_shards:
        raise SystemExit(
            f"ERROR: expected coverage from {expected_shards} shards, "
            f"found {len(shard_names)}"
        )
    copied = 0
    for data_file in data_files:
        if not data_file.is_file():
            continue
        target = BACKEND / f".coverage.{data_file.parent.name}.{copied}"
        target.write_bytes(data_file.read_bytes())
        copied += 1
    return copied


def merge_junit(expected_shards: int) -> int:
    files = sorted(ARTIFACTS.rglob("results.xml"))
    if len(files) != expected_shards:
        raise SystemExit(
            f"ERROR: expected JUnit from {expected_shards} shards, found {len(files)}"
        )

    totals = dict.fromkeys(SUMMED, 0)
    total_time = 0.0
    cases: list[ET.Element] = []
    for path in files:
        if b"<!doctype" in path.read_bytes()[:4096].lower():
            raise SystemExit(f"ERROR: {path} declares a DOCTYPE")
        for suite in ET.parse(path).iter("testsuite"):
            for key in SUMMED:
                totals[key] += int(suite.get(key) or 0)
            total_time += float(suite.get("time") or 0.0)
            cases.extend(suite.findall("testcase"))

    root = ET.Element("testsuites", name="pytest tests")
    suite = ET.SubElement(root, "testsuite", name="pytest")
    for key in SUMMED:
        suite.set(key, str(totals[key]))
    suite.set("time", f"{total_time:.3f}")
    suite.extend(cases)
    JUNIT_OUT.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(JUNIT_OUT, encoding="utf-8", xml_declaration=True)
    print(
        f"JUnit: shards={len(files)} tests={totals['tests']} "
        f"failures={totals['failures']} errors={totals['errors']}"
    )
    return totals["tests"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-shards", type=int, required=True)
    args = parser.parse_args()
    if args.expected_shards < 1:
        raise SystemExit("ERROR: --expected-shards must be positive")
    if not ARTIFACTS.is_dir():
        raise SystemExit(f"ERROR: {ARTIFACTS} does not exist")

    copied = collect_coverage_data(args.expected_shards)
    print(f"Coverage data files: {copied}")
    run_coverage("combine", "--rcfile=.coveragerc")
    run_coverage("json", "--rcfile=.coveragerc", "-o", "coverage-backend.json")
    run_coverage(
        "xml", "--rcfile=.coveragerc", "-o", "test-results/coverage.xml"
    )
    if not merge_junit(args.expected_shards):
        raise SystemExit("ERROR: merged JUnit contains no tests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
