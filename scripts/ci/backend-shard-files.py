#!/usr/bin/env python3
"""Assign every backend test file to a duration-balanced CI shard.

Weights come from the JUnit artifact of the measured baseline run. New files
receive the median weight, so discovery remains complete when the suite grows.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
WEIGHTS = BACKEND / "ci-shard-weights.json"
ROOTS = ("gym_app/tests",)


def discover() -> list[str]:
    found: set[str] = set()
    for root in ROOTS:
        base = BACKEND / root
        if not base.is_dir():
            continue
        for path in base.rglob("test_*.py"):
            found.add(path.relative_to(BACKEND).as_posix())
    return sorted(found)


def assign(
    files: list[str], count: int, weights: dict[str, float]
) -> list[list[str]]:
    """Use longest-processing-time-first bin packing."""
    default = statistics.median(weights.values()) if weights else 1.0
    bins: list[list[str]] = [[] for _ in range(count)]
    loads = [0.0] * count
    for path in sorted(files, key=lambda item: (-weights.get(item, default), item)):
        target = loads.index(min(loads))
        bins[target].append(path)
        loads[target] += weights.get(path, default)
    return [sorted(bin_files) for bin_files in bins]


def parse_shard(raw: str) -> tuple[int, int]:
    try:
        index, count = raw.split("/", 1)
        return int(index), int(count)
    except ValueError:
        raise SystemExit(f'ERROR: --shard expects "i/N", received {raw!r}')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shard", help='1-indexed "i/N" shard')
    parser.add_argument("--weights", type=Path, default=WEIGHTS)
    parser.add_argument("--check", type=int, metavar="N")
    parser.add_argument("--summary", type=int, metavar="N")
    args = parser.parse_args()

    weights: dict[str, float] = {}
    if args.weights.exists():
        weights = json.loads(args.weights.read_text(encoding="utf-8"))
    elif args.shard:
        print(f"WARNING: {args.weights} is missing; using equal weights.", file=sys.stderr)

    files = discover()
    if not files:
        print("ERROR: no backend test files were discovered.", file=sys.stderr)
        return 2

    if args.check is not None:
        if args.check < 1:
            print("ERROR: --check must be positive.", file=sys.stderr)
            return 2
        bins = assign(files, args.check, weights)
        union = [path for bin_files in bins for path in bin_files]
        missing = set(files) - set(union)
        duplicates = len(union) - len(set(union))
        print(f"discovered={len(files)} assigned={len(union)} shards={args.check}")
        if missing or duplicates:
            print(
                f"ERROR: missing={len(missing)} duplicates={duplicates}",
                file=sys.stderr,
            )
            return 1
        print("OK: every backend test file belongs to exactly one shard.")
        return 0

    if args.summary is not None:
        if args.summary < 1:
            print("ERROR: --summary must be positive.", file=sys.stderr)
            return 2
        bins = assign(files, args.summary, weights)
        default = statistics.median(weights.values()) if weights else 1.0
        for index, bin_files in enumerate(bins, 1):
            load = sum(weights.get(path, default) for path in bin_files)
            print(f"{index}/{args.summary}: {load:.1f}s, {len(bin_files)} files")
        return 0

    if not args.shard:
        raise SystemExit("ERROR: pass --shard i/N, --check N, or --summary N")

    index, count = parse_shard(args.shard)
    if count < 1 or not 1 <= index <= count:
        raise SystemExit(f"ERROR: shard {index} is outside 1..{count}")
    print(" ".join(assign(files, count, weights)[index - 1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
