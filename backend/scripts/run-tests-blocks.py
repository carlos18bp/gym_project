#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Thread
from typing import Iterable, Sequence

SUMMARY_RE = re.compile(r"=+ (.+?) in ([0-9.]+)s =+")
COUNT_RE = re.compile(r"(\d+)\s+([a-zA-Z_]+)")
COVERAGE_RE = re.compile(r"^TOTAL\s+.*\s+(\d+)%$")
COVERAGE_HEADER_RE = re.compile(r"^Name\s+Stmts\s+Miss\s+Cover")
COVERAGE_ROW_RE = re.compile(r"^\S+\s+\d+\s+\d+\s+\d+%")
LABEL_MAP = {
    "error": "errors",
    "errors": "errors",
    "warning": "warnings",
    "warnings": "warnings",
}
ORDERED_LABELS = [
    "passed",
    "failed",
    "errors",
    "skipped",
    "xfailed",
    "xpassed",
    "warnings",
    "deselected",
]
GROUP_ORDER = ["models", "serializers", "tasks", "utils", "views", "root"]
DEFAULT_MARKER_BLOCKS = [
    ("edge", "edge"),
    ("contract", "contract and not edge"),
    ("integration", "integration and not edge and not contract"),
    ("rest", "not edge and not contract and not integration"),
]
MARKER_ALIASES = {
    "unmarked": "rest",
    "others": "rest",
}
MARKER_SCAN_TARGETS = {"edge", "contract", "integration"}
MARKER_PATTERNS = {
    name: re.compile(rf"(?:pytest\.)?mark\.{name}\b")
    for name in MARKER_SCAN_TARGETS
}
STATUS_LINE_EMOJIS = {
    "FAILED": "❌",
    "ERROR": "💥",
    "SKIPPED": "⏭️",
    "XFAIL": "⚠️",
    "XFAILED": "⚠️",
    "XPASS": "✨",
    "PASSED": "✅",
}
ANSI_RESET = "\x1b[0m"
COLOR_RED = "\x1b[91m"
COLOR_GREEN = "\x1b[92m"
COLOR_ORANGE = "\x1b[38;5;214m"
COLOR_GRAY = "\x1b[90m"
COLOR_BLUE = "\x1b[34m"
COLOR_MAGENTA = "\x1b[35m"
COLOR_CYAN = "\x1b[36m"
STATUS_LINE_COLORS = {
    "FAILED": COLOR_RED,
    "ERROR": COLOR_RED,
    "SKIPPED": COLOR_GRAY,
    "XFAIL": COLOR_ORANGE,
    "XFAILED": COLOR_ORANGE,
    "XPASS": COLOR_GREEN,
    "PASSED": COLOR_GREEN,
}
STATUS_COLORS = {
    "ok": COLOR_GREEN,
    "failed": COLOR_RED,
    "empty": COLOR_ORANGE,
    "timeout": COLOR_MAGENTA,
}
TAIL_LINES = 40


@dataclass(frozen=True)
class TestGroup:
    name: str
    paths: tuple[Path, ...]


@dataclass(frozen=True)
class Block:
    name: str
    marker: str
    paths: tuple[Path, ...]


@dataclass
class BlockResult:
    block: Block
    command: list[str]
    returncode: int
    duration: float
    counts: dict[str, int]
    summary_line: str | None
    status: str
    coverage: float | None = None
    output_tail: list[str] = field(default_factory=list)
    log_path: Path | None = None
    timed_out: bool = False
    timeout_seconds: float | None = None


def parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def file_contains_marker(
    file_path: Path,
    marker: str,
    cache: dict[tuple[Path, str], bool],
) -> bool:
    key = (file_path, marker)
    if key in cache:
        return cache[key]
    pattern = MARKER_PATTERNS.get(marker)
    if not pattern:
        cache[key] = False
        return False
    try:
        content = file_path.read_text(encoding="utf-8")
    except OSError:
        cache[key] = False
        return False
    match = bool(pattern.search(content))
    cache[key] = match
    return match


def detect_markers_for_files(
    files: Iterable[Path],
    markers: set[str],
    cache: dict[tuple[Path, str], bool],
) -> set[str]:
    if not markers:
        return set()
    found: set[str] = set()
    for path in files:
        remaining = markers - found
        if not remaining:
            break
        for marker in remaining:
            if file_contains_marker(path, marker, cache):
                found.add(marker)
        if found == markers:
            break
    return found


def block_group_name(block_name: str) -> str:
    parts = block_name.split(":", 2)
    if len(parts) >= 2:
        return parts[1]
    return block_name


def normalize_marker_name(name: str) -> str:
    return MARKER_ALIASES.get(name, name)


def is_test_file(path: Path) -> bool:
    if not path.is_file() or path.suffix != ".py":
        return False
    if path.name == "tests.py":
        return True
    if path.name.startswith("test_"):
        return True
    return path.name.endswith("_tests.py")


def sort_test_files(files: Iterable[Path]) -> list[Path]:
    def size_key(path: Path) -> tuple[int, str]:
        try:
            size = path.stat().st_size
        except OSError:
            size = 0
        return (-size, str(path))

    return sorted(files, key=size_key)


