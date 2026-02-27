#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
import datetime
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from functools import partial
from pathlib import Path
from typing import Sequence

TAIL_LINES = 40
_BACKEND_COV_BRANCH_RE = re.compile(r"^TOTAL\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%")
_BACKEND_COV_SIMPLE_RE = re.compile(r"^TOTAL\s+(\d+)\s+(\d+)\s+(\d+)%")
_JEST_TABLE_SEP_RE = re.compile(r"^-{5,}.*\|")

# ── ANSI helpers ─────────────────────────────────────────────────────────────
_COLOR = os.environ.get("NO_COLOR") is None and sys.stdout.isatty()

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text

def _bold(t: str) -> str:    return _c("1", t)
def _dim(t: str) -> str:     return _c("2", t)
def _green(t: str) -> str:   return _c("32", t)
def _red(t: str) -> str:     return _c("31", t)
def _yellow(t: str) -> str:  return _c("33", t)
def _cyan(t: str) -> str:    return _c("36", t)


def _colorize_coverage_line(line: str) -> str:
    """Color the percentage token in a coverage line by threshold."""
    match = re.search(r'(\d+(?:\.\d+)?)%', line)
    if not match:
        return _dim(line)
    pct = float(match.group(1))
    if pct < 50:
        color_fn = _red
    elif pct <= 80:
        color_fn = _yellow
    else:
        color_fn = _green
    colored = color_fn(match.group(0))
    return _dim(line[:match.start()]) + colored + _dim(line[match.end():])

_SPINNER = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]


class _LiveProgress:
    """Background thread that redraws a multi-line status block every 0.3s."""

    def __init__(self, suite_names: list[str]):
        self._names = suite_names
        self._status: dict[str, str] = {n: "running" for n in suite_names}
        self._durations: dict[str, float] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._start = time.monotonic()
        self._frame = 0
        self._lines_printed = 0

    def mark_done(self, name: str, status: str, duration: float) -> None:
        with self._lock:
            self._status[name] = status
            self._durations[name] = duration

    def _erase(self) -> None:
        if self._lines_printed > 0:
            sys.stdout.write(f"\033[{self._lines_printed}A")
            sys.stdout.write("\033[J")

    def _draw(self) -> None:
        elapsed = time.monotonic() - self._start
        sp = _SPINNER[self._frame % len(_SPINNER)] if _COLOR else "-"
        self._frame += 1
        header = f"  {_cyan(sp)} {_bold('Elapsed')}: {elapsed:.0f}s"
        lines = [header]
        with self._lock:
            for name in self._names:
                st = self._status[name]
                dur = self._durations.get(name)
                if st == "running":
                    tag = _yellow("running...")
                    extra = ""
                elif st == "ok":
                    tag = _green("OK")
                    extra = f" ({dur:.1f}s)" if dur else ""
                else:
                    tag = _red("FAILED")
                    extra = f" ({dur:.1f}s)" if dur else ""
                lines.append(f"    {name:<18} {tag}{extra}")
        done = sum(1 for s in self._status.values() if s != "running")
        total = len(self._names)
        bar_w = 20
        filled = int(done / total * bar_w)
        bar = _green("█" * filled) + _dim("░" * (bar_w - filled))
        lines.append(f"  [{bar}] {done}/{total} suites done")
        out = "\n".join(lines) + "\n"
        sys.stdout.write(out)
        sys.stdout.flush()
        self._lines_printed = len(lines)

    def _loop(self) -> None:
        while not self._stop.wait(0.3):
            self._erase()
            self._draw()

    def start(self) -> None:
        self._draw()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=2)
        self._erase()
        self._draw()


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
    backend_cov_total: str = ""
    coverage_table: list[str] = field(default_factory=list)
    skipped_from_resume: bool = False


def split_args(value: str | None) -> list[str]:
    if not value:
        return []
    return shlex.split(value)


def _format_pct(value: object) -> str:
    if isinstance(value, (int, float)):
        return f"{value:.2f}"
    return str(value)


