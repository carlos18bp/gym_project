"""Regression tests for test quality gate tooling helpers."""

import ast
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[4]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from quality.backend_analyzer import ASTAnalyzer  # noqa: E402
from quality.base import Config, IssueCategory, Severity  # noqa: E402
from quality.frontend_e2e_analyzer import FrontendE2EAnalyzer  # noqa: E402
from quality.frontend_unit_analyzer import FrontendUnitAnalyzer  # noqa: E402
from quality.js_ast_bridge import JSFileResult, JSIssueInfo, JSTestInfo  # noqa: E402
from quality.patterns import Patterns  # noqa: E402
from test_quality_gate import QualityReport  # noqa: E402


def _build_analyzers(tmp_path: Path) -> tuple[FrontendUnitAnalyzer, FrontendE2EAnalyzer]:
    """Create frontend analyzers with shared config/patterns for tests."""
    config = Config()
    patterns = Patterns(config)
    unit = FrontendUnitAnalyzer(tmp_path, config, patterns)
    e2e = FrontendE2EAnalyzer(tmp_path, config, patterns)
    return unit, e2e


def _write_backend_test(repo_root: Path, relative_path: str, source: str) -> Path:
    """Create a backend test file inside a synthetic repository tree."""
    file_path = repo_root / relative_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(source, encoding="utf-8")
    return file_path


def test_quality_report_include_file_filters_backend_suite(tmp_path: Path) -> None:
    """QualityReport include-file keeps only explicit backend files in the final report."""
    selected_rel = "backend/gym_app/tests/models/test_selected.py"
    skipped_rel = "backend/gym_app/tests/models/test_skipped.py"
    selected_abs = _write_backend_test(
        tmp_path,
        selected_rel,
        "def test_selected_missing_assertion():\n    value = 1\n",
    ).resolve()
    _write_backend_test(
        tmp_path,
        skipped_rel,
        "def test_skipped_missing_assertion():\n    value = 2\n",
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        include_files=[str(selected_abs)],
    ).build()

    backend_files = [entry["file"] for entry in report["backend"]["file_details"]]
    backend_issue_files = {issue["file"] for issue in report["backend"]["issues"]}

    assert backend_files == [selected_rel]
    assert backend_issue_files == {selected_rel}
    assert report["summary"]["errors"] == 1


def test_quality_report_include_glob_filters_backend_suite(tmp_path: Path) -> None:
    """QualityReport include-glob supports scoped backend runs by path patterns."""
    model_rel = "backend/gym_app/tests/models/test_model_scope.py"
    serializer_rel = "backend/gym_app/tests/serializers/test_serializer_scope.py"
    _write_backend_test(
        tmp_path,
        model_rel,
        "def test_model_scope_missing_assertion():\n    data = 1\n",
    )
    _write_backend_test(
        tmp_path,
        serializer_rel,
        "def test_serializer_scope_missing_assertion():\n    data = 2\n",
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        include_globs=["backend/gym_app/tests/models/test_*.py"],
    ).build()

    backend_files = [entry["file"] for entry in report["backend"]["file_details"]]
    backend_issue_files = {issue["file"] for issue in report["backend"]["issues"]}

    assert backend_files == [model_rel]
    assert backend_issue_files == {model_rel}
    assert report["summary"]["errors"] == 1


def test_count_patches_includes_patch_object_variants() -> None:
    """ASTAnalyzer counts @patch, @patch.object, and @mock.patch.object decorators."""
    source = """
from unittest.mock import patch
import unittest.mock as mock

@patch("gym_app.views.process.get_user")
@patch.object(Service, "sync")
@mock.patch.object(Worker, "run")
def test_example():
    assert True
"""

    tree = ast.parse(source)
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef))

    assert ASTAnalyzer.count_patches(function) == 3


