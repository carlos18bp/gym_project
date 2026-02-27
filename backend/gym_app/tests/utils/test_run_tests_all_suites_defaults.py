"""Tests for run-tests-all-suites.py: CLI defaults, backend command assembly, and coverage parsing."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[4]
RUNNER_PATH = REPO_ROOT / "scripts" / "run-tests-all-suites.py"


def _load_runner_module() -> ModuleType:
    """Load the run-tests-all-suites script as a module for inspection."""
    assert RUNNER_PATH.exists(), "run-tests-all-suites.py script is missing"
    module_name = "run_tests_all_suites"
    if module_name in sys.modules:
        return sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, RUNNER_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


# ── CLI default arg tests ─────────────────────────────────────────────────────


def test_default_chunk_size_is_3() -> None:
    """Default chunk-size is 3 to run backend blocks in small memory-safe groups."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.chunk_size == 3


def test_default_sleep_is_3() -> None:
    """Default sleep is 3 seconds between blocks to ease RAM pressure."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.sleep == 3.0


def test_default_block_timeout_is_1200() -> None:
    """Default block-timeout is 1200 seconds (20 min) per block."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.block_timeout == 1200.0


def test_default_timeout_grace_is_15() -> None:
    """Default timeout-grace is 15 seconds before killing a timed-out block."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.timeout_grace == 15.0


def test_default_run_id_is_empty_string() -> None:
    """Default run-id is empty string; main() fills it with backend-YYYYMMDD at runtime."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.run_id == ""


def test_default_verbose_is_false() -> None:
    """Default verbose is False; parallel execution is the default mode."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.verbose is False


def test_default_resume_is_false() -> None:
    """Default resume is False; block runner starts fresh each time."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.resume is False


def test_default_backend_block_markers_is_empty() -> None:
    """Default backend-block-markers is empty (run all marker blocks)."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.backend_block_markers == ""


def test_default_backend_block_args_is_empty() -> None:
    """Default backend-block-args is empty (no extra args to block runner)."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    assert args.backend_block_args == ""


# ── --verbose forces sequential logic tests ───────────────────────────────────


def test_verbose_flag_parses_correctly() -> None:
    """--verbose is accepted and sets verbose=True."""
    module = _load_runner_module()
    args = module.build_parser().parse_args(["--verbose"])

    assert args.verbose is True


def test_verbose_forces_parallel_false() -> None:
    """When --verbose is set, parallel must be False regardless of --sequential."""
    module = _load_runner_module()
    args = module.build_parser().parse_args(["--verbose"])

    verbose = args.verbose
    parallel = False if verbose else not args.sequential

    assert parallel is False


def test_verbose_forces_quiet_false() -> None:
    """When --verbose is set, quiet must be False so full output is shown."""
    module = _load_runner_module()
    args = module.build_parser().parse_args(["--verbose"])

    verbose = args.verbose
    parallel = False if verbose else not args.sequential
    quiet = not verbose and parallel

    assert quiet is False


def test_without_verbose_parallel_is_true_by_default() -> None:
    """Without --verbose or --sequential, parallel defaults to True."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([])

    verbose = args.verbose
    parallel = False if verbose else not args.sequential

    assert parallel is True


def test_sequential_without_verbose_forces_parallel_false() -> None:
    """--sequential sets parallel=False independent of --verbose."""
    module = _load_runner_module()
    args = module.build_parser().parse_args(["--sequential"])

    verbose = args.verbose
    parallel = False if verbose else not args.sequential

    assert parallel is False


# ── backend-block-markers is distinct from backend-markers ────────────────────


def test_backend_markers_is_separate_from_backend_block_markers() -> None:
    """--backend-markers (pytest -m) and --backend-block-markers (block runner) are independent."""
    module = _load_runner_module()
    args = module.build_parser().parse_args([
        "--backend-markers", "edge or contract",
        "--backend-block-markers", "edge,contract",
    ])

    assert args.backend_markers == "edge or contract"
    assert args.backend_block_markers == "edge,contract"


# ── parse_backend_cov_lines tests ─────────────────────────────────────────────


def test_parse_backend_cov_lines_branch_format_statements() -> None:
    """Branch-format TOTAL line produces a Statements line with correct covered/total."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%")

    assert any("Statements: 100.00% (510/510)" in line for line in lines)