def load_jest_coverage_summary(frontend_root: Path) -> dict | None:
    summary_path = frontend_root / "coverage" / "coverage-summary.json"
    if not summary_path.exists():
        return None
    try:
        data = json.loads(summary_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def write_jest_coverage_summary(frontend_root: Path, data: dict) -> None:
    summary_path = frontend_root / "coverage" / "coverage-summary.json"
    try:
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        return


def format_jest_coverage_summary(data: dict) -> list[str]:
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


def read_jest_coverage_summary(frontend_root: Path) -> list[str]:
    data = load_jest_coverage_summary(frontend_root)
    if not data:
        return []
    return format_jest_coverage_summary(data)


def _merge_jest_metric(prev: dict | None, current: dict | None) -> dict | None:
    if not isinstance(prev, dict):
        return current if isinstance(current, dict) else None
    if not isinstance(current, dict):
        return prev

    prev_total = prev.get("total") or 0
    curr_total = current.get("total") or 0
    prev_covered = prev.get("covered") or 0
    curr_covered = current.get("covered") or 0
    prev_skipped = prev.get("skipped") or 0
    curr_skipped = current.get("skipped") or 0

    total = max(prev_total, curr_total)
    covered = max(prev_covered, curr_covered)
    skipped = max(prev_skipped, curr_skipped)
    pct = covered / total * 100 if total else 0.0

    return {
        "total": total,
        "covered": covered,
        "skipped": skipped,
        "pct": pct,
    }


def _merge_jest_block(prev: dict | None, current: dict | None) -> dict | None:
    if not isinstance(prev, dict):
        return current if isinstance(current, dict) else None
    if not isinstance(current, dict):
        return prev

    merged: dict = {}
    metrics = {"lines", "statements", "functions", "branches"}
    for key in set(prev.keys()) | set(current.keys()):
        if key in metrics:
            merged_metric = _merge_jest_metric(prev.get(key), current.get(key))
            if merged_metric is not None:
                merged[key] = merged_metric
        else:
            merged[key] = current.get(key, prev.get(key))
    return merged


def merge_jest_coverage_summary(prev: dict, current: dict) -> dict:
    merged: dict = {}
    keys = set(prev.keys()) | set(current.keys())
    for key in keys:
        merged_block = _merge_jest_block(prev.get(key), current.get(key))
        if merged_block is not None:
            merged[key] = merged_block
    return merged


def read_flow_coverage_summary(frontend_root: Path) -> list[str]:
    data = load_flow_coverage(frontend_root)
    if not data:
        return []
    summary = data.get("summary")
    if not isinstance(summary, dict):
        return []

    total_flows = summary.get("total")
    covered_flows = summary.get("covered")

    if total_flows is None or covered_flows is None:
        return []

    pct = covered_flows / total_flows * 100 if total_flows > 0 else 0.0
    return [f"Flows: {pct:.2f}% ({covered_flows}/{total_flows})"]


def load_flow_coverage(frontend_root: Path) -> dict | None:
    summary_path = frontend_root / "e2e-results" / "flow-coverage.json"
    if not summary_path.exists():
        return None
    try:
        data = json.loads(summary_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def write_flow_coverage(frontend_root: Path, data: dict) -> None:
    summary_path = frontend_root / "e2e-results" / "flow-coverage.json"
    try:
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        return


def _flow_tests_total(flow: dict | None) -> int:
    if not isinstance(flow, dict):
        return 0
    tests = flow.get("tests")
    if not isinstance(tests, dict):
        return 0
    total = tests.get("total")
    return total if isinstance(total, int) else 0


def _merge_unmapped_tests(prev: dict | None, current: dict | None) -> dict | None:
    if not isinstance(prev, dict):
        return current if isinstance(current, dict) else None
    if not isinstance(current, dict):
        return prev
    prev_files = prev.get("files") if isinstance(prev.get("files"), dict) else {}
    curr_files = current.get("files") if isinstance(current.get("files"), dict) else {}
    merged_files: dict[str, int] = {}
    for key in set(prev_files.keys()) | set(curr_files.keys()):
        prev_count = prev_files.get(key, 0)
        curr_count = curr_files.get(key, 0)
        merged_files[key] = max(prev_count, curr_count)
    return {
        "count": sum(merged_files.values()),
        "files": merged_files,
    }


def merge_flow_coverage(prev: dict, current: dict) -> dict:
    prev_flows = prev.get("flows") if isinstance(prev.get("flows"), dict) else {}
    curr_flows = current.get("flows") if isinstance(current.get("flows"), dict) else {}

    merged_flows: dict[str, dict] = {}
    for flow_id in set(prev_flows.keys()) | set(curr_flows.keys()):
        prev_flow = prev_flows.get(flow_id)
        curr_flow = curr_flows.get(flow_id)
        if _flow_tests_total(curr_flow) > 0 or not isinstance(prev_flow, dict):
            if isinstance(curr_flow, dict):
                merged_flows[flow_id] = curr_flow
            elif isinstance(prev_flow, dict):
                merged_flows[flow_id] = prev_flow
            continue

        merged_flow = dict(prev_flow)
        if isinstance(curr_flow, dict):
            curr_def = curr_flow.get("definition")
            if curr_def is not None:
                merged_flow["definition"] = curr_def
        merged_flows[flow_id] = merged_flow

    def _count_status(status: str) -> int:
        return sum(
            1
            for flow in merged_flows.values()
            if isinstance(flow, dict) and flow.get("status") == status
        )

    summary = {
        "total": len(merged_flows),
        "covered": _count_status("covered"),
        "partial": _count_status("partial"),
        "failing": _count_status("failing"),
        "missing": _count_status("missing"),
    }

    merged = dict(current)
    merged["flows"] = merged_flows
    merged["summary"] = summary
    merged_unmapped = _merge_unmapped_tests(prev.get("unmappedTests"), current.get("unmappedTests"))
    if merged_unmapped is not None:
        merged["unmappedTests"] = merged_unmapped
    if "version" not in merged and "version" in prev:
        merged["version"] = prev["version"]
    if "timestamp" not in merged and "timestamp" in prev:
        merged["timestamp"] = prev["timestamp"]
    return merged


def compute_function_coverage(backend_root: Path) -> tuple[int, int]:
    """Compute function coverage via 'coverage json' + AST.

    Returns (covered_functions, total_functions).  Returns (0, 0) on any error
    so callers can safely treat missing data as unknown rather than 0%.
    """
    venv_python = backend_root / "venv" / "bin" / "python"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable
    json_out = backend_root / ".coverage-functions.json"
    try:
        subprocess.run(
            [python_exe, "-m", "coverage", "json", "-o", str(json_out)],
            cwd=backend_root,
            check=False,
            capture_output=True,
        )
        if not json_out.exists():
            return (0, 0)
        data = json.loads(json_out.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return (0, 0)
    finally:
        try:
            json_out.unlink(missing_ok=True)
        except OSError:
            pass

    files_data = data.get("files", {})
    total_funcs = 0
    covered_funcs = 0
    for filepath, file_data in files_data.items():
        executed: set[int] = set(file_data.get("executed_lines", []))
        source_path = Path(filepath)
        if not source_path.is_absolute():
            source_path = backend_root / filepath
        try:
            source = source_path.read_text(encoding="utf-8")
            tree = ast.parse(source)
        except (OSError, SyntaxError):
            continue
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                total_funcs += 1
                end = getattr(node, "end_lineno", None) or node.lineno
                body_lines = set(range(node.lineno + 1, end + 1))
                if body_lines & executed:
                    covered_funcs += 1
    return (covered_funcs, total_funcs)


def parse_backend_cov_lines(
    total_raw: str,
    func_covered: int = 0,
    func_total: int = 0,
) -> list[str]:
    """Parse a pytest TOTAL coverage line into Statements/Branches/Functions/Lines/Total."""
    raw = total_raw.strip()
    m = _BACKEND_COV_BRANCH_RE.match(raw)
    if m:
        stmts = int(m.group(1))
        miss = int(m.group(2))
        branch = int(m.group(3))
        brpart = int(m.group(4))
        stmt_cov = stmts - miss
        br_cov = branch - brpart if branch > 0 else 0
        stmt_pct = stmt_cov / stmts * 100 if stmts > 0 else 0.0
        br_pct = br_cov / branch * 100 if branch > 0 else 0.0
        func_pct = func_covered / func_total * 100 if func_total > 0 else 0.0
        total_num = stmt_cov + br_cov + func_covered
        total_den = stmts + branch + func_total
        total_pct = total_num / total_den * 100 if total_den > 0 else 0.0
        out = [
            f"Statements: {stmt_pct:.2f}% ({stmt_cov}/{stmts})",
            f"Branches: {br_pct:.2f}% ({br_cov}/{branch})",
        ]
        if func_total > 0:
            out.append(f"Functions: {func_pct:.2f}% ({func_covered}/{func_total})")
        out += [
            f"Lines: {stmt_pct:.2f}% ({stmt_cov}/{stmts})",
            f"Total: {total_pct:.2f}% ({total_num}/{total_den})",
        ]
        return out
    m = _BACKEND_COV_SIMPLE_RE.match(raw)
    if m:
        stmts = int(m.group(1))
        miss = int(m.group(2))
        stmt_cov = stmts - miss
        stmt_pct = stmt_cov / stmts * 100 if stmts > 0 else 0.0
        func_pct = func_covered / func_total * 100 if func_total > 0 else 0.0
        total_num = stmt_cov + func_covered
        total_den = stmts + func_total
        total_pct = total_num / total_den * 100 if total_den > 0 else 0.0
        out = [
            f"Statements: {stmt_pct:.2f}% ({stmt_cov}/{stmts})",
        ]
        if func_total > 0:
            out.append(f"Functions: {func_pct:.2f}% ({func_covered}/{func_total})")
        out += [
            f"Lines: {stmt_pct:.2f}% ({stmt_cov}/{stmts})",
            f"Total: {total_pct:.2f}% ({total_num}/{total_den})",
        ]
        return out
    return []


def save_suite_state(state_file: Path, results: list[StepResult]) -> None:
    """Persist suite pass/fail state so --resume can skip already-passed suites."""
    state: dict[str, dict] = {}
    for r in results:
        state[r.name] = {
            "status": r.status,
            "duration": r.duration,
            "coverage": r.coverage,
            "coverage_table": r.coverage_table,
            "log_path": str(r.log_path) if r.log_path else None,
        }
    try:
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except OSError:
        pass


def load_suite_state(state_file: Path) -> dict[str, dict]:
    """Load previously saved suite state. Returns empty dict on any error."""
    try:
        return json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def cleanup_backend_coverage(backend_root: Path, run_id: str) -> None:
    """Erase accumulated coverage data and remove the previous run report directory."""
    venv_python = backend_root / "venv" / "bin" / "python"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable
    subprocess.run(
        [python_exe, "-m", "coverage", "erase"],
        cwd=backend_root,
        check=False,
        capture_output=True,
    )
    run_report_dir = backend_root / "test-reports" / "backend-blocks" / run_id
    if run_report_dir.exists():
        shutil.rmtree(run_report_dir, ignore_errors=True)


def run_command(
    name: str,
    command: Sequence[str],
    cwd: Path,
    log_path: Path | None,
    env: dict[str, str] | None = None,
    capture_coverage: bool = False,
    capture_backend_total: bool = False,
    capture_table: str | None = None,
    append_log: bool = False,
    quiet: bool = False,
) -> StepResult:
    cmd_list = [str(item) for item in command]
    if not quiet:
        print("\n" + "=" * 80)
        print(f"Running step: {name}")
        print(f"Command: {' '.join(cmd_list)}")

    output_tail: deque[str] = deque(maxlen=TAIL_LINES)
    coverage_lines: list[str] = []
    coverage_active = False
    backend_total_line: str = ""
    table_lines: list[str] = []
    table_current: list[str] = []
    table_active = False
    jest_sep_count = 0

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
        if not quiet:
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
        if capture_backend_total:
            s = stripped.strip()
            if _BACKEND_COV_BRANCH_RE.match(s) or _BACKEND_COV_SIMPLE_RE.match(s):
                backend_total_line = s
        if capture_table:
            _s = stripped.strip()
            if capture_table == "backend":
                if not table_active and ("coverage:" in stripped.lower()) and (stripped.startswith("---") or stripped.startswith("___")):
                    table_current = [stripped]
                    table_active = True
                elif table_active:
                    table_current.append(stripped)
                    if _BACKEND_COV_BRANCH_RE.match(_s) or _BACKEND_COV_SIMPLE_RE.match(_s):
                        table_lines = list(table_current)
                        table_current = []
                        table_active = False
            elif capture_table == "jest":
                if not table_active and _JEST_TABLE_SEP_RE.match(stripped):
                    table_current = [stripped]
                    table_active = True
                    jest_sep_count = 1
                elif table_active:
                    table_current.append(stripped)
                    if _JEST_TABLE_SEP_RE.match(stripped):
                        jest_sep_count += 1
                        if jest_sep_count >= 3:
                            table_lines = list(table_current)
                            table_current = []
                            table_active = False
                            jest_sep_count = 0
            elif capture_table == "e2e_flow":
                if not table_active and "FLOW COVERAGE REPORT" in stripped:
                    table_current = [stripped]
                    table_active = True
                elif table_active:
                    table_current.append(stripped)
                    if "JSON report:" in stripped:
                        table_lines = list(table_current)
                        table_current = []
                        table_active = False

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
        backend_cov_total=backend_total_line,
        coverage_table=table_lines,
    )


def run_backend(
    backend_root: Path,
    report_dir: Path,
    markers: str,
    extra_args: Sequence[str],
    block_markers: str,
    chunk_size: int,
    sleep: float,
    block_timeout: float,
    timeout_grace: float,
    run_id: str,
    resume: bool,
    block_extra_args: Sequence[str],
    quiet: bool = False,
) -> StepResult:
    if not resume:
        cleanup_backend_coverage(backend_root, run_id)

    venv_python = backend_root / "venv" / "bin" / "python"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable
    blocks_script = backend_root / "scripts" / "run-tests-blocks.py"

    block_cmd: list[str] = [
        python_exe,
        str(blocks_script),
        "--run-id", run_id,
        "--chunk-size", str(chunk_size),
        "--sleep", str(sleep),
        "--block-timeout", str(block_timeout),
        "--timeout-grace", str(timeout_grace),
    ]
    if block_markers:
        block_cmd.extend(["--markers", block_markers])
    if resume:
        block_cmd.append("--resume")
    block_cmd.extend(block_extra_args)

    pytest_passthrough: list[str] = [
        "--",
        "--cov=gym_app",
        "--cov-branch",
        "--cov-append",
        "--cov-report=term",
        "--cov-report=html",
    ]
    if markers:
        pytest_passthrough.extend(["-m", markers])
    pytest_passthrough.extend(extra_args)

    block_cmd.extend(pytest_passthrough)

    result = run_command(
        name="backend",
        command=block_cmd,
        cwd=backend_root,
        log_path=report_dir / "backend.log",
        capture_backend_total=True,
        capture_table="backend",
        quiet=quiet,
    )

    if result.backend_cov_total:
        func_covered, func_total = compute_function_coverage(backend_root)
        result.coverage = parse_backend_cov_lines(
            result.backend_cov_total, func_covered, func_total
        )

    return result


def run_frontend_unit(
    frontend_root: Path,
    report_dir: Path,
    extra_args: Sequence[str],
    workers: str | None = None,
    resume_failed: bool = False,
    prev_summary: dict | None = None,
    prev_coverage_table: Sequence[str] | None = None,
    quiet: bool = False,
) -> StepResult:
    unit_cmd = ["npm", "run", "test", "--", "--coverage"]
    if resume_failed:
        unit_cmd.append("--onlyFailures")
    if workers:
        unit_cmd.append(f"--maxWorkers={workers}")
    unit_cmd.extend(extra_args)

    result = run_command(
        name="frontend-unit",
        command=unit_cmd,
        cwd=frontend_root,
        log_path=report_dir / "frontend-unit.log",
        capture_coverage=True,
        capture_table="jest",
        quiet=quiet,
    )
    if result.status == "ok":
        current_summary = load_jest_coverage_summary(frontend_root)
        if resume_failed and prev_summary:
            if current_summary:
                merged_summary = merge_jest_coverage_summary(prev_summary, current_summary)
            else:
                merged_summary = prev_summary
            write_jest_coverage_summary(frontend_root, merged_summary)
            result.coverage = format_jest_coverage_summary(merged_summary)
        else:
            result.coverage = format_jest_coverage_summary(current_summary) if current_summary else []
    if resume_failed and prev_coverage_table and len(prev_coverage_table) > len(result.coverage_table):
        result.coverage_table = list(prev_coverage_table)
    return result


def cleanup_e2e(frontend_root: Path) -> None:
    """Reset E2E flow coverage state before a fresh run."""
    subprocess.run(
        ["npm", "run", "e2e:clean"],
        cwd=frontend_root,
        check=False,
        capture_output=True,
    )


def run_frontend_e2e(
    frontend_root: Path,
    report_dir: Path,
    extra_args: Sequence[str],
    workers: str | None = None,
    resume: bool = False,
    resume_failed: bool = False,
    prev_flow_coverage: dict | None = None,
    prev_coverage_table: Sequence[str] | None = None,
    quiet: bool = False,
) -> StepResult:
    if not resume:
        cleanup_e2e(frontend_root)
    env = dict(os.environ)
    playwright_cmd = ["npx", "playwright", "test"]
    if resume_failed:
        playwright_cmd.append("--last-failed")
    if workers:
        playwright_cmd.append(f"--workers={workers}")
    playwright_cmd.extend(extra_args)

    result = run_command(
        name="frontend-e2e",
        command=playwright_cmd,
        cwd=frontend_root,
        log_path=report_dir / "frontend-e2e.log",
        env=env,
        capture_coverage=False,
        capture_table="e2e_flow",
        quiet=quiet,
    )
    current_flow = load_flow_coverage(frontend_root)
    if resume_failed and prev_flow_coverage:
        if current_flow:
            merged_flow = merge_flow_coverage(prev_flow_coverage, current_flow)
        else:
            merged_flow = prev_flow_coverage
        write_flow_coverage(frontend_root, merged_flow)
        result.coverage = read_flow_coverage_summary(frontend_root)
    else:
        result.coverage = read_flow_coverage_summary(frontend_root)
    if resume_failed and prev_coverage_table and len(prev_coverage_table) > len(result.coverage_table):
        result.coverage_table = list(prev_coverage_table)
    return result


def print_coverage_tables(results: list[StepResult]) -> None:
    """Print the full captured coverage table for each suite that has one."""
    _LABELS: dict[str, str] = {
        "backend": "backend \u2014 coverage (last block)",
        "frontend-unit": "frontend-unit \u2014 coverage table",
        "frontend-e2e": "frontend-e2e \u2014 flow coverage report",
    }
    sep = "\u2550" * 80
    for result in results:
        if not result.coverage_table:
            continue
        label = _LABELS.get(result.name, result.name)
        print(f"\n{_bold(sep)}")
        print(f" {_bold(label)}")
        print(_bold(sep))
        for line in result.coverage_table:
            print(line)
    print()


def print_final_report(results: list[StepResult], duration: float, show_coverage: bool = True) -> None:  # noqa: ARG001
    sep = _bold("=" * 80)
    print(f"\n{sep}")
    print(_bold("Final suite report"))
    print(f"Total wall-clock duration: {_cyan(f'{duration:.2f}s')}")

    sum_duration = sum(r.duration for r in results)
    if len(results) > 1:
        print(f"Sum of individual durations: {sum_duration:.2f}s")
        saved = sum_duration - duration
        if saved > 0:
            print(f"Time saved by parallelism: {_green(f'{saved:.2f}s')}")

    print()
    for result in results:
        if result.skipped_from_resume:
            tag = _green("OK") + _dim(" (resumed)")
        elif result.status == "ok":
            tag = _green("OK")
        else:
            tag = _red("FAILED")
        print(f"  {result.name:<18} {tag}  ({result.duration:.2f}s)")
        if result.coverage:
            for line in result.coverage:
                print(f"    {_colorize_coverage_line(line)}")
        if result.log_path:
            print(f"    {_dim(f'Log: {result.log_path}')}")

    failed = [result for result in results if result.status == "failed"]
    if failed:
        print(f"\n{_red('!' * 80)}")
        print(_red(_bold("Failures (tail output):")))
        for result in failed:
            print(f"\n{_red('-' * 80)}")
            print(_red(f"{result.name} (exit {result.returncode})"))
            for line in result.output_tail:
                print(line)


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser for the all-suites runner."""
    parser = argparse.ArgumentParser(
        description=(
            "Run backend pytest, frontend unit, and E2E tests in parallel with reporting."
        )
    )
    parser.add_argument("--backend-markers", default="",
                        help="pytest marker expression (-m)")
    parser.add_argument("--backend-args", default="",
                        help="Extra args forwarded to pytest")
    parser.add_argument("--unit-args", default="",
                        help="Extra args forwarded to Jest")
    parser.add_argument("--e2e-args", default="",
                        help="Extra args forwarded to Playwright")
    parser.add_argument("--unit-workers", default=None,
                        help="Jest --maxWorkers value (default: auto)")
    parser.add_argument("--e2e-workers", default=None,
                        help="Playwright --workers value (default: per config)")
    parser.add_argument("--skip-backend", action="store_true")
    parser.add_argument("--skip-unit", action="store_true")
    parser.add_argument("--skip-e2e", action="store_true")
    parser.add_argument("--sequential", action="store_true",
                        help="Run suites one at a time instead of in parallel")
    parser.add_argument("--report-dir", default="test-reports")
    parser.add_argument("--coverage", action="store_true",
                        help="Show full coverage tables per suite after run (quiet+parallel mode regardless of --verbose)")
    parser.add_argument("--verbose", action="store_true",
                        help="Show full output from all runners; forces sequential execution")
    parser.add_argument("--backend-block-markers", default="",
                        help="Block marker filter for run-tests-blocks.py (edge,contract,integration,rest)")
    parser.add_argument("--backend-block-args", default="",
                        help="Extra args forwarded to run-tests-blocks.py (before --)")
    parser.add_argument("--chunk-size", type=int, default=3,
                        help="Chunk size for run-tests-blocks.py (default: 3)")
    parser.add_argument("--sleep", type=float, default=3.0,
                        help="Seconds between blocks for run-tests-blocks.py (default: 3)")
    parser.add_argument("--block-timeout", type=float, default=1200.0,
                        help="Max seconds per block before terminating (default: 1200)")
    parser.add_argument("--timeout-grace", type=float, default=15.0,
                        help="Grace seconds before killing a timed-out block (default: 15)")
    parser.add_argument("--run-id", default="",
                        help="Run ID for run-tests-blocks.py (default: backend-YYYYMMDD)")
    parser.add_argument("--resume", action="store_true",
                        help="Resume run-tests-blocks.py from last checkpoint")
    return parser


def main() -> int:
    args = build_parser().parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    backend_root = repo_root / "backend"
    frontend_root = repo_root / "frontend"
    report_dir = repo_root / args.report_dir

    run_id = args.run_id or datetime.date.today().strftime("backend-%Y%m%d")
    verbose = args.verbose and not args.coverage
    parallel = False if verbose else not args.sequential
    quiet = not verbose and parallel

    state_file = report_dir / f"suite-state-{run_id}.json"
    prev_state: dict[str, dict] = {}
    if args.resume and state_file.exists():
        prev_state = load_suite_state(state_file)

    unit_resume_failed = (
        args.resume
        and prev_state.get("frontend-unit", {}).get("status") == "failed"
    )
    e2e_resume_failed = (
        args.resume
        and prev_state.get("frontend-e2e", {}).get("status") == "failed"
    )
    unit_prev_summary = load_jest_coverage_summary(frontend_root) if unit_resume_failed else None
    unit_prev_table = (
        prev_state.get("frontend-unit", {}).get("coverage_table") if unit_resume_failed else None
    )
    e2e_prev_flow = load_flow_coverage(frontend_root) if e2e_resume_failed else None
    e2e_prev_table = (
        prev_state.get("frontend-e2e", {}).get("coverage_table") if e2e_resume_failed else None
    )

    suite_runners: list[tuple[str, partial[StepResult]]] = []

    if not args.skip_backend:
        suite_runners.append((
            "backend",
            partial(
                run_backend,
                backend_root=backend_root,
                report_dir=report_dir,
                markers=args.backend_markers,
                extra_args=split_args(args.backend_args),
                block_markers=args.backend_block_markers,
                chunk_size=args.chunk_size,
                sleep=args.sleep,
                block_timeout=args.block_timeout,
                timeout_grace=args.timeout_grace,
                run_id=run_id,
                resume=args.resume,
                block_extra_args=split_args(args.backend_block_args),
                quiet=quiet,
            ),
        ))

    if not args.skip_unit:
        suite_runners.append((
            "frontend-unit",
            partial(
                run_frontend_unit,
                frontend_root=frontend_root,
                report_dir=report_dir,
                extra_args=split_args(args.unit_args),
                workers=args.unit_workers,
                resume_failed=unit_resume_failed,
                prev_summary=unit_prev_summary,
                prev_coverage_table=unit_prev_table,
                quiet=quiet,
            ),
        ))

    if not args.skip_e2e:
        suite_runners.append((
            "frontend-e2e",
            partial(
                run_frontend_e2e,
                frontend_root=frontend_root,
                report_dir=report_dir,
                extra_args=split_args(args.e2e_args),
                workers=args.e2e_workers,
                resume=args.resume,
                resume_failed=e2e_resume_failed,
                prev_flow_coverage=e2e_prev_flow,
                prev_coverage_table=e2e_prev_table,
                quiet=quiet,
            ),
        ))

    if not suite_runners:
        print("All suites skipped. Nothing to run.")
        return 0

    skipped_results: list[StepResult] = []
    if args.resume and state_file.exists():
        remaining: list[tuple[str, partial[StepResult]]] = []
        for name, runner in suite_runners:
            entry = prev_state.get(name)
            if entry and entry.get("status") == "ok":
                log_raw = entry.get("log_path")
                skipped_results.append(StepResult(
                    name=name,
                    command=[],
                    returncode=0,
                    duration=entry.get("duration", 0.0),
                    status="ok",
                    coverage=entry.get("coverage") or [],
                    coverage_table=entry.get("coverage_table") or [],
                    log_path=Path(log_raw) if log_raw else None,
                    skipped_from_resume=True,
                ))
            else:
                remaining.append((name, runner))
        suite_runners = remaining
        if not suite_runners:
            print(_green("All suites already passed — nothing to resume."))
            report_dir.mkdir(parents=True, exist_ok=True)
            print_final_report(skipped_results, 0.0)
            return 0
        skipped_names = [r.name for r in skipped_results]
        if skipped_names:
            print(_dim(f"Resuming — skipping already-passed suites: {', '.join(skipped_names)}"))
    elif not args.resume:
        try:
            state_file.unlink(missing_ok=True)
        except OSError:
            pass

    results: list[StepResult] = []
    wall_start = time.monotonic()

    if parallel and len(suite_runners) > 1:
        names = [n for n, _ in suite_runners]
        print(_bold(f"Running {len(names)} suites in parallel..."))
        print()

        progress = _LiveProgress(names)
        progress.start()

        with ThreadPoolExecutor(max_workers=len(suite_runners)) as executor:
            futures = {
                executor.submit(runner): name
                for name, runner in suite_runners
            }
            for future in as_completed(futures):
                name = futures[future]
                try:
                    result = future.result()
                    progress.mark_done(name, result.status, result.duration)
                    results.append(result)
                except Exception as exc:
                    progress.mark_done(name, "failed", 0.0)
                    results.append(StepResult(
                        name=name,
                        command=[],
                        returncode=1,
                        duration=0.0,
                        status="failed",
                        output_tail=[str(exc)],
                    ))

        progress.stop()
    else:
        for _name, runner in suite_runners:
            results.append(runner())

    wall_duration = time.monotonic() - wall_start

    all_results = skipped_results + results

    all_suite_names = [name for name, _ in (
        [("backend", None)] * (not args.skip_backend)
        + [("frontend-unit", None)] * (not args.skip_unit)
        + [("frontend-e2e", None)] * (not args.skip_e2e)
    )]
    original_order = {name: i for i, name in enumerate(all_suite_names)}
    all_results.sort(key=lambda r: original_order.get(r.name, 999))

    report_dir.mkdir(parents=True, exist_ok=True)
    save_suite_state(state_file, all_results)

    if args.coverage:
        print_coverage_tables(all_results)
    print_final_report(all_results, wall_duration)
    failed = any(r.status == "failed" for r in all_results)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