def test_frontend_unit_reports_explicit_error_when_ast_bridge_unavailable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit analyzer emits PARSE_ERROR instead of silently returning an empty suite."""
    unit_analyzer, _ = _build_analyzers(tmp_path)
    monkeypatch.setattr(unit_analyzer.bridge, "is_available", lambda: False)

    result = unit_analyzer.analyze_suite(tmp_path / "frontend" / "test")

    assert result.file_count == 1
    assert result.test_count == 0
    issue = result.all_issues[0]
    assert issue.category == IssueCategory.PARSE_ERROR
    assert issue.severity == Severity.ERROR
    assert "not analyzed" in issue.message.lower()


def test_frontend_e2e_reports_explicit_error_when_ast_bridge_unavailable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """E2E analyzer emits PARSE_ERROR instead of silently returning an empty suite."""
    _, e2e_analyzer = _build_analyzers(tmp_path)
    monkeypatch.setattr(e2e_analyzer.bridge, "is_available", lambda: False)

    result = e2e_analyzer.analyze_suite(tmp_path / "frontend" / "e2e")

    assert result.file_count == 1
    assert result.test_count == 0
    issue = result.all_issues[0]
    assert issue.category == IssueCategory.PARSE_ERROR
    assert issue.severity == Severity.ERROR
    assert "not analyzed" in issue.message.lower()


def test_fragile_selector_uses_fragile_locator_category(tmp_path: Path) -> None:
    """Fragile locator findings are classified under FRAGILE_LOCATOR."""
    _, e2e_analyzer = _build_analyzers(tmp_path)
    file_path = tmp_path / "frontend" / "e2e" / "sample.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("await page.locator('.cta-button').click();\n", encoding="utf-8")

    issues = e2e_analyzer._check_selectors(file_path)

    assert len(issues) == 1
    assert issues[0].category == IssueCategory.FRAGILE_LOCATOR


def test_e2e_analyzer_does_not_duplicate_hardcoded_timeout_issue(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """E2E analyzer keeps a single SLEEP_CALL issue when AST already reports timeout."""
    _, e2e_analyzer = _build_analyzers(tmp_path)
    file_path = tmp_path / "frontend" / "e2e" / "timeouts.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("test('waits', async ({ page }) => {\n  await page.waitForTimeout(1200);\n  await expect(page).toHaveURL(/dash/);\n});\n", encoding="utf-8")

    parse_result = JSFileResult(
        file_path=str(file_path),
        tests=[JSTestInfo(name="waits", full_context="timeouts > waits", line=1, end_line=4, num_lines=4, test_type="test", has_assertions=True, assertion_count=1, has_hardcoded_timeout=True, timeout_value=1200)],
        issues=[JSIssueInfo(issue_type="HARDCODED_TIMEOUT", message="Hardcoded timeout (1200ms)", line=2, identifier="waits")],
        error=None, test_count=1, issue_count=1,
    )
    monkeypatch.setattr(e2e_analyzer.bridge, "parse_file", lambda *_a, **_k: parse_result)

    result = e2e_analyzer.analyze_file(file_path)
    sleep_issues = [i for i in result.issues if i.category == IssueCategory.SLEEP_CALL]
    assert len(sleep_issues) == 1
    assert sleep_issues[0].line == 2


def test_ast_parser_resets_describe_context_between_sibling_blocks(tmp_path: Path) -> None:
    """ast-parser keeps describe context scoped to its own block (push/pop symmetry)."""
    parser_script = REPO_ROOT / "frontend" / "scripts" / "ast-parser.cjs"
    babel_parser_dir = REPO_ROOT / "frontend" / "node_modules" / "@babel" / "parser"

    if shutil.which("node") is None or not parser_script.exists() or not babel_parser_dir.exists():
        pytest.skip("Node.js AST parser dependencies are not available in this environment")

    js_file = tmp_path / "describe-context.spec.js"
    js_file.write_text(
        """
describe('suite A', () => {
  test('case 1', () => {
    expect(1).toBe(1);
  });
});

describe('suite B', () => {
  test('case 2', () => {
    expect(2).toBe(2);
  });
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    process = subprocess.run(
        ["node", str(parser_script), str(js_file)],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(REPO_ROOT / "frontend"),
    )

    assert process.returncode == 0, process.stderr or process.stdout
    payload = json.loads(process.stdout)
    contexts = {test["name"]: test["fullContext"] for test in payload["tests"]}

    assert contexts["case 1"] == "suite A > case 1"
    assert contexts["case 2"] == "suite B > case 2"