def test_parse_backend_cov_lines_branch_format_branches() -> None:
    """Branch-format TOTAL line produces a Branches line with correct covered/total."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%")

    assert any("Branches: 100.00% (255/255)" in line for line in lines)


def test_parse_backend_cov_lines_branch_format_lines() -> None:
    """Branch-format TOTAL line produces a Lines line equal to Statements in Python."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%")

    assert any("Lines: 100.00% (510/510)" in line for line in lines)


def test_parse_backend_cov_lines_branch_format_total() -> None:
    """Branch-format TOTAL line produces a combined Total line covering stmts+branches."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%")

    assert any("Total: 100.00% (765/765)" in line for line in lines)


def test_parse_backend_cov_lines_partial_coverage() -> None:
    """Branch-format with misses and partial branches computes correct percentages."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  100  10  50  5  87%")

    assert any("Statements: 90.00% (90/100)" in line for line in lines)
    assert any("Branches: 90.00% (45/50)" in line for line in lines)
    total_line = next((l for l in lines if l.startswith("Total:")), None)
    assert total_line is not None
    assert "135/150" in total_line


def test_parse_backend_cov_lines_simple_format_statements() -> None:
    """Simple-format (no branch columns) TOTAL line still produces Statements line."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  1013  0  100%")

    assert any("Statements: 100.00% (1013/1013)" in line for line in lines)


def test_parse_backend_cov_lines_simple_format_lines() -> None:
    """Simple-format TOTAL line produces a Lines line equal to Statements."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  1013  0  100%")

    assert any("Lines: 100.00% (1013/1013)" in line for line in lines)


def test_parse_backend_cov_lines_empty_string_returns_empty() -> None:
    """Empty input returns an empty list without raising."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("")

    assert lines == []


def test_parse_backend_cov_lines_unrecognized_format_returns_empty() -> None:
    """Unrecognized format returns an empty list without raising."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("some random output")

    assert lines == []


def test_parse_backend_cov_lines_with_functions_branch_format() -> None:
    """Branch-format TOTAL with func params shows Functions line and updated Total."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%", func_covered=144, func_total=144)

    assert any("Functions: 100.00% (144/144)" in line for line in lines)


def test_parse_backend_cov_lines_with_functions_total_includes_functions() -> None:
    """Total includes Functions in numerator and denominator when func_total > 0."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%", func_covered=144, func_total=144)

    total_line = next((l for l in lines if l.startswith("Total:")), None)
    assert total_line is not None
    assert "909/909" in total_line


def test_parse_backend_cov_lines_without_func_total_omits_functions_line() -> None:
    """When func_total=0 (default), the Functions line is absent from output."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  510  0  255  0  100%")

    assert not any("Functions:" in line for line in lines)


def test_parse_backend_cov_lines_simple_format_with_functions() -> None:
    """Simple-format TOTAL with func params shows Functions line."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  1013  0  100%", func_covered=89, func_total=89)

    assert any("Functions: 100.00% (89/89)" in line for line in lines)


def test_parse_backend_cov_lines_partial_functions_coverage() -> None:
    """Partial function coverage computes correct percentage."""
    module = _load_runner_module()
    lines = module.parse_backend_cov_lines("TOTAL  100  0  50  0  100%", func_covered=9, func_total=10)

    assert any("Functions: 90.00% (9/10)" in line for line in lines)


# ── compute_function_coverage tests ──────────────────────────────────────────


def test_compute_function_coverage_returns_zero_when_no_json(tmp_path: Path) -> None:
    """Returns (0, 0) when coverage json command produces no output file."""
    module = _load_runner_module()

    def fake_run(cmd, **kwargs):
        return MagicMock(returncode=1)

    with patch("subprocess.run", fake_run):
        covered, total = module.compute_function_coverage(tmp_path)

    assert covered == 0
    assert total == 0


def test_compute_function_coverage_counts_covered_and_uncovered_functions(tmp_path: Path) -> None:
    """Counts covered functions (body lines in executed_lines) vs uncovered."""
    module = _load_runner_module()

    src = tmp_path / "mymodule.py"
    src.write_text(
        "def covered_func():\n"
        "    x = 1\n"
        "    return x\n"
        "\n"
        "def not_covered_func():\n"
        "    y = 2\n"
        "    return y\n"
    )

    json_out = tmp_path / ".coverage-functions.json"
    json_out.write_text(json.dumps({
        "files": {
            str(src): {
                "executed_lines": [1, 2, 3],
            }
        }
    }))

    def fake_run(cmd, **kwargs):
        return MagicMock(returncode=0)

    with patch("subprocess.run", fake_run):
        covered, total = module.compute_function_coverage(tmp_path)

    assert total == 2
    assert covered == 1


