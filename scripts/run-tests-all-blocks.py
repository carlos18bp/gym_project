#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

TAIL_LINES = 40


@dataclass
class StepResult:
    name: str
    command: list[str]
    returncode: int
    duration: float
    status: str
    output_tail: list[str] = field(default_factory=list)
    coverage: list[str] = field(default_factory=list)
    log_path: Path | None = None


def split_args(value: str | None) -> list[str]:
    if not value:
        return []
    return shlex.split(value)


def _format_pct(value: object) -> str:
    if isinstance(value, (int, float)):
        return f"{value:.2f}"
    return str(value)


def read_jest_coverage_summary(frontend_root: Path) -> list[str]:
    summary_path = frontend_root / "coverage" / "coverage-summary.json"
    if not summary_path.exists():
        return []
    try:
        data = json.loads(summary_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    total = data.get("total")
    if not isinstance(total, dict):
        return []

    labels = [
        ("Statements", total.get("statements")),
        ("Branches", total.get("branches")),
        ("Functions", total.get("functions")),
        ("Lines", total.get("lines")),
    ]
    lines: list[str] = []
    for label, metric in labels:
        if not isinstance(metric, dict):
            continue
        pct = metric.get("pct")
        covered = metric.get("covered")
        total_count = metric.get("total")
        if pct is None or covered is None or total_count is None:
            continue
        lines.append(f"{label}: {_format_pct(pct)}% ({covered}/{total_count})")
    return lines


def run_command(
    name: str,
    command: Sequence[str],
    cwd: Path,
    log_path: Path | None,
    env: dict[str, str] | None = None,
    capture_coverage: bool = False,
    append_log: bool = False,
) -> StepResult:
    cmd_list = [str(item) for item in command]
    print("\n" + "=" * 80)
    print(f"Running step: {name}")
    print(f"Command: {' '.join(cmd_list)}")

    output_tail: deque[str] = deque(maxlen=TAIL_LINES)
    coverage_lines: list[str] = []
    coverage_active = False

    log_file = None
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_file = log_path.open("a" if append_log else "w", encoding="utf-8")

    start_time = time.monotonic()
    try:
        process = subprocess.Popen(
            cmd_list,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )
    except FileNotFoundError as exc:
        if log_file:
            log_file.write(f"{exc}\n")
            log_file.close()
        duration = time.monotonic() - start_time
        return StepResult(
            name=name,
            command=cmd_list,
            returncode=127,
            duration=duration,
            status="failed",
            output_tail=[str(exc)],
            log_path=log_path,
        )

    if process.stdout is None:
        if log_file:
            log_file.close()
        duration = time.monotonic() - start_time
        return StepResult(
            name=name,
            command=cmd_list,
            returncode=1,
            duration=duration,
            status="failed",
            output_tail=["Failed to capture command output."],
            log_path=log_path,
        )

    for line in process.stdout:
        print(line, end="")
        if log_file:
            log_file.write(line)
        stripped = line.rstrip("\n")
        output_tail.append(stripped)
        if capture_coverage:
            if "Coverage summary" in stripped:
                coverage_lines = [stripped]
                coverage_active = True
                continue
            if coverage_active:
                coverage_lines.append(stripped)
                if stripped.startswith("=") and "Coverage summary" not in stripped:
                    coverage_active = False

    returncode = process.wait()
    duration = time.monotonic() - start_time

    if log_file:
        log_file.flush()
        log_file.close()

    status = "ok" if returncode == 0 else "failed"
    return StepResult(
        name=name,
        command=cmd_list,
        returncode=returncode,
        duration=duration,
        status=status,
        output_tail=list(output_tail),
        coverage=coverage_lines,
        log_path=log_path,
    )


def run_frontend_e2e_coverage(
    frontend_root: Path,
    log_path: Path | None,
    extra_args: Sequence[str],
) -> StepResult:
    env = dict(os.environ)
    env["E2E_COVERAGE"] = "1"

    playwright_cmd = ["npx", "playwright", "test", "--workers=1"]
    playwright_cmd.extend(extra_args)
    playwright_result = run_command(
        name="frontend-e2e",
        command=playwright_cmd,
        cwd=frontend_root,
        log_path=log_path,
        env=env,
        capture_coverage=False,
        append_log=False,
    )

    coverage_dir = frontend_root / "coverage-e2e"
    coverage_dir.mkdir(parents=True, exist_ok=True)

    nyc_cmd = [
        "npx",
        "nyc",
        "report",
        "--temp-dir",
        ".nyc_output",
        "--report-dir",
        "coverage-e2e",
        "--reporter=text-summary",
        "--reporter=text",
        "--reporter=lcov",
    ]
    nyc_result = run_command(
        name="frontend-e2e-coverage",
        command=nyc_cmd,
        cwd=frontend_root,
        log_path=log_path,
        env=env,
        capture_coverage=True,
        append_log=True,
    )

    duration = playwright_result.duration + nyc_result.duration
    if playwright_result.returncode != 0:
        status = "failed"
        returncode = playwright_result.returncode
        output_tail = playwright_result.output_tail
    elif nyc_result.returncode != 0:
        status = "failed"
        returncode = nyc_result.returncode
        output_tail = nyc_result.output_tail
    else:
        status = "ok"
        returncode = 0
        output_tail = nyc_result.output_tail

    return StepResult(
        name="frontend-e2e",
        command=playwright_result.command,
        returncode=returncode,
        duration=duration,
        status=status,
        output_tail=output_tail,
        coverage=nyc_result.coverage,
        log_path=log_path,
    )


def print_final_report(results: list[StepResult], duration: float) -> None:
    print("\n" + "=" * 80)
    print("Final suite report")
    print(f"Total duration: {duration:.2f}s")

    for result in results:
        print(f"- {result.name}: {result.status.upper()} ({result.duration:.2f}s)")
        if result.coverage:
            print("  Coverage summary:")
            for line in result.coverage:
                print(f"    {line}")
        if result.log_path:
            print(f"  Log: {result.log_path}")

    failed = [result for result in results if result.status == "failed"]
    if failed:
        print("\n" + "!" * 80)
        print("Failures (tail output):")
        for result in failed:
            print("\n" + "-" * 80)
            print(f"{result.name} (exit {result.returncode})")
            for line in result.output_tail:
                print(line)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run backend pytest blocks plus frontend unit/E2E tests sequentially with reporting."
        )
    )
    parser.add_argument("--backend-markers", default="")
    parser.add_argument("--backend-groups", default="")
    parser.add_argument("--backend-args", default="")
    parser.add_argument("--unit-args", default="")
    parser.add_argument("--e2e-args", default="")
    parser.add_argument("--skip-backend", action="store_true")
    parser.add_argument("--skip-unit", action="store_true")
    parser.add_argument("--skip-e2e", action="store_true")
    parser.add_argument("--report-dir", default="test-reports")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    backend_root = repo_root / "backend"
    frontend_root = repo_root / "frontend"
    report_dir = repo_root / args.report_dir

    results: list[StepResult] = []
    total_duration = 0.0
    failed = False

    if not args.skip_backend:
        backend_script = backend_root / "scripts" / "run-tests-blocks.py"
        if not backend_script.exists():
            print(f"Backend block runner not found at {backend_script}.")
            return 1
        backend_cmd = [sys.executable, str(backend_script)]
        if args.backend_markers:
            backend_cmd.extend(["--markers", args.backend_markers])
        if args.backend_groups:
            backend_cmd.extend(["--groups", args.backend_groups])
        backend_extra = split_args(args.backend_args)
        if backend_extra:
            backend_cmd.append("--")
            backend_cmd.extend(backend_extra)

        backend_result = run_command(
            name="backend-blocks",
            command=backend_cmd,
            cwd=backend_root,
            log_path=report_dir / "backend-blocks.log",
        )
        results.append(backend_result)
        total_duration += backend_result.duration
        failed = failed or backend_result.status == "failed"

    if not args.skip_unit:
        unit_cmd = ["npm", "run", "test", "--", "--coverage", "--runInBand"]
        unit_cmd.extend(split_args(args.unit_args))
        unit_result = run_command(
            name="frontend-unit",
            command=unit_cmd,
            cwd=frontend_root,
            log_path=report_dir / "frontend-unit.log",
            capture_coverage=True,
        )
        if unit_result.status == "ok":
            unit_result.coverage = read_jest_coverage_summary(frontend_root)
        results.append(unit_result)
        total_duration += unit_result.duration
        failed = failed or unit_result.status == "failed"

    if not args.skip_e2e:
        e2e_result = run_frontend_e2e_coverage(
            frontend_root=frontend_root,
            log_path=report_dir / "frontend-e2e.log",
            extra_args=split_args(args.e2e_args),
        )
        results.append(e2e_result)
        total_duration += e2e_result.duration
        failed = failed or e2e_result.status == "failed"

    print_final_report(results, total_duration)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
