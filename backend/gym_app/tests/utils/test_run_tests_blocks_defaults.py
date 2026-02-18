"""Tests for backend run-tests-blocks defaults."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


REPO_ROOT = Path(__file__).resolve().parents[4]
RUNNER_PATH = REPO_ROOT / "backend" / "scripts" / "run-tests-blocks.py"


def _load_runner_module() -> ModuleType:
    """Load the run-tests-blocks script as a module for inspection."""
    assert RUNNER_PATH.exists(), "run-tests-blocks.py script is missing"
    module_name = "run_tests_blocks"
    spec = importlib.util.spec_from_file_location(module_name, RUNNER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_backend_run_tests_blocks_default_chunk_size() -> None:
    """Default chunk size is 22 to split backend test blocks safely."""
    module = _load_runner_module()
    parser = module.build_parser()
    args = parser.parse_args([])

    assert args.chunk_size == 22