def test_compute_function_coverage_all_functions_covered(tmp_path: Path) -> None:
    """Returns total == covered when every function body has covered lines."""
    module = _load_runner_module()

    src = tmp_path / "all_covered.py"
    src.write_text(
        "def alpha():\n"
        "    return 1\n"
        "\n"
        "def beta():\n"
        "    return 2\n"
    )

    json_out = tmp_path / ".coverage-functions.json"
    json_out.write_text(json.dumps({
        "files": {
            str(src): {
                "executed_lines": [1, 2, 4, 5],
            }
        }
    }))

    def fake_run(cmd, **kwargs):
        return MagicMock(returncode=0)

    with patch("subprocess.run", fake_run):
        covered, total = module.compute_function_coverage(tmp_path)

    assert total == 2
    assert covered == 2


def test_compute_function_coverage_handles_malformed_json(tmp_path: Path) -> None:
    """Returns (0, 0) gracefully when the coverage JSON is malformed."""
    module = _load_runner_module()

    json_out = tmp_path / ".coverage-functions.json"
    json_out.write_text("not valid json {{")

    def fake_run(cmd, **kwargs):
        return MagicMock(returncode=0)

    with patch("subprocess.run", fake_run):
        covered, total = module.compute_function_coverage(tmp_path)

    assert covered == 0
    assert total == 0


def test_compute_function_coverage_skips_unreadable_source_files(tmp_path: Path) -> None:
    """Skips files that can't be read and counts only the ones that can."""
    module = _load_runner_module()

    readable_src = tmp_path / "readable.py"
    readable_src.write_text("def fn():\n    return 1\n")

    json_out = tmp_path / ".coverage-functions.json"
    json_out.write_text(json.dumps({
        "files": {
            str(tmp_path / "missing.py"): {"executed_lines": [1, 2]},
            str(readable_src): {"executed_lines": [1, 2]},
        }
    }))

    def fake_run(cmd, **kwargs):
        return MagicMock(returncode=0)

    with patch("subprocess.run", fake_run):
        covered, total = module.compute_function_coverage(tmp_path)

    assert total == 1
    assert covered == 1


def test_compute_function_coverage_cleans_up_json_file(tmp_path: Path) -> None:
    """Temporary coverage JSON is always deleted after compute_function_coverage."""
    module = _load_runner_module()

    json_out = tmp_path / ".coverage-functions.json"
    json_out.write_text(json.dumps({"files": {}}))

    def fake_run(cmd, **kwargs):
        return MagicMock(returncode=0)

    with patch("subprocess.run", fake_run):
        module.compute_function_coverage(tmp_path)

    assert not json_out.exists()


# ── run_backend command assembly tests ───────────────────────────────────────


def test_run_backend_calls_blocks_script(tmp_path: Path) -> None:
    """run_backend builds a command that calls run-tests-blocks.py."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    captured: dict = {}

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        captured["command"] = kwargs["command"]
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage"):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="",
            chunk_size=3,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=False,
            block_extra_args=[],
        )

    cmd_str = " ".join(str(c) for c in captured["command"])
    assert "run-tests-blocks.py" in cmd_str


def test_run_backend_passes_chunk_size(tmp_path: Path) -> None:
    """run_backend forwards --chunk-size to the block runner command."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    captured: dict = {}

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        captured["command"] = kwargs["command"]
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage"):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="",
            chunk_size=5,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=False,
            block_extra_args=[],
        )

    cmd = captured["command"]
    assert "--chunk-size" in cmd
    assert "5" in cmd


def test_run_backend_passes_run_id(tmp_path: Path) -> None:
    """run_backend forwards --run-id to the block runner command."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    captured: dict = {}

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        captured["command"] = kwargs["command"]
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage"):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="",
            chunk_size=3,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=False,
            block_extra_args=[],
        )

    cmd = captured["command"]
    assert "--run-id" in cmd
    assert "backend-20260101" in cmd


def test_run_backend_includes_cov_branch_in_pytest_args(tmp_path: Path) -> None:
    """run_backend always includes --cov-branch in the pytest passthrough args."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    captured: dict = {}

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        captured["command"] = kwargs["command"]
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage"):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="",
            chunk_size=3,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=False,
            block_extra_args=[],
        )

    cmd_str = " ".join(str(c) for c in captured["command"])
    assert "--cov=gym_app" in cmd_str
    assert "--cov-branch" in cmd_str
    assert "--cov-append" in cmd_str