def collect_test_files(paths: tuple[Path, ...]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            for candidate in sorted(path.rglob("*.py")):
                if is_test_file(candidate):
                    files.append(candidate)
        elif is_test_file(path):
            files.append(path)
    unique = {file_path: file_path for file_path in files}
    return sort_test_files(list(unique.values()))


def balanced_chunk_list(items: list[Path], size: int) -> list[list[Path]]:
    """Split items into chunks of at most *size*, distributing by round-robin
    so that each chunk gets a similar total file size.  Items must already be
    sorted largest-first (the default from ``collect_test_files``).
    """
    if size <= 0 or len(items) <= size:
        return [items]
    num_chunks = -(-len(items) // size)          # ceil division
    chunks: list[list[Path]] = [[] for _ in range(num_chunks)]
    for idx, item in enumerate(items):
        chunks[idx % num_chunks].append(item)
    return [chunk for chunk in chunks if chunk]


def split_views_groups(
    views_dir: Path,
    per_file: bool,
) -> list[TestGroup]:
    if per_file:
        files = collect_test_files((views_dir,))
        groups: list[TestGroup] = []
        for file_path in files:
            relative = file_path.relative_to(views_dir)
            safe_name = str(relative).replace("/", "_")
            groups.append(TestGroup(f"views-{safe_name}", (file_path,)))
        return groups

    groups: list[TestGroup] = []
    root_files = [path for path in views_dir.iterdir() if is_test_file(path)]
    if root_files:
        ordered = tuple(sort_test_files(root_files))
        groups.append(TestGroup("views", ordered))

    subdirs = sorted(
        path
        for path in views_dir.iterdir()
        if path.is_dir() and path.name not in {"__pycache__"}
    )
    for subdir in subdirs:
        groups.append(TestGroup(f"views-{subdir.name}", (subdir,)))

    return groups


def safe_block_filename(name: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9._-]+", "_", name)
    return sanitized.strip("_") or "block"


def resolve_report_dir(backend_root: Path, report_dir: str) -> Path:
    report_path = Path(report_dir)
    if not report_path.is_absolute():
        report_path = backend_root / report_path
    report_path.mkdir(parents=True, exist_ok=True)
    return report_path


def load_summary_entries(summary_path: Path) -> dict[str, dict[str, object]]:
    entries: dict[str, dict[str, object]] = {}
    if not summary_path.exists():
        return entries
    for line in summary_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        name = data.get("block")
        if isinstance(name, str) and name:
            entries[name] = data
    return entries


def append_summary(summary_path: Path, result: BlockResult) -> None:
    payload = {
        "block": result.block.name,
        "marker": result.block.marker,
        "paths": [str(path) for path in result.block.paths],
        "status": result.status,
        "duration": result.duration,
        "returncode": result.returncode,
        "counts": result.counts,
        "coverage": result.coverage,
        "timed_out": result.timed_out,
        "timeout_seconds": result.timeout_seconds,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with summary_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def results_from_summary(
    entries: dict[str, dict[str, object]],
    block_order: list[str],
) -> tuple[list[BlockResult], Counter[str]]:
    results: list[BlockResult] = []
    totals: Counter[str] = Counter()
    for block_name in block_order:
        entry = entries.get(block_name)
        if not entry:
            continue
        counts = entry.get("counts")
        counts_dict: dict[str, int] = (
            {key: int(value) for key, value in counts.items()} if isinstance(counts, dict) else {}
        )
        totals.update(counts_dict)
        marker = entry.get("marker") if isinstance(entry.get("marker"), str) else ""
        paths_raw = entry.get("paths") if isinstance(entry.get("paths"), list) else []
        paths = tuple(Path(path) for path in paths_raw)
        status = entry.get("status") if isinstance(entry.get("status"), str) else "unknown"
        duration = float(entry.get("duration", 0.0))
        returncode = int(entry.get("returncode", 0))
        coverage_raw = entry.get("coverage")
        coverage = float(coverage_raw) if isinstance(coverage_raw, (int, float)) else None
        timed_out = bool(entry.get("timed_out")) if "timed_out" in entry else status == "timeout"
        timeout_raw = entry.get("timeout_seconds")
        timeout_seconds = float(timeout_raw) if isinstance(timeout_raw, (int, float)) else None
        results.append(
            BlockResult(
                block=Block(name=block_name, marker=marker, paths=paths),
                command=[],
                returncode=returncode,
                duration=duration,
                counts=counts_dict,
                summary_line=None,
                status=status,
                coverage=coverage,
                timed_out=timed_out,
                timeout_seconds=timeout_seconds,
            )
        )
    return results, totals


def discover_groups(
    backend_root: Path,
    views_per_file: bool,
) -> list[TestGroup]:
    tests_dir = backend_root / "gym_app" / "tests"
    if not tests_dir.exists():
        return [TestGroup("root", (backend_root,))]

    found_dirs = {path.name: path for path in tests_dir.iterdir() if path.is_dir()}
    groups: list[TestGroup] = []

    for name in GROUP_ORDER:
        if name == "root":
            root_files = tuple(path for path in tests_dir.iterdir() if is_test_file(path))
            if root_files:
                groups.append(TestGroup("root", root_files))
            continue
        if name in found_dirs:
            if name == "views" and views_per_file:
                view_groups = split_views_groups(
                    found_dirs[name],
                    per_file=views_per_file,
                )
                if view_groups:
                    groups.extend(view_groups)
                else:
                    groups.append(TestGroup(name, (found_dirs[name],)))
            else:
                groups.append(TestGroup(name, (found_dirs[name],)))

    remaining = sorted({name for name in found_dirs if name not in GROUP_ORDER})
    for name in remaining:
        groups.append(TestGroup(name, (found_dirs[name],)))

    return groups


def resolve_marker_blocks(selected: Iterable[str]) -> list[tuple[str, str]]:
    marker_map = {name: expr for name, expr in DEFAULT_MARKER_BLOCKS}
    if not selected:
        return DEFAULT_MARKER_BLOCKS

    normalized = [normalize_marker_name(name) for name in selected]
    unknown = [name for name in normalized if name not in marker_map]
    if unknown:
        raise ValueError(f"Unknown marker blocks: {', '.join(sorted(set(unknown)))}")

    return [(name, marker_map[name]) for name, _expr in DEFAULT_MARKER_BLOCKS if name in normalized]


def filter_groups(groups: list[TestGroup], selected: Iterable[str]) -> list[TestGroup]:
    if not selected:
        return groups

    selected_set = {name for name in selected}
    include_views_prefix = "views" in selected_set
    filtered: list[TestGroup] = []
    for group in groups:
        if group.name in selected_set:
            filtered.append(group)
            continue
        if include_views_prefix and group.name.startswith("views-"):
            filtered.append(group)
    if include_views_prefix and any(group.name.startswith("views-") for group in groups):
        selected_set = {name for name in selected_set if name != "views"}
    missing = selected_set - {group.name for group in groups}
    if missing:
        raise ValueError(f"Unknown groups: {', '.join(sorted(missing))}")
    return filtered


def parse_counts(summary_line: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for count, label in COUNT_RE.findall(summary_line):
        normalized = LABEL_MAP.get(label, label)
        counts[normalized] = counts.get(normalized, 0) + int(count)
    return counts


def format_counts(counts: dict[str, int]) -> str:
    if not counts:
        return "no tests collected"
    parts: list[str] = []
    for label in ORDERED_LABELS:
        if label in counts:
            parts.append(f"{counts[label]} {label}")
    for label in sorted(counts):
        if label not in ORDERED_LABELS:
            parts.append(f"{counts[label]} {label}")
    return ", ".join(parts)


def format_progress(completed: int, total: int) -> str:
    if total <= 0:
        return "0.0%"
    percent = (completed / total) * 100
    return f"{percent:.1f}%"


def format_progress_bar(completed: int, total: int, length: int = 20) -> str:
    if total <= 0 or length <= 0:
        return ""
    ratio = min(max(completed / total, 0.0), 1.0)
    filled = int(round(ratio * length))
    filled = min(filled, length)
    return "█" * filled + "░" * (length - filled)


def format_eta(seconds: float | None) -> str:
    if seconds is None or seconds <= 0:
        return "--"
    seconds_int = int(round(seconds))
    hours, remainder = divmod(seconds_int, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours > 0:
        return f"{hours}h {minutes:02d}m"
    if minutes > 0:
        return f"{minutes}m {secs:02d}s"
    return f"{secs}s"


def format_coverage_table(lines: list[str]) -> list[str]:
    if not lines:
        return []
    header = lines[0].strip()
    columns = header.split()
    has_missing = "Missing" in columns
    rows: list[tuple[str, str, str, str, str]] = []
    for line in lines[1:]:
        stripped = line.strip()
        if not stripped:
            continue
        if set(stripped) == {"-"}:
            continue
        parts = stripped.split()
        if len(parts) < 4:
            continue
        name = parts[0]
        stmts = parts[1]
        miss = parts[2]
        cover = parts[3]
        missing = ""
        if has_missing:
            missing = " ".join(parts[4:]) if len(parts) > 4 else ""
        rows.append((name, stmts, miss, cover, missing))

    if not rows:
        return [header]

    name_width = max(len("Name"), max(len(row[0]) for row in rows))
    stmts_width = max(len("Stmts"), max(len(row[1]) for row in rows))
    miss_width = max(len("Miss"), max(len(row[2]) for row in rows))
    cover_width = max(len("Cover"), max(len(row[3]) for row in rows))
    missing_width = (
        max(len("Missing"), max(len(row[4]) for row in rows)) if has_missing else 0
    )

    header_parts = [
        "Name".ljust(name_width),
        "Stmts".rjust(stmts_width),
        "Miss".rjust(miss_width),
        "Cover".rjust(cover_width),
    ]
    if has_missing:
        header_parts.append("Missing".ljust(missing_width))
    header_line = "  ".join(header_parts)
    separator = "-" * len(header_line)

    formatted = [header_line, separator]
    for name, stmts, miss, cover, missing in rows:
        row_parts = [
            name.ljust(name_width),
            stmts.rjust(stmts_width),
            miss.rjust(miss_width),
            cover.rjust(cover_width),
        ]
        if has_missing:
            row_parts.append(missing.ljust(missing_width))
        formatted.append("  ".join(row_parts))
    return formatted


def format_coverage_table_display(lines: list[str]) -> list[str]:
    formatted = format_coverage_table(lines)
    if not formatted:
        return []

    header = f"{COLOR_CYAN}{formatted[0]}{ANSI_RESET}"
    separator = f"{COLOR_GRAY}{formatted[1]}{ANSI_RESET}" if len(formatted) > 1 else ""
    highlighted: list[str] = [header]
    if separator:
        highlighted.append(separator)

    for line in formatted[2:]:
        parts = line.split()
        if len(parts) < 4:
            highlighted.append(line)
            continue
        cover_text = parts[3].rstrip("%")
        try:
            cover_value = int(cover_text)
        except ValueError:
            highlighted.append(line)
            continue
        if cover_value == 100:
            highlighted.append(f"{COLOR_GREEN}{line}{ANSI_RESET}")
        elif cover_value >= 90:
            highlighted.append(line)
        elif cover_value >= 80:
            highlighted.append(f"{COLOR_ORANGE}{line}{ANSI_RESET}")
        else:
            highlighted.append(f"{COLOR_RED}{line}{ANSI_RESET}")

    return highlighted


def print_progress_summary(
    completed_blocks: int,
    total_blocks: int,
    group_name: str,
    group_completed: int,
    group_total: int,
    eta_seconds: float | None,
) -> None:
    global_pct = format_progress(completed_blocks, total_blocks)
    group_pct = format_progress(group_completed, group_total)
    bar = format_progress_bar(completed_blocks, total_blocks)
    eta_text = format_eta(eta_seconds)
    print(
        f"{COLOR_BLUE}📍 Progress: "
        f"{bar} Global {completed_blocks}/{total_blocks} ({global_pct}) |{ANSI_RESET}"
    )
    print(
        f"{COLOR_BLUE}Group {group_name} {group_completed}/{group_total} ({group_pct}) |"
        f"{ANSI_RESET}"
    )
    print(f"{COLOR_BLUE}⏳ ETA {eta_text}{ANSI_RESET}")


def print_status_summary(status_counts: Counter[str], total_blocks: int) -> None:
    recorded = sum(status_counts.values())
    ok_count = status_counts.get("ok", 0)
    empty_count = status_counts.get("empty", 0)
    failed_count = status_counts.get("failed", 0)
    timeout_count = status_counts.get("timeout", 0)
    pending_unrun = max(total_blocks - recorded, 0)
    pending_resume = max(total_blocks - (ok_count + empty_count), 0)
    print(
        f"{COLOR_CYAN}📌 Status: "
        f"ok {ok_count}, empty {empty_count}, failed {failed_count}, "
        f"timeout {timeout_count} | "
        f"pendiente sin correr {pending_unrun} | "
        f"pendiente para --resume {pending_resume}{ANSI_RESET}"
    )


def print_status_report(status_counts: Counter[str], total_blocks: int) -> None:
    recorded = sum(status_counts.values())
    ok_count = status_counts.get("ok", 0)
    empty_count = status_counts.get("empty", 0)
    failed_count = status_counts.get("failed", 0)
    timeout_count = status_counts.get("timeout", 0)
    pending_unrun = max(total_blocks - recorded, 0)
    pending_resume = max(total_blocks - (ok_count + empty_count), 0)
    print(f"{COLOR_CYAN}📌 Block status summary{ANSI_RESET}")
    print(f"🧮 Total blocks: {total_blocks}")
    print(
        "📝 Recorded: "
        f"{recorded} (ok {ok_count}, empty {empty_count}, "
        f"failed {failed_count}, timeout {timeout_count})"
    )
    print(f"⏳ Pending (never run): {pending_unrun}")
    print(f"🔁 Pending for --resume: {pending_resume}")
    if pending_resume == 0:
        print("✅ All blocks complete for this selection.")
    print()


def color_status(label: str, status: str) -> str:
    color = STATUS_COLORS.get(status)
    if not color:
        return label
    return f"{color}{label}{ANSI_RESET}"


def color_pytest_summary_line(line: str) -> str:
    if re.search(r"\b([1-9]\d*)\s+failed\b", line) or re.search(
        r"\b([1-9]\d*)\s+error(?:s)?\b", line
    ):
        return f"{COLOR_RED}{line}{ANSI_RESET}"
    if re.search(r"\b([1-9]\d*)\s+warning(?:s)?\b", line):
        return f"{COLOR_ORANGE}{line}{ANSI_RESET}"
    return f"{COLOR_GREEN}{line}{ANSI_RESET}"


def build_blocks(
    groups: list[TestGroup],
    marker_blocks: list[tuple[str, str]],
    chunk_size: int,
    skip_empty_markers: bool,
) -> list[Block]:
    blocks: list[Block] = []
    marker_cache: dict[tuple[Path, str], bool] = {}
    group_files_cache: dict[str, list[Path]] = {}
    group_marker_presence: dict[str, set[str]] = {}
    if skip_empty_markers:
        for group in groups:
            files = collect_test_files(group.paths)
            group_files_cache[group.name] = files
            if files:
                group_marker_presence[group.name] = detect_markers_for_files(
                    files,
                    MARKER_SCAN_TARGETS,
                    marker_cache,
                )
            else:
                group_marker_presence[group.name] = set()
    for marker_name, marker_expr in marker_blocks:
        for group in groups:
            if skip_empty_markers and marker_name in MARKER_SCAN_TARGETS:
                if marker_name not in group_marker_presence.get(group.name, set()):
                    continue
            if chunk_size > 0:
                files = group_files_cache.get(group.name)
                if files is None:
                    files = collect_test_files(group.paths)
                if not files:
                    continue
                chunks = balanced_chunk_list(files, chunk_size)
                total_chunks = len(chunks)
                for index, chunk in enumerate(chunks, start=1):
                    if skip_empty_markers and marker_name in MARKER_SCAN_TARGETS:
                        if not any(
                            file_contains_marker(path, marker_name, marker_cache)
                            for path in chunk
                        ):
                            continue
                    name = f"{marker_name}:{group.name}:{index:02d}/{total_chunks:02d}"
                    blocks.append(
                        Block(name=name, marker=marker_expr, paths=tuple(chunk))
                    )
            else:
                ordered = collect_test_files(group.paths)
                paths = tuple(ordered) if ordered else group.paths
                if skip_empty_markers and marker_name in MARKER_SCAN_TARGETS:
                    files_to_check = ordered or collect_test_files(group.paths)
                    if files_to_check and not any(
                        file_contains_marker(path, marker_name, marker_cache)
                        for path in files_to_check
                    ):
                        continue
                name = f"{marker_name}:{group.name}"
                blocks.append(Block(name=name, marker=marker_expr, paths=paths))
    return blocks


def run_pytest_block(
    block: Block,
    backend_root: Path,
    reuse_db: bool,
    extra_args: Sequence[str],
    log_path: Path | None,
    append_log: bool,
    block_timeout: float,
    timeout_grace: float,
) -> BlockResult:
    cmd = [sys.executable, "-m", "pytest"]
    if reuse_db:
        cmd.append("--reuse-db")
    if block.marker:
        cmd.extend(["-m", block.marker])
    cmd.extend(str(path) for path in block.paths)
    cmd.extend(extra_args)

    print("\n" + "=" * 80)
    print(f"🚀 Running block: {block.name}")
    print(f"🧾 Command: {' '.join(cmd)}")

    start_time = time.monotonic()
    output_tail: deque[str] = deque(maxlen=TAIL_LINES)
    output_state = {
        "summary_line": None,
        "summary_counts": {},
        "coverage_percent": None,
        "collected_zero": False,
    }
    log_handle = None
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_handle = log_path.open("a" if append_log else "w", encoding="utf-8")
        log_handle.write(
            f"\n=== {datetime.now(tz=timezone.utc).isoformat()} | {block.name} ===\n"
        )
        log_handle.write(f"Command: {' '.join(cmd)}\n")

    process = subprocess.Popen(
        cmd,
        cwd=backend_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    if process.stdout is None:
        raise RuntimeError("Failed to capture pytest output.")

    summary_block_active = False
    coverage_active = False
    coverage_buffer: list[str] = []

    def stream_output() -> None:
        nonlocal summary_block_active, coverage_active

        def flush_coverage() -> None:
            nonlocal coverage_active
            if not coverage_buffer:
                coverage_active = False
                return
            formatted_plain = format_coverage_table(coverage_buffer)
            formatted_display = format_coverage_table_display(coverage_buffer)
            for formatted_line, display_line in zip(
                formatted_plain,
                formatted_display,
                strict=False,
            ):
                print(display_line)
                output_tail.append(formatted_line)
            coverage_buffer.clear()
            coverage_active = False

        for line in iter(process.stdout.readline, ""):
            stripped = line.rstrip("\n")
            display_line = stripped
            tail_line = stripped
            if coverage_active:
                if stripped and (COVERAGE_ROW_RE.match(stripped) or set(stripped) == {"-"}):
                    coverage_buffer.append(stripped)
                    if log_handle:
                        log_handle.write(line)
                    coverage_match = COVERAGE_RE.match(stripped)
                    if coverage_match:
                        output_state["coverage_percent"] = float(coverage_match.group(1))
                    continue
                flush_coverage()

            if stripped and COVERAGE_HEADER_RE.match(stripped):
                coverage_active = True
                coverage_buffer.append(stripped)
                if log_handle:
                    log_handle.write(line)
                continue
            if stripped and "test session starts" in stripped:
                print()
                display_line = f"🧪 {stripped}"
            if stripped and stripped[0].isalpha():
                status_token = stripped.split(" ", 1)[0]
                emoji = STATUS_LINE_EMOJIS.get(status_token)
                if emoji:
                    display_line = f"{emoji} {stripped}"
                    tail_line = display_line
                color = STATUS_LINE_COLORS.get(status_token)
                if color:
                    display_line = f"{color}{display_line}{ANSI_RESET}"
            if stripped and "short test summary info" in stripped:
                print()
                display_line = f"{COLOR_CYAN}{stripped}{ANSI_RESET}"
                summary_block_active = True
            elif stripped and SUMMARY_RE.search(stripped):
                if summary_block_active:
                    print()
                display_line = color_pytest_summary_line(display_line)
                summary_block_active = False
            if "Coverage HTML written to dir" in stripped:
                display_line = f"{COLOR_GREEN}{display_line}{ANSI_RESET}"
            print(display_line)
            if log_handle:
                log_handle.write(line)
            output_tail.append(tail_line)
            if "collected 0 items" in stripped:
                output_state["collected_zero"] = True
            coverage_match = COVERAGE_RE.match(stripped)
            if coverage_match:
                output_state["coverage_percent"] = float(coverage_match.group(1))
            match = SUMMARY_RE.search(stripped)
            if match:
                output_state["summary_line"] = match.group(1)
                output_state["summary_counts"] = parse_counts(output_state["summary_line"])
        flush_coverage()
        if process.stdout:
            process.stdout.close()

    output_thread = Thread(target=stream_output, daemon=True)
    output_thread.start()

    timed_out = False
    try:
        if block_timeout > 0:
            returncode = process.wait(timeout=block_timeout)
        else:
            returncode = process.wait()
    except subprocess.TimeoutExpired:
        timed_out = True
        timeout_msg = f"⏱️ Block timed out after {block_timeout:.1f}s. Terminating..."
        print(timeout_msg)
        if log_handle:
            log_handle.write(timeout_msg + "\n")
        process.terminate()
        try:
            returncode = process.wait(timeout=timeout_grace)
        except subprocess.TimeoutExpired:
            kill_msg = (
                f"⚠️ Block still running after {timeout_grace:.1f}s. Killing..."
            )
            print(kill_msg)
            if log_handle:
                log_handle.write(kill_msg + "\n")
            process.kill()
            returncode = process.wait()

    join_timeout = timeout_grace if timeout_grace > 0 else 1.0
    output_thread.join(timeout=join_timeout)
    duration = time.monotonic() - start_time
    if log_handle:
        log_handle.flush()
        log_handle.close()

    if timed_out:
        status = "timeout"
    elif returncode == 0:
        status = "ok"
    elif returncode == 5 or output_state["collected_zero"]:
        status = "empty"
    else:
        status = "failed"

    return BlockResult(
        block=block,
        command=cmd,
        returncode=returncode,
        duration=duration,
        counts=output_state["summary_counts"],
        summary_line=output_state["summary_line"],
        status=status,
        coverage=output_state["coverage_percent"],
        output_tail=list(output_tail),
        log_path=log_path,
        timed_out=timed_out,
        timeout_seconds=block_timeout if timed_out else None,
    )


def print_block_summary(result: BlockResult) -> None:
    counts_text = (
        format_counts(result.counts)
        if result.counts
        else (
            "no summary captured"
            if result.status in {"failed", "timeout"}
            else "no tests collected"
        )
    )
    status_icon = {
        "ok": "✅",
        "failed": "❌",
        "empty": "⚠️",
        "timeout": "⏱️",
    }.get(result.status, "ℹ️")
    status_label = color_status(result.status.upper(), result.status)
    coverage_text = f" | Coverage {result.coverage:.0f}%" if result.coverage is not None else ""
    print(f"{status_icon} Block summary:")
    print(
        f"{result.block.name} | {status_label} | "
        f"{result.duration:.2f}s | {counts_text}{coverage_text}"
    )


def print_failures(results: list[BlockResult]) -> None:
    failed = [result for result in results if result.status in {"failed", "timeout"}]
    if not failed:
        return

    print("\n" + "!" * 80)
    print()
    print(f"{COLOR_RED}❌ Failed/Timed-out blocks (last output lines):{ANSI_RESET}")
    for result in failed:
        print("\n" + "-" * 80)
        status_label = "TIMEOUT" if result.status == "timeout" else "FAILED"
        colored_label = color_status(status_label, result.status)
        print(f"{result.block.name} ({colored_label}, exit {result.returncode})")
        for line in result.output_tail:
            print(line)


def print_final_report(results: list[BlockResult], totals: Counter[str], duration: float) -> None:
    print("\n" + "=" * 80)
    print(f"{COLOR_CYAN}📊 Final block report{ANSI_RESET}")
    print(f"Total duration: {duration:.2f}s")
    print(f"Totals: {format_counts(dict(totals))}")
    coverage_values = [result.coverage for result in results if result.coverage is not None]
    if coverage_values:
        print(f"Coverage (latest): {coverage_values[-1]:.0f}%")
    for result in results:
        print()
        counts_text = (
            format_counts(result.counts)
            if result.counts
            else (
                "no summary"
                if result.status in {"failed", "timeout"}
                else "no tests collected"
            )
        )
        status_icon = {
            "ok": "✅",
            "failed": "❌",
            "empty": "⚠️",
            "timeout": "⏱️",
        }.get(result.status, "ℹ️")
        status_label = color_status(result.status.upper(), result.status)
        coverage_text = f" | Coverage {result.coverage:.0f}%" if result.coverage is not None else ""
        print(
            f"{status_icon} {result.block.name}: {status_label} "
            f"({result.duration:.2f}s) -> {counts_text}{coverage_text}"
        )

    print_failures(results)
    problem_blocks = [result for result in results if result.status in {"failed", "timeout"}]
    if problem_blocks:
        print("\nℹ️ Rerun failed/timeout blocks with --resume (use the same --run-id).")
    if any(result.status == "timeout" for result in results):
        print("⚠️ Coverage may be incomplete for timed-out blocks; rerun with --resume to refresh coverage.")


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser for the backend block runner."""
    parser = argparse.ArgumentParser(
        description=(
            "Run backend pytest in blocks by marker + test group to reduce RAM usage. "
            "Defaults to edge, contract, integration, and remaining tests across groups."
        )
    )
    parser.add_argument(
        "--markers",
        default="",
        help=(
            "Comma-separated marker blocks to run (edge, contract, integration, rest). "
            "Aliases: unmarked, others -> rest."
        ),
    )
    parser.add_argument(
        "--groups",
        default="",
        help=(
            "Comma-separated test groups to run (models, serializers, tasks, utils, views, root, ...)."
        ),
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available blocks and exit.",
    )
    parser.add_argument(
        "--status-and-run",
        action="store_true",
        help="Show block completion status before running blocks.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=22,
        help=(
            "Split groups into smaller blocks by test file count. "
            "Default is 22 (use 0 to disable chunking)."
        ),
    )
    parser.add_argument(
        "--views-per-file",
        action="store_true",
        help="Split views into one block per test file (applies before chunking).",
    )
    parser.add_argument(
        "--views-fast-start",
        action="store_true",
        help="Shortcut for views-heavy runs: default to rest markers.",
    )
    parser.add_argument(
        "--no-markers",
        action="store_true",
        help=(
            "Run all tests without marker filtering. "
            "Generates one block per group (or chunk) instead of one per marker."
        ),
    )
    parser.add_argument(
        "--no-skip-empty-markers",
        dest="skip_empty_markers",
        action="store_false",
        default=True,
        help="Disable automatic skipping of empty marker blocks.",
    )
    parser.add_argument(
        "--no-views-rest-default",
        action="store_true",
        help="Disable defaulting to rest markers when running views-only groups.",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=2.0,
        help="Seconds to wait between blocks to ease RAM/CPU pressure (default: 2).",
    )
    parser.add_argument(
        "--block-timeout",
        type=float,
        default=0.0,
        help="Maximum seconds per block before terminating it (0 = no timeout).",
    )
    parser.add_argument(
        "--timeout-grace",
        type=float,
        default=10.0,
        help="Seconds to wait after timeout before killing the block.",
    )
    parser.add_argument(
        "--report-dir",
        default="test-reports/backend-blocks",
        help="Directory to store per-block logs and summary reports.",
    )
    parser.add_argument(
        "--run-id",
        default="",
        help="Optional run identifier (defaults to a UTC timestamp).",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip blocks already recorded as ok/empty in the summary file.",
    )
    parser.add_argument(
        "--resume-all",
        action="store_true",
        help="Skip any blocks already recorded in the summary file.",
    )
    parser.add_argument(
        "--max-blocks",
        type=int,
        default=0,
        help="Run only the next N blocks (0 = no limit).",
    )
    parser.add_argument(
        "--reuse-db",
        dest="reuse_db",
        action="store_true",
        default=True,
        help="Reuse the existing pytest database (default).",
    )
    parser.add_argument(
        "--no-reuse-db",
        dest="reuse_db",
        action="store_false",
        help="Force pytest to recreate the database for each block.",
    )
    parser.add_argument(
        "pytest_args",
        nargs=argparse.REMAINDER,
        help="Extra args passed to pytest after '--'.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    backend_root = Path(__file__).resolve().parents[1]

    if args.run_id and not args.status_and_run:
        args.status_and_run = True
    if args.no_markers and args.markers:
        print("Error: --no-markers and --markers are mutually exclusive.")
        return 1
    if args.no_markers:
        marker_blocks = [("all", "")]
    else:
        marker_blocks = resolve_marker_blocks(parse_csv(args.markers))
    groups = filter_groups(
        discover_groups(
            backend_root,
            views_per_file=args.views_per_file,
        ),
        parse_csv(args.groups),
    )

    if not groups:
        print("No test groups discovered.")
        return 1

    if not args.no_markers and not args.markers and not args.no_views_rest_default:
        group_names = {group.name for group in groups}
        if group_names and all(name == "views" or name.startswith("views-") for name in group_names):
            marker_blocks = resolve_marker_blocks(["rest"])

    blocks = build_blocks(
        groups,
        marker_blocks,
        args.chunk_size,
        skip_empty_markers=args.skip_empty_markers,
    )

    if args.list:
        print("Available blocks:")
        for block in blocks:
            print(f"- {block.name} (marker: {block.marker})")
        return 0

    extra_args = list(args.pytest_args)
    if extra_args[:1] == ["--"]:
        extra_args = extra_args[1:]

    run_id = args.run_id or datetime.now(tz=timezone.utc).strftime("%Y%m%d-%H%M%S")
    report_base = resolve_report_dir(backend_root, args.report_dir)
    report_dir = report_base / run_id
    report_dir.mkdir(parents=True, exist_ok=True)
    summary_path = report_dir / "summary.jsonl"
    block_log_dir = report_dir / "blocks"

    marker_mode = "no markers" if args.no_markers else ", ".join(n for n, _ in marker_blocks)
    group_names_display = ", ".join(g.name for g in groups)
    print()
    print(
        f"{COLOR_CYAN}🧩 {len(blocks)} blocks to run "
        f"({len(groups)} groups: {group_names_display}) "
        f"(markers: {marker_mode}){ANSI_RESET}"
    )
    print()
    print(f"{COLOR_CYAN}🧪 Report run id: {run_id}{ANSI_RESET}")
    print()
    print(f"{COLOR_CYAN}📁 Report directory: {report_dir}{ANSI_RESET}")
    print()
    print(f"{COLOR_CYAN}🧾 Summary file: {summary_path}{ANSI_RESET}")
    print()
    print(f"{COLOR_CYAN}🧩 Block logs: {block_log_dir}{ANSI_RESET}")
    if args.block_timeout > 0:
        print()
        print(
            f"{COLOR_MAGENTA}⏱️ Block timeout: "
            f"{args.block_timeout:.1f}s (grace {args.timeout_grace:.1f}s){ANSI_RESET}"
        )

    if args.resume or args.resume_all:
        if not args.run_id:
            print("--resume/--resume-all requires --run-id to target an existing report.")
            return 1

    completed_entries = (
        load_summary_entries(summary_path)
        if (args.resume or args.resume_all or args.status_and_run)
        else {}
    )
    block_names = {block.name for block in blocks}
    if args.resume_all:
        skip_blocks = {name for name in completed_entries if name in block_names}
    elif args.resume:
        skip_blocks = {
            name
            for name, entry in completed_entries.items()
            if name in block_names and entry.get("status") in {"ok", "empty"}
        }
    else:
        skip_blocks = set()

    if skip_blocks:
        print()
        print(
            f"{COLOR_ORANGE}⏭️ Skipping {len(skip_blocks)} blocks already in summary.{ANSI_RESET}"
        )

    skipped_entries = {name: entry for name, entry in completed_entries.items() if name in skip_blocks}
    if skip_blocks and len(skip_blocks) == len(blocks):
        print("✅ No pending blocks to run for this selection (all are in summary).")
    entries_for_blocks = {
        name: entry for name, entry in completed_entries.items() if name in block_names
    }
    if args.status_and_run:
        print()
        status_counts = Counter(
            entry.get("status", "unknown") for entry in entries_for_blocks.values()
        )
        print_status_report(status_counts, len(blocks))

    results, totals = results_from_summary(skipped_entries, [block.name for block in blocks])
    total_duration = 0.0
    failed = False
    executed = 0
    progress_total = len(blocks)
    progress_completed = len(skipped_entries)
    progress_duration_sum = sum(result.duration for result in results)
    status_counts = Counter(result.status for result in results)
    group_totals = Counter(block_group_name(block.name) for block in blocks)
    group_completed = Counter(block_group_name(name) for name in skipped_entries)

    for block in blocks:
        if block.name in skip_blocks:
            continue
        if args.max_blocks and executed >= args.max_blocks:
            print("Reached --max-blocks limit, stopping early.")
            break
        log_path = block_log_dir / f"{safe_block_filename(block.name)}.log"
        result = run_pytest_block(
            block,
            backend_root,
            args.reuse_db,
            extra_args,
            log_path=log_path,
            append_log=args.resume or args.resume_all,
            block_timeout=args.block_timeout,
            timeout_grace=args.timeout_grace,
        )
        results.append(result)
        total_duration += result.duration
        totals.update(result.counts)
        print_block_summary(result)
        print()
        status_counts[result.status] += 1
        prior_entry = entries_for_blocks.get(block.name)
        if prior_entry:
            prior_status = prior_entry.get("status")
            if isinstance(prior_status, str):
                status_counts[prior_status] -= 1
                if status_counts[prior_status] <= 0:
                    del status_counts[prior_status]
        progress_completed += 1
        progress_duration_sum += result.duration
        group_name = block_group_name(block.name)
        group_completed[group_name] += 1
        avg_duration = (
            progress_duration_sum / progress_completed
            if progress_completed > 0
            else 0.0
        )
        remaining_blocks = max(progress_total - progress_completed, 0)
        eta_seconds = avg_duration * remaining_blocks if avg_duration > 0 else None
        print_progress_summary(
            progress_completed,
            progress_total,
            group_name,
            group_completed[group_name],
            group_totals[group_name],
            eta_seconds,
        )
        print()
        print_status_report(status_counts, progress_total)
        append_summary(summary_path, result)
        if result.status in {"failed", "timeout"}:
            failed = True
        if args.sleep > 0:
            time.sleep(args.sleep)
        executed += 1

    print_final_report(results, totals, total_duration)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