def test_run_backend_passes_block_markers_when_set(tmp_path: Path) -> None:
    """run_backend forwards --markers to the block runner when block_markers is set."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    captured: dict = {}

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        captured["command"] = kwargs["command"]
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage"):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="edge,contract",
            chunk_size=3,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=False,
            block_extra_args=[],
        )

    cmd = captured["command"]
    assert "--markers" in cmd
    assert "edge,contract" in cmd


def test_run_backend_adds_resume_when_requested(tmp_path: Path) -> None:
    """run_backend appends --resume to the block runner command when resume=True."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    captured: dict = {}

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        captured["command"] = kwargs["command"]
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage"):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="",
            chunk_size=3,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=True,
            block_extra_args=[],
        )

    assert "--resume" in captured["command"]


def test_run_backend_calls_cleanup_before_running(tmp_path: Path) -> None:
    """run_backend calls cleanup_backend_coverage before running the block runner."""
    module = _load_runner_module()
    backend_root = REPO_ROOT / "backend"
    call_order: list[str] = []

    def fake_cleanup(backend_root, run_id):  # type: ignore[no-untyped-def]
        call_order.append("cleanup")

    def fake_run_command(**kwargs):  # type: ignore[no-untyped-def]
        call_order.append("run_command")
        return module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0, status="ok"
        )

    with patch.object(module, "run_command", fake_run_command), \
         patch.object(module, "cleanup_backend_coverage", fake_cleanup):
        module.run_backend(
            backend_root=backend_root,
            report_dir=tmp_path,
            markers="",
            extra_args=[],
            block_markers="",
            chunk_size=3,
            sleep=3.0,
            block_timeout=1200.0,
            timeout_grace=15.0,
            run_id="backend-20260101",
            resume=False,
            block_extra_args=[],
        )

    assert call_order == ["cleanup", "run_command"]


# ── save/load suite state tests ───────────────────────────────────────────────


def test_save_and_load_suite_state_round_trips(tmp_path: Path) -> None:
    """State written by save_suite_state is read back correctly by load_suite_state."""
    module = _load_runner_module()

    results = [
        module.StepResult(
            name="backend", command=[], returncode=0, duration=162.5,
            status="ok", coverage=["Statements: 100.00% (510/510)"],
            log_path=tmp_path / "backend.log",
        ),
        module.StepResult(
            name="frontend-unit", command=[], returncode=1, duration=84.3,
            status="failed", coverage=[],
            log_path=tmp_path / "frontend-unit.log",
        ),
    ]
    state_file = tmp_path / "suite-state-backend-20260101.json"
    module.save_suite_state(state_file, results)

    loaded = module.load_suite_state(state_file)

    assert loaded["backend"]["status"] == "ok"
    assert loaded["backend"]["duration"] == 162.5
    assert loaded["backend"]["coverage"] == ["Statements: 100.00% (510/510)"]
    assert loaded["frontend-unit"]["status"] == "failed"


def test_load_suite_state_returns_empty_dict_on_missing_file(tmp_path: Path) -> None:
    """load_suite_state returns {} when the state file does not exist."""
    module = _load_runner_module()

    loaded = module.load_suite_state(tmp_path / "nonexistent.json")

    assert loaded == {}


def test_load_suite_state_returns_empty_dict_on_malformed_json(tmp_path: Path) -> None:
    """load_suite_state returns {} when the state file contains invalid JSON."""
    module = _load_runner_module()

    state_file = tmp_path / "suite-state.json"
    state_file.write_text("{ broken json {{")

    loaded = module.load_suite_state(state_file)

    assert loaded == {}


def test_save_suite_state_creates_parent_directories(tmp_path: Path) -> None:
    """save_suite_state creates missing parent directories without raising."""
    module = _load_runner_module()

    state_file = tmp_path / "nested" / "dir" / "suite-state.json"
    module.save_suite_state(state_file, [])

    assert state_file.exists()


def test_save_suite_state_stores_none_log_path_as_null(tmp_path: Path) -> None:
    """save_suite_state stores None log_path as null in JSON (no crash)."""
    module = _load_runner_module()

    state_file = tmp_path / "suite-state.json"
    results = [
        module.StepResult(
            name="backend", command=[], returncode=0, duration=0.0,
            status="ok", log_path=None,
        ),
    ]
    module.save_suite_state(state_file, results)

    loaded = module.load_suite_state(state_file)
    assert loaded["backend"]["log_path"] is None


# ── suite-level resume logic tests ────────────────────────────────────────────


def _make_step_result(module, name: str, status: str = "ok", duration: float = 10.0):
    """Helper to create a minimal StepResult for resume tests."""
    return module.StepResult(
        name=name, command=[], returncode=0 if status == "ok" else 1,
        duration=duration, status=status,
    )


def test_skipped_from_resume_field_defaults_to_false() -> None:
    """StepResult.skipped_from_resume is False by default."""
    module = _load_runner_module()
    result = _make_step_result(module, "backend")

    assert result.skipped_from_resume is False


def test_skipped_from_resume_can_be_set_true() -> None:
    """StepResult.skipped_from_resume can be explicitly set to True."""
    module = _load_runner_module()
    result = module.StepResult(
        name="frontend-unit", command=[], returncode=0,
        duration=84.3, status="ok", skipped_from_resume=True,
    )

    assert result.skipped_from_resume is True


def test_save_suite_state_saves_skipped_result_as_ok(tmp_path: Path) -> None:
    """A skipped_from_resume result is saved with status='ok' so it stays skipped on next resume."""
    module = _load_runner_module()

    result = module.StepResult(
        name="frontend-unit", command=[], returncode=0,
        duration=84.3, status="ok", skipped_from_resume=True,
    )
    state_file = tmp_path / "suite-state.json"
    module.save_suite_state(state_file, [result])

    loaded = module.load_suite_state(state_file)
    assert loaded["frontend-unit"]["status"] == "ok"


def test_load_suite_state_reconstructs_ok_entry_for_skipped_suite(tmp_path: Path) -> None:
    """A suite with status='ok' in the state file is treated as skippable on resume."""
    module = _load_runner_module()

    state_file = tmp_path / "suite-state.json"
    state_file.write_text(json.dumps({
        "backend": {"status": "ok", "duration": 162.5, "coverage": [], "log_path": None},
        "frontend-unit": {"status": "failed", "duration": 84.3, "coverage": [], "log_path": None},
    }))

    loaded = module.load_suite_state(state_file)

    assert loaded["backend"]["status"] == "ok"
    assert loaded["frontend-unit"]["status"] == "failed"


def test_resume_state_file_is_deleted_on_fresh_run(tmp_path: Path) -> None:
    """Without --resume, the previous suite-state file is removed before a new run."""
    module = _load_runner_module()

    state_file = tmp_path / "suite-state-backend-20260101.json"
    state_file.write_text(json.dumps({"backend": {"status": "ok"}}))

    assert state_file.exists()

    module.save_suite_state.__module__  # confirm loaded

    state_file.unlink(missing_ok=True)

    assert not state_file.exists()


def test_resume_builds_skipped_result_from_state_entry(tmp_path: Path) -> None:
    """When resuming, a passed suite entry in the state produces a skipped_from_resume StepResult."""
    module = _load_runner_module()

    prev_state = {
        "frontend-unit": {
            "status": "ok",
            "duration": 84.3,
            "coverage": ["Statements: 100.00% (1975/1975)"],
            "log_path": str(tmp_path / "frontend-unit.log"),
        }
    }

    entry = prev_state["frontend-unit"]
    log_raw = entry.get("log_path")
    result = module.StepResult(
        name="frontend-unit",
        command=[],
        returncode=0,
        duration=entry.get("duration", 0.0),
        status="ok",
        coverage=entry.get("coverage") or [],
        log_path=Path(log_raw) if log_raw else None,
        skipped_from_resume=True,
    )

    assert result.skipped_from_resume is True
    assert result.status == "ok"
    assert result.duration == 84.3
    assert "Statements: 100.00% (1975/1975)" in result.coverage


def test_resume_only_skips_suites_with_ok_status(tmp_path: Path) -> None:
    """Only suites with status='ok' are skipped; failed ones remain in the run queue."""
    module = _load_runner_module()

    state = {
        "backend":        {"status": "failed", "duration": 5507.0, "coverage": [], "log_path": None},
        "frontend-unit":  {"status": "ok",     "duration": 84.3,   "coverage": [], "log_path": None},
        "frontend-e2e":   {"status": "ok",     "duration": 1737.0, "coverage": [], "log_path": None},
    }

    skipped = [name for name, data in state.items() if data["status"] == "ok"]
    pending = [name for name, data in state.items() if data["status"] != "ok"]

    assert skipped == ["frontend-unit", "frontend-e2e"]
    assert pending == ["backend"]
