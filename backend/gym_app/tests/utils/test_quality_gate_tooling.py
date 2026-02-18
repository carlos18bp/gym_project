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
from quality.base import (  # noqa: E402
    Config,
    ExternalLintFinding,
    FileResult,
    Issue,
    IssueCategory,
    Severity,
    SuiteResult,
)
from quality.external_lint import ExternalLintRunResult, ExternalLintRunner  # noqa: E402
from quality.frontend_e2e_analyzer import FrontendE2EAnalyzer  # noqa: E402
from quality.frontend_unit_analyzer import FrontendUnitAnalyzer  # noqa: E402
from quality.js_ast_bridge import JSFileResult, JSIssueInfo, JSTestInfo  # noqa: E402
from quality.patterns import Patterns  # noqa: E402
import test_quality_gate as quality_gate_module  # noqa: E402
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


def _run_ast_parser_payload(js_file: Path, is_e2e: bool = False) -> dict[str, object]:
    """Run AST parser script and return parsed JSON payload."""
    parser_script = REPO_ROOT / "frontend" / "scripts" / "ast-parser.cjs"
    babel_parser_dir = REPO_ROOT / "frontend" / "node_modules" / "@babel" / "parser"

    if shutil.which("node") is None or not parser_script.exists() or not babel_parser_dir.exists():
        pytest.skip("Node.js AST parser dependencies are not available in this environment")

    command = ["node", str(parser_script), str(js_file)]
    if is_e2e:
        command.append("--e2e")

    process = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
        cwd=str(REPO_ROOT / "frontend"),
    )

    assert process.returncode == 0, process.stderr or process.stdout
    return json.loads(process.stdout)


def _build_backend_report_for_source(tmp_path: Path, relative_path: str, source: str) -> dict[str, object]:
    """Build backend-only quality report for a single synthetic test file."""
    target = _write_backend_test(tmp_path, relative_path, source).resolve()
    return QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        include_files=[str(target)],
    ).build()


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


def test_backend_nondeterministic_sources_warn_without_explicit_controls(tmp_path: Path) -> None:
    """Backend analyzer emits NONDETERMINISTIC when clock/random sources are uncontrolled."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_nondeterministic_uncontrolled.py",
        """
from django.utils import timezone
import random


def test_uncontrolled_time_and_random():
    now = timezone.now()
    value = random.random()
    assert now is not None
    assert value >= 0
""".strip()
        + "\n",
    )

    issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue["category"] == IssueCategory.NONDETERMINISTIC.name.lower()
    ]

    assert len(issues) == 1
    assert issues[0]["severity"] == Severity.WARNING.value


def test_backend_nondeterministic_sources_are_accepted_with_controls(tmp_path: Path) -> None:
    """Deterministic controls (random.seed/freeze_time) suppress NONDETERMINISTIC findings."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_nondeterministic_controlled.py",
        """
from freezegun import freeze_time
import random


def test_controlled_time_and_random():
    with freeze_time('2025-01-01'):
        random.seed(7)
        value = random.random()
    assert value >= 0
""".strip()
        + "\n",
    )

    issue_types = {issue["category"] for issue in report["backend"]["issues"]}
    assert IssueCategory.NONDETERMINISTIC.name.lower() not in issue_types


def test_semantic_rules_off_suppresses_backend_semantic_findings(tmp_path: Path) -> None:
    """semantic_rules=off suppresses backend semantic findings while preserving hygiene checks."""
    target = _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_semantic_off_backend.py",
        """
from django.utils import timezone


def test_semantic_off_backend():
    now = timezone.now()
    assert now is not None
""".strip()
        + "\n",
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="off",
        include_files=[str(target.resolve())],
    ).build()

    categories = {issue["category"] for issue in report["backend"]["issues"]}
    assert IssueCategory.NONDETERMINISTIC.name.lower() not in categories
    assert report["summary"]["semantic_suppressed_by_mode"]["backend"] >= 1
    assert report["backend"]["suite_findings"]["semantic_issues_suppressed_by_mode"] >= 1


def test_backend_network_io_dependency_emits_warning(tmp_path: Path) -> None:
    """Direct requests/open calls in backend tests are flagged as NETWORK_DEPENDENCY."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_network_io_dependency.py",
        """
import requests


def test_direct_network_and_io_dependency():
    response = requests.get('https://example.com')
    with open('/tmp/backend-quality-gate.txt', 'w', encoding='utf-8') as handler:
        handler.write('sample')
    assert response is not None
""".strip()
        + "\n",
    )

    issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue["category"] == IssueCategory.NETWORK_DEPENDENCY.name.lower()
    ]

    assert len(issues) == 1
    assert issues[0]["severity"] == Severity.WARNING.value
    assert "network/io" in issues[0]["message"].lower()


def test_backend_call_contract_only_mock_assertions_emit_info(tmp_path: Path) -> None:
    """Mock call-contract-only assertions emit contextual UNVERIFIED_MOCK info finding."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_call_contract_only.py",
        """
from unittest.mock import Mock


def test_call_contract_only():
    publisher = Mock()
    publisher.send.assert_called_once()
""".strip()
        + "\n",
    )

    issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue["category"] == IssueCategory.UNVERIFIED_MOCK.name.lower()
        and "call-contract" in issue["message"].lower()
    ]

    assert len(issues) == 1
    assert issues[0]["severity"] == Severity.INFO.value


def test_backend_allow_call_contract_marker_suppresses_context_issue(tmp_path: Path) -> None:
    """quality: allow-call-contract marker suppresses contextual call-contract finding."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_call_contract_allowed.py",
        """
from unittest.mock import Mock


def test_call_contract_allowed():
    # quality: allow-call-contract (emits event by contract)
    publisher = Mock()
    publisher.send.assert_called_once()
""".strip()
        + "\n",
    )

    messages = [issue["message"].lower() for issue in report["backend"]["issues"]]
    assert not any("call-contract" in message for message in messages)
    active = report["summary"]["active_exceptions"]
    assert active["by_rule"].get("mock_call_contract_only", 0) >= 1


def test_backend_allow_call_contract_without_reason_is_invalid_and_does_not_suppress(tmp_path: Path) -> None:
    """allow-call-contract marker without reason stays invalid and does not suppress contextual finding."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_call_contract_missing_reason.py",
        """
from unittest.mock import Mock


def test_call_contract_missing_reason():
    # quality: allow-call-contract
    publisher = Mock()
    publisher.send.assert_called_once()
""".strip()
        + "\n",
    )

    messages = [issue["message"].lower() for issue in report["backend"]["issues"]]
    assert any("call-contract" in message for message in messages)

    summary = report["summary"]["active_exceptions"]
    assert summary["by_rule"].get("mock_call_contract_only", 0) == 0
    invalid_reasons = [entry["reason"] for entry in summary["invalid"]["details"]]
    assert any("allow marker requires non-empty reason" in reason for reason in invalid_reasons)


def test_quality_disable_marker_suppresses_matching_rule_and_tracks_active_exception(tmp_path: Path) -> None:
    """quality:disable with reason suppresses matching rule and records active exception metadata."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_disable_nondeterministic.py",
        """
from django.utils import timezone


def test_disable_nondeterministic_rule():
    # quality: disable nondeterministic (this test validates passthrough wiring only)
    now = timezone.now()
    assert now is not None
""".strip()
        + "\n",
    )

    categories = {issue["category"] for issue in report["backend"]["issues"]}
    assert IssueCategory.NONDETERMINISTIC.name.lower() not in categories

    active = report["summary"]["active_exceptions"]
    disable_entries = [
        detail
        for detail in active["details"]
        if detail["type"] == "disable" and detail["rule_id"] == "nondeterministic"
    ]
    assert len(disable_entries) == 1
    assert disable_entries[0]["matched_issues"] >= 1


def test_quality_disable_marker_without_reason_is_invalid_and_does_not_suppress(tmp_path: Path) -> None:
    """Disable marker without reason remains non-operative and is reported under invalid markers."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_disable_missing_reason.py",
        """
from django.utils import timezone


def test_disable_missing_reason():
    # quality: disable nondeterministic
    now = timezone.now()
    assert now is not None
""".strip()
        + "\n",
    )

    categories = {issue["category"] for issue in report["backend"]["issues"]}
    assert IssueCategory.NONDETERMINISTIC.name.lower() in categories

    invalid = report["summary"]["active_exceptions"]["invalid"]
    assert invalid["total"] == 1
    assert "requires non-empty reason" in invalid["details"][0]["reason"]


def test_backend_large_inline_payload_emits_info(tmp_path: Path) -> None:
    """Large inline payloads are flagged with INLINE_PAYLOAD informational finding."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_inline_payload.py",
        """
def test_large_inline_payload():
    payload = {
        'a': 1,
        'b': 2,
        'c': 3,
        'd': 4,
        'e': 5,
        'f': 6,
        'g': 7,
        'h': 8,
    }
    assert payload['a'] == 1
""".strip()
        + "\n",
    )

    issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue["category"] == IssueCategory.INLINE_PAYLOAD.name.lower()
    ]
    assert len(issues) == 1
    assert issues[0]["severity"] == Severity.INFO.value


def test_backend_global_state_mutation_emits_info(tmp_path: Path) -> None:
    """Mutating os.environ in backend tests emits GLOBAL_STATE_LEAK signal."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_global_state_mutation.py",
        """
import os


def test_mutates_environment_state():
    os.environ['QUALITY_GATE_TOKEN'] = 'value'
    assert os.environ['QUALITY_GATE_TOKEN'] == 'value'
""".strip()
        + "\n",
    )

    issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue["category"] == IssueCategory.GLOBAL_STATE_LEAK.name.lower()
    ]

    assert len(issues) == 1
    assert issues[0]["severity"] == Severity.INFO.value


def test_backend_global_state_read_only_does_not_emit_leak(tmp_path: Path) -> None:
    """Reading os.environ without mutation should not emit GLOBAL_STATE_LEAK."""
    report = _build_backend_report_for_source(
        tmp_path,
        "backend/gym_app/tests/models/test_global_state_read_only.py",
        """
import os


def test_reads_environment_state_only():
    value = os.environ.get('QUALITY_GATE_TOKEN')
    assert value is None or isinstance(value, str)
""".strip()
        + "\n",
    )

    issue_types = {issue["category"] for issue in report["backend"]["issues"]}
    assert IssueCategory.GLOBAL_STATE_LEAK.name.lower() not in issue_types


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


def test_e2e_selector_allow_marker_skips_fragile_selector_issue(tmp_path: Path) -> None:
    """allow-fragile-selector marker suppresses fragile selector finding in E2E analyzer."""
    _, e2e_analyzer = _build_analyzers(tmp_path)
    file_path = tmp_path / "frontend" / "e2e" / "allow_selector.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(
        """
// quality: allow-fragile-selector (legacy DOM anchor)
await page.locator('.legacy-selector').click();
""".strip()
        + "\n",
        encoding="utf-8",
    )

    issues = e2e_analyzer._check_selectors(file_path)
    assert issues == []


def test_e2e_selector_allow_marker_without_reason_does_not_skip_issue(tmp_path: Path) -> None:
    """allow-fragile-selector without reason does not suppress fragile selector finding."""
    _, e2e_analyzer = _build_analyzers(tmp_path)
    file_path = tmp_path / "frontend" / "e2e" / "allow_selector_missing_reason.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(
        """
// quality: allow-fragile-selector
await page.locator('.legacy-selector').click();
""".strip()
        + "\n",
        encoding="utf-8",
    )

    issues = e2e_analyzer._check_selectors(file_path)
    assert len(issues) == 1
    assert issues[0].category == IssueCategory.FRAGILE_LOCATOR


def test_e2e_selector_strict_mode_escalates_to_warning(tmp_path: Path) -> None:
    """Fragile selector severity escalates from info to warning in strict semantic mode."""
    config = Config()
    patterns = Patterns(config)
    e2e_analyzer = FrontendE2EAnalyzer(tmp_path, config, patterns, semantic_rules="strict")
    file_path = tmp_path / "frontend" / "e2e" / "strict_selector.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("await page.locator('.strict-selector').click();\n", encoding="utf-8")

    issues = e2e_analyzer._check_selectors(file_path)
    assert len(issues) == 1
    assert issues[0].severity == Severity.WARNING


def test_e2e_wait_for_timeout_severity_depends_on_semantic_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """WAIT_FOR_TIMEOUT parser issue maps to warning in soft mode and error in strict mode."""
    file_path = tmp_path / "frontend" / "e2e" / "wait_timeout.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("test('wait', async ({ page }) => { await page.waitForTimeout(800); });\n", encoding="utf-8")

    parse_result = JSFileResult(
        file_path=str(file_path),
        tests=[
            JSTestInfo(
                name="wait",
                full_context="wait",
                line=1,
                end_line=1,
                num_lines=1,
                test_type="test",
                has_assertions=False,
                assertion_count=0,
            )
        ],
        issues=[
            JSIssueInfo(issue_type="WAIT_FOR_TIMEOUT", message="waitForTimeout(800) used", line=1, identifier="wait")
        ],
        error=None,
        test_count=1,
        issue_count=1,
    )

    config = Config()
    patterns = Patterns(config)
    soft = FrontendE2EAnalyzer(tmp_path, config, patterns, semantic_rules="soft")
    strict = FrontendE2EAnalyzer(tmp_path, config, patterns, semantic_rules="strict")
    monkeypatch.setattr(soft.bridge, "parse_file", lambda *_a, **_k: parse_result)
    monkeypatch.setattr(strict.bridge, "parse_file", lambda *_a, **_k: parse_result)

    soft_result = soft.analyze_file(file_path)
    strict_result = strict.analyze_file(file_path)

    soft_issue = next(issue for issue in soft_result.issues if issue.category == IssueCategory.SLEEP_CALL)
    strict_issue = next(issue for issue in strict_result.issues if issue.category == IssueCategory.SLEEP_CALL)

    assert soft_issue.rule_id == "wait_for_timeout"
    assert strict_issue.rule_id == "wait_for_timeout"
    assert soft_issue.severity == Severity.WARNING
    assert strict_issue.severity == Severity.ERROR


def test_e2e_vague_assertion_severity_depends_on_semantic_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """VAGUE_ASSERTION parser issue maps to info in soft mode and warning in strict mode."""
    file_path = tmp_path / "frontend" / "e2e" / "vague_assertion.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("test('weak assertions', async ({ page }) => { expect(page).toBeTruthy(); });\n", encoding="utf-8")

    parse_result = JSFileResult(
        file_path=str(file_path),
        tests=[
            JSTestInfo(
                name="weak assertions",
                full_context="weak assertions",
                line=1,
                end_line=1,
                num_lines=1,
                test_type="test",
                has_assertions=True,
                assertion_count=1,
            )
        ],
        issues=[
            JSIssueInfo(issue_type="VAGUE_ASSERTION", message="weak assertion only", line=1, identifier="weak assertions")
        ],
        error=None,
        test_count=1,
        issue_count=1,
    )

    config = Config()
    patterns = Patterns(config)
    soft = FrontendE2EAnalyzer(tmp_path, config, patterns, semantic_rules="soft")
    strict = FrontendE2EAnalyzer(tmp_path, config, patterns, semantic_rules="strict")
    monkeypatch.setattr(soft.bridge, "parse_file", lambda *_a, **_k: parse_result)
    monkeypatch.setattr(strict.bridge, "parse_file", lambda *_a, **_k: parse_result)

    soft_result = soft.analyze_file(file_path)
    strict_result = strict.analyze_file(file_path)

    soft_issue = next(issue for issue in soft_result.issues if issue.category == IssueCategory.VAGUE_ASSERTION)
    strict_issue = next(issue for issue in strict_result.issues if issue.category == IssueCategory.VAGUE_ASSERTION)

    assert soft_issue.severity == Severity.INFO
    assert strict_issue.severity == Severity.WARNING


def test_frontend_unit_maps_semantic_issue_types(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Frontend unit analyzer maps semantic parser issues to expected categories/severities."""
    unit_analyzer, _ = _build_analyzers(tmp_path)
    file_path = tmp_path / "frontend" / "test" / "semantic.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("test('semantic', () => expect(true).toBe(true));\n", encoding="utf-8")

    parse_result = JSFileResult(
        file_path=str(file_path),
        tests=[
            JSTestInfo(
                name="semantic",
                full_context="semantic",
                line=1,
                end_line=1,
                num_lines=1,
                test_type="test",
                has_assertions=True,
                assertion_count=1,
            )
        ],
        issues=[
            JSIssueInfo(issue_type="IMPLEMENTATION_COUPLING", message="wrapper.vm usage", line=2),
            JSIssueInfo(issue_type="FRAGILE_SELECTOR", message="fragile selector", line=3),
            JSIssueInfo(issue_type="MULTI_RENDER", message="multiple mount", line=4),
            JSIssueInfo(issue_type="NETWORK_DEPENDENCY", message="HTTP mock assertion without observable outcome", line=5),
            JSIssueInfo(issue_type="NONDETERMINISTIC", message="Date.now without control", line=6),
            JSIssueInfo(issue_type="GLOBAL_STATE_LEAK", message="storage/timer leak", line=7),
            JSIssueInfo(issue_type="SNAPSHOT_OVERRELIANCE", message="snapshot-only assertions", line=8),
        ],
        error=None,
        test_count=1,
        issue_count=7,
    )
    monkeypatch.setattr(unit_analyzer.bridge, "parse_file", lambda *_a, **_k: parse_result)

    result = unit_analyzer.analyze_file(file_path)
    categories = {issue.category: issue for issue in result.issues}

    assert categories[IssueCategory.IMPLEMENTATION_COUPLING].severity == Severity.WARNING
    assert categories[IssueCategory.FRAGILE_LOCATOR].severity == Severity.WARNING
    assert categories[IssueCategory.MULTI_RENDER].severity == Severity.INFO
    assert categories[IssueCategory.NETWORK_DEPENDENCY].severity == Severity.INFO
    assert categories[IssueCategory.NONDETERMINISTIC].severity == Severity.INFO
    assert categories[IssueCategory.GLOBAL_STATE_LEAK].severity == Severity.WARNING
    assert categories[IssueCategory.SNAPSHOT_OVERRELIANCE].severity == Severity.INFO


def test_frontend_unit_semantic_rules_off_skips_semantic_issue_types(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Frontend unit analyzer suppresses semantic issues when semantic_rules=off."""
    config = Config()
    patterns = Patterns(config)
    unit_analyzer = FrontendUnitAnalyzer(tmp_path, config, patterns, semantic_rules="off")

    file_path = tmp_path / "frontend" / "test" / "semantic-off.spec.js"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("test('semantic off', () => expect(true).toBe(true));\n", encoding="utf-8")

    parse_result = JSFileResult(
        file_path=str(file_path),
        tests=[
            JSTestInfo(
                name="semantic off",
                full_context="semantic off",
                line=1,
                end_line=1,
                num_lines=1,
                test_type="test",
                has_assertions=True,
                assertion_count=1,
            )
        ],
        issues=[JSIssueInfo(issue_type="IMPLEMENTATION_COUPLING", message="wrapper.vm usage", line=1)],
        error=None,
        test_count=1,
        issue_count=1,
    )
    monkeypatch.setattr(unit_analyzer.bridge, "parse_file", lambda *_a, **_k: parse_result)

    result = unit_analyzer.analyze_file(file_path)
    categories = {issue.category for issue in result.issues}
    assert IssueCategory.IMPLEMENTATION_COUPLING not in categories


def test_quality_disable_marker_applies_to_frontend_unit_reports(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """quality:disable markers in JS files suppress matching frontend unit issues in report build."""
    rel_path = "frontend/test/disable-marker.spec.js"
    target = tmp_path / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        """
// quality: disable implementation_coupling (legacy wrapper.vm inspection)
test('legacy', () => {});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    def _fake_analyze_suite(self, _test_root: Path, file_matcher=None):  # type: ignore[no-untyped-def]
        suite = SuiteResult(suite_name="frontend_unit")
        if file_matcher and not file_matcher(target):
            return suite
        suite.add_file(
            FileResult(
                file=rel_path,
                area="unit",
                location_ok=True,
                tests=[],
                issues=[
                    Issue(
                        file=rel_path,
                        message="wrapper.vm usage",
                        severity=Severity.WARNING,
                        category=IssueCategory.IMPLEMENTATION_COUPLING,
                        line=1,
                        rule_id="implementation_coupling",
                    )
                ],
            )
        )
        return suite

    monkeypatch.setattr(FrontendUnitAnalyzer, "analyze_suite", _fake_analyze_suite)

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="frontend-unit",
        include_files=[str(target.resolve())],
    ).build()

    categories = {issue["category"] for issue in report["frontend"]["unit"]["issues"]}
    assert IssueCategory.IMPLEMENTATION_COUPLING.name.lower() not in categories
    assert report["summary"]["active_exceptions"]["by_rule"].get("implementation_coupling", 0) == 1


def test_quality_report_semantic_rules_off_suppresses_frontend_unit_semantic_issue(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """QualityReport suppresses frontend unit semantic issues in off mode and records suppression metrics."""
    rel_path = "frontend/test/semantic-off-report.spec.js"
    target = tmp_path / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("test('semantic off report', () => {});\n", encoding="utf-8")

    def _fake_analyze_suite(self, _test_root: Path, file_matcher=None):  # type: ignore[no-untyped-def]
        suite = SuiteResult(suite_name="frontend_unit")
        if file_matcher and not file_matcher(target):
            return suite
        suite.add_file(
            FileResult(
                file=rel_path,
                area="unit",
                location_ok=True,
                tests=[],
                issues=[
                    Issue(
                        file=rel_path,
                        message="wrapper.vm usage",
                        severity=Severity.WARNING,
                        category=IssueCategory.IMPLEMENTATION_COUPLING,
                        line=1,
                        rule_id="implementation_coupling",
                    )
                ],
            )
        )
        return suite

    monkeypatch.setattr(FrontendUnitAnalyzer, "analyze_suite", _fake_analyze_suite)

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="frontend-unit",
        semantic_rules="off",
        include_files=[str(target.resolve())],
    ).build()

    assert report["frontend"]["unit"]["issues"] == []
    assert report["summary"]["semantic_suppressed_by_mode"]["frontend_unit"] >= 1
    assert report["frontend"]["unit"]["suite_findings"]["semantic_issues_suppressed_by_mode"] >= 1


def test_quality_report_semantic_rules_off_suppresses_frontend_e2e_semantic_issue(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """QualityReport suppresses frontend E2E semantic issues in off mode and records suppression metrics."""
    rel_path = "frontend/e2e/semantic-off-e2e.spec.js"
    target = tmp_path / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("test('semantic off e2e', async ({ page }) => { await page.waitForTimeout(50); });\n", encoding="utf-8")

    def _fake_e2e_analyze_suite(self, _test_root: Path, file_matcher=None):  # type: ignore[no-untyped-def]
        suite = SuiteResult(suite_name="frontend_e2e")
        if file_matcher and not file_matcher(target):
            return suite
        suite.add_file(
            FileResult(
                file=rel_path,
                area="e2e",
                location_ok=True,
                tests=[],
                issues=[
                    Issue(
                        file=rel_path,
                        message="waitForTimeout used",
                        severity=Severity.WARNING,
                        category=IssueCategory.SLEEP_CALL,
                        line=1,
                        rule_id="wait_for_timeout",
                    )
                ],
            )
        )
        return suite

    monkeypatch.setattr(FrontendE2EAnalyzer, "analyze_suite", _fake_e2e_analyze_suite)

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="frontend-e2e",
        semantic_rules="off",
        include_files=[str(target.resolve())],
    ).build()

    assert report["frontend"]["e2e"]["issues"] == []
    assert report["summary"]["semantic_suppressed_by_mode"]["frontend_e2e"] >= 1
    assert report["frontend"]["e2e"]["suite_findings"]["semantic_issues_suppressed_by_mode"] >= 1


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


def test_ast_parser_e2e_detects_wait_for_timeout_issue(tmp_path: Path) -> None:
    """E2E parser emits WAIT_FOR_TIMEOUT for explicit page.waitForTimeout anti-pattern."""
    js_file = tmp_path / "wait-for-timeout.spec.js"
    js_file.write_text(
        """
test('wait anti pattern', async ({ page }) => {
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/dashboard/);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "WAIT_FOR_TIMEOUT" in issue_types


def test_ast_parser_e2e_detects_serial_dependency_without_reason(tmp_path: Path) -> None:
    """test.describe.serial without documented reason emits SERIAL_WITHOUT_REASON."""
    js_file = tmp_path / "serial-without-reason.spec.js"
    js_file.write_text(
        """
test.describe.serial('ordered suite', () => {
  test('case 1', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
  });
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "SERIAL_WITHOUT_REASON" in issue_types


def test_ast_parser_e2e_allow_serial_marker_skips_serial_issue(tmp_path: Path) -> None:
    """quality: allow-serial marker suppresses SERIAL_WITHOUT_REASON finding."""
    js_file = tmp_path / "serial-with-reason.spec.js"
    js_file.write_text(
        """
test.describe.serial('ordered suite', () => {
  // quality: allow-serial (uses shared third-party sandbox)
  test('case 1', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
  });
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "SERIAL_WITHOUT_REASON" not in issue_types


def test_ast_parser_e2e_detects_excessive_steps_with_low_assert_density(tmp_path: Path) -> None:
    """Long action sequences with low assert density emit EXCESSIVE_STEPS."""
    js_file = tmp_path / "excessive-steps.spec.js"
    js_file.write_text(
        """
test('long flow with low assertions', async ({ page }) => {
  await page.goto('/a');
  await page.click('#a1');
  await page.fill('#f1', 'x');
  await page.click('#a2');
  await page.fill('#f2', 'y');
  await page.click('#a3');
  await page.fill('#f3', 'z');
  await page.click('#a4');
  await page.click('#a5');
  await page.click('#a6');
  await page.click('#a7');
  await page.click('#a8');
  await page.click('#a9');
  await expect(page).toHaveURL(/done/);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "EXCESSIVE_STEPS" in issue_types


def test_ast_parser_e2e_detects_fragile_test_data(tmp_path: Path) -> None:
    """Hardcoded email/UUID-like data emits FRAGILE_TEST_DATA signal."""
    js_file = tmp_path / "fragile-data.spec.js"
    js_file.write_text(
        """
test('hardcoded brittle test data', async ({ page }) => {
  await page.fill('#email', 'legacy.user@example.com');
  await page.fill('#id', 'd290f1ee-6c54-4b01-90e6-d701748f0851');
  await expect(page).toHaveURL(/done/);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "FRAGILE_TEST_DATA" in issue_types


def test_ast_parser_e2e_data_isolation_signal_and_cleanup_exception(tmp_path: Path) -> None:
    """Data creation without cleanup emits DATA_ISOLATION; cleanup removes this signal."""
    without_cleanup = tmp_path / "data-isolation-without-cleanup.spec.js"
    without_cleanup.write_text(
        """
test('creates data without cleanup', async ({ request }) => {
  await request.post('/api/test-data', { data: { name: 'sample' } });
  await expect(true).toBeTruthy();
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    with_cleanup = tmp_path / "data-isolation-with-cleanup.spec.js"
    with_cleanup.write_text(
        """
test('creates and cleans data', async ({ request }) => {
  await request.post('/api/test-data', { data: { name: 'sample' } });
  await request.delete('/api/test-data/cleanup');
  await expect(true).toBeTruthy();
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    no_cleanup_payload = _run_ast_parser_payload(without_cleanup, is_e2e=True)
    cleanup_payload = _run_ast_parser_payload(with_cleanup, is_e2e=True)

    no_cleanup_types = {issue["type"] for issue in no_cleanup_payload["issues"]}
    cleanup_types = {issue["type"] for issue in cleanup_payload["issues"]}

    assert "DATA_ISOLATION" in no_cleanup_types
    assert "DATA_ISOLATION" not in cleanup_types


def test_ast_parser_e2e_weak_assertions_emit_vague_assertion(tmp_path: Path) -> None:
    """E2E tests with only weak assertions emit VAGUE_ASSERTION."""
    js_file = tmp_path / "weak-assertions.spec.js"
    js_file.write_text(
        """
test('weak assertions only', async ({ page }) => {
  await page.goto('/dashboard');
  expect(page).toBeTruthy();
  expect(true).toBe(true);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "VAGUE_ASSERTION" in issue_types


def test_ast_parser_e2e_strong_assertions_skip_vague_assertion(tmp_path: Path) -> None:
    """Strong E2E assertions should not emit VAGUE_ASSERTION."""
    js_file = tmp_path / "strong-assertions.spec.js"
    js_file.write_text(
        """
test('strong assertions', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('main')).toBeVisible();
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file, is_e2e=True)
    issue_types = {issue["type"] for issue in payload["issues"]}
    assert "VAGUE_ASSERTION" not in issue_types


def test_ast_parser_e2e_excessive_steps_uses_strong_assert_density(tmp_path: Path) -> None:
    """EXCESSIVE_STEPS uses strong assertions, not weak ones, as density signal."""
    weak_only = tmp_path / "excessive-steps-weak-asserts.spec.js"
    weak_only.write_text(
        """
test('long flow weak assertions', async ({ page }) => {
  await page.goto('/a');
  await page.click('#a1');
  await page.fill('#f1', 'x');
  await page.click('#a2');
  await page.fill('#f2', 'y');
  await page.click('#a3');
  await page.fill('#f3', 'z');
  await page.click('#a4');
  await page.click('#a5');
  await page.click('#a6');
  await page.click('#a7');
  await page.click('#a8');
  await page.click('#a9');
  expect(page).toBeTruthy();
  expect(true).toBe(true);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    strong_two = tmp_path / "excessive-steps-strong-asserts.spec.js"
    strong_two.write_text(
        """
test('long flow strong assertions', async ({ page }) => {
  await page.goto('/a');
  await page.click('#a1');
  await page.fill('#f1', 'x');
  await page.click('#a2');
  await page.fill('#f2', 'y');
  await page.click('#a3');
  await page.fill('#f3', 'z');
  await page.click('#a4');
  await page.click('#a5');
  await page.click('#a6');
  await page.click('#a7');
  await page.click('#a8');
  await page.click('#a9');
  await expect(page).toHaveURL(/done/);
  await expect(page.getByRole('main')).toBeVisible();
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    weak_payload = _run_ast_parser_payload(weak_only, is_e2e=True)
    strong_payload = _run_ast_parser_payload(strong_two, is_e2e=True)

    weak_types = {issue["type"] for issue in weak_payload["issues"]}
    strong_types = {issue["type"] for issue in strong_payload["issues"]}

    assert "EXCESSIVE_STEPS" in weak_types
    assert "EXCESSIVE_STEPS" not in strong_types


def test_ast_parser_detects_frontend_unit_semantic_signals(tmp_path: Path) -> None:
    """ast-parser emits semantic unit issues for coupling/selectors/network/determinism/multi-render."""
    js_file = tmp_path / "semantic-signals.spec.js"
    js_file.write_text(
        """
import { mount } from '@vue/test-utils';

test('detect semantic signals', async () => {
  const wrapper = mount(ComponentA);
  mount(ComponentB);
  wrapper.find('.cta-button');
  const currentUser = wrapper.vm.user;
  await fetch('/api/users');
  Date.now();
  Math.random();
  new Date();
  expect(currentUser).toBeDefined();
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "IMPLEMENTATION_COUPLING" in issue_types
    assert "FRAGILE_SELECTOR" in issue_types
    assert "MULTI_RENDER" in issue_types
    assert "NETWORK_DEPENDENCY" in issue_types
    assert "NONDETERMINISTIC" in issue_types


def test_ast_parser_allow_multi_render_comment_skips_multi_render_issue(tmp_path: Path) -> None:
    """Documented allow-multi-render comment suppresses MULTI_RENDER finding."""
    js_file = tmp_path / "allow-multi-render.spec.js"
    js_file.write_text(
        """
import { mount } from '@vue/test-utils';

test('allows multi render', () => {
  const wrapper = mount(ComponentA);
  // quality: allow-multi-render (re-render with new props)
  mount(ComponentA, { props: { mode: 'editing' } });
  expect(wrapper.exists()).toBe(true);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "MULTI_RENDER" not in issue_types


def test_ast_parser_nondeterministic_usage_with_controls_skips_issue(tmp_path: Path) -> None:
    """Explicit fake timer controls prevent NONDETERMINISTIC finding for Date.now usage."""
    js_file = tmp_path / "deterministic-controls.spec.js"
    js_file.write_text(
        """
test('controls system time', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  const timestamp = Date.now();
  expect(timestamp).toBeGreaterThan(0);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "NONDETERMINISTIC" not in issue_types


def test_ast_parser_contextual_http_mock_contract_only_emits_network_dependency(tmp_path: Path) -> None:
    """Jest HTTP mock with call-contract-only assertions triggers contextual network dependency issue."""
    js_file = tmp_path / "network-contextual.spec.js"
    js_file.write_text(
        """
import axios from 'axios';

jest.mock('axios');

test('asserts only call contract', () => {
  expect(axios.get).toHaveBeenCalledTimes(1);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    network_issues = [issue for issue in payload["issues"] if issue["type"] == "NETWORK_DEPENDENCY"]

    assert len(network_issues) == 1
    assert "without observable outcome" in network_issues[0]["message"].lower()


def test_ast_parser_contextual_http_mock_with_observable_assertion_skips_issue(tmp_path: Path) -> None:
    """Jest HTTP mock with observable assertion does not trigger contextual-only network issue."""
    js_file = tmp_path / "network-contextual-observable.spec.js"
    js_file.write_text(
        """
import axios from 'axios';

jest.mock('axios');

test('asserts call contract and observable output', () => {
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect('rendered').toContain('render');
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "NETWORK_DEPENDENCY" not in issue_types


def test_ast_parser_detects_global_state_leaks_in_unit_tests(tmp_path: Path) -> None:
    """Storage/timer/mock state mutation without restore emits GLOBAL_STATE_LEAK."""
    js_file = tmp_path / "global-state-leak.spec.js"
    js_file.write_text(
        """
test('leaks global state', () => {
  localStorage.setItem('token', 'abc');
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.42);
  expect(true).toBe(true);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    global_state_issues = [issue for issue in payload["issues"] if issue["type"] == "GLOBAL_STATE_LEAK"]

    assert len(global_state_issues) >= 2


def test_ast_parser_global_state_cleanup_prevents_leak_issue(tmp_path: Path) -> None:
    """When storage/timers/mocks are restored, GLOBAL_STATE_LEAK is not emitted."""
    js_file = tmp_path / "global-state-clean.spec.js"
    js_file.write_text(
        """
test('cleans up global state', () => {
  localStorage.setItem('token', 'abc');
  localStorage.removeItem('token');
  jest.useFakeTimers();
  jest.useRealTimers();
  const spy = jest.spyOn(Math, 'random');
  spy.mockRestore();
  expect(true).toBe(true);
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "GLOBAL_STATE_LEAK" not in issue_types


def test_ast_parser_snapshot_only_assertions_emit_overreliance_issue(tmp_path: Path) -> None:
    """Snapshot-only tests are flagged with SNAPSHOT_OVERRELIANCE."""
    js_file = tmp_path / "snapshot-only.spec.js"
    js_file.write_text(
        """
test('snapshot only', () => {
  expect(renderedTree).toMatchSnapshot();
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "SNAPSHOT_OVERRELIANCE" in issue_types


def test_ast_parser_snapshot_with_semantic_assertions_skips_overreliance_issue(tmp_path: Path) -> None:
    """Snapshot plus semantic assertions should not be marked as overreliance."""
    js_file = tmp_path / "snapshot-with-semantic.spec.js"
    js_file.write_text(
        """
test('snapshot plus semantic checks', () => {
  expect(renderedTree).toMatchSnapshot();
  expect('ready').toContain('read');
});
""".strip()
        + "\n",
        encoding="utf-8",
    )

    payload = _run_ast_parser_payload(js_file)
    issue_types = {issue["type"] for issue in payload["issues"]}

    assert "SNAPSHOT_OVERRELIANCE" not in issue_types


def test_performance_budget_issues_emit_for_exceeded_suite_and_total_thresholds(tmp_path: Path) -> None:
    """Performance budget helper emits warning issues for exceeded suite and total timings."""
    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite_time_budget_seconds=1.0,
        total_time_budget_seconds=2.5,
    )

    issues = report._performance_budget_issues(
        {
            "backend": 1.4,
            "frontend_unit": 0.8,
            "frontend_e2e": 1.3,
            "external_lint": 0.2,
            "total": 3.1,
        }
    )

    categories = {issue.category for issue in issues}
    files = {issue.file for issue in issues}

    assert categories == {IssueCategory.PERFORMANCE_BUDGET}
    assert files == {
        "__meta__/performance/backend",
        "__meta__/performance/frontend_e2e",
        "__meta__/performance/total",
    }
    assert all(issue.severity == Severity.WARNING for issue in issues)


def test_performance_budget_issues_skip_when_thresholds_not_exceeded(tmp_path: Path) -> None:
    """Performance budget helper returns no issues when timings are within configured budgets."""
    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite_time_budget_seconds=2.0,
        total_time_budget_seconds=5.0,
    )

    issues = report._performance_budget_issues(
        {
            "backend": 1.2,
            "frontend_unit": 0.9,
            "frontend_e2e": 1.1,
            "external_lint": 0.3,
            "total": 3.5,
        }
    )

    assert issues == []


def test_external_lint_misconfigured_is_warning_in_soft_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Misconfigured external linter is warning in soft mode."""
    _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_soft_mode.py",
        "def test_soft_mode():\n    assert True\n",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="misconfigured", message="plugin missing"),
            ExternalLintRunResult(source="eslint", status="ok", findings=[]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="soft",
        external_lint="run",
    ).build()

    issues = report["backend"]["issues"]
    misconfigured = [
        issue
        for issue in issues
        if issue["category"] == IssueCategory.LINTER_MISCONFIGURED.name.lower()
    ]

    assert len(misconfigured) == 1
    assert misconfigured[0]["severity"] == Severity.WARNING.value
    assert "misconfigured" in misconfigured[0]["message"].lower()


def test_external_lint_misconfigured_is_error_in_strict_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Misconfigured external linter escalates to error in strict semantic mode."""
    _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_strict_mode.py",
        "def test_strict_mode():\n    assert True\n",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="misconfigured", message="invalid config"),
            ExternalLintRunResult(source="eslint", status="ok", findings=[]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="strict",
        external_lint="run",
    ).build()

    issues = report["backend"]["issues"]
    misconfigured = [
        issue
        for issue in issues
        if issue["category"] == IssueCategory.LINTER_MISCONFIGURED.name.lower()
    ]

    assert len(misconfigured) == 1
    assert misconfigured[0]["severity"] == Severity.ERROR.value
    assert report["summary"]["errors"] >= 1


def test_external_lint_unavailable_reports_warning(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Unavailable external tool should produce explicit warning issue."""
    _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_unavailable_tool.py",
        "def test_unavailable_tool():\n    assert True\n",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="unavailable", message="ruff not found"),
            ExternalLintRunResult(source="eslint", status="ok", findings=[]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="soft",
        external_lint="run",
    ).build()

    issues = report["backend"]["issues"]
    unavailable = [
        issue
        for issue in issues
        if issue["category"] == IssueCategory.TOOL_UNAVAILABLE.name.lower()
    ]

    assert len(unavailable) == 1
    assert unavailable[0]["severity"] == Severity.WARNING.value
    assert unavailable[0]["source"] == "ruff"


def test_external_lint_findings_are_info_in_semantic_off_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """External lint findings remain informational in semantic off mode."""
    target = _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_external_info_off_mode.py",
        "def test_external_info_off_mode():\n    assert True\n",
    )
    rel_path = str(target.relative_to(tmp_path).as_posix())

    finding = ExternalLintFinding(
        source="ruff",
        file=rel_path,
        line=1,
        col=1,
        external_rule_id="PT001",
        message="External lint issue",
        severity_raw="error",
        normalized_rule_id="sleep_call",
        fingerprint="fp:off:external",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="ok", findings=[finding]),
            ExternalLintRunResult(source="eslint", status="ok", findings=[]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="off",
        external_lint="run",
    ).build()

    sleep_issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue.get("rule_id") == "sleep_call"
    ]
    assert len(sleep_issues) == 1
    assert sleep_issues[0]["severity"] == Severity.INFO.value


def test_external_wait_for_timeout_is_suppressed_in_semantic_off_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Semantic off suppresses external wait_for_timeout findings in frontend E2E suite."""
    rel_path = "frontend/e2e/test_external_wait_timeout.spec.js"
    target = tmp_path / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("test('external wait timeout', async ({ page }) => { await page.waitForTimeout(200); });\n", encoding="utf-8")

    monkeypatch.setattr(
        FrontendE2EAnalyzer,
        "analyze_suite",
        lambda self, _test_root, file_matcher=None: SuiteResult(suite_name="frontend_e2e"),
    )

    external_finding = ExternalLintFinding(
        source="eslint",
        file=rel_path,
        line=1,
        col=1,
        external_rule_id="playwright/no-wait-for-timeout",
        message="Avoid page.waitForTimeout",
        severity_raw="1",
        normalized_rule_id="wait_for_timeout",
        fingerprint="fp:external:wait-timeout",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="ok", findings=[]),
            ExternalLintRunResult(source="eslint", status="ok", findings=[external_finding]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="frontend-e2e",
        semantic_rules="off",
        external_lint="run",
        include_files=[str(target.resolve())],
    ).build()

    assert report["frontend"]["e2e"]["issues"] == []
    assert report["summary"]["semantic_suppressed_by_mode"]["frontend_e2e"] >= 1


def test_external_lint_deduplicates_by_fingerprint(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Duplicate external findings with same fingerprint are reported once."""
    target = _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_external_dedupe.py",
        "def test_external_dedupe():\n    assert True\n",
    )
    rel_path = str(target.relative_to(tmp_path).as_posix())

    finding = ExternalLintFinding(
        source="ruff",
        file=rel_path,
        line=1,
        col=1,
        external_rule_id="PT001",
        message="Example external finding",
        severity_raw="error",
        normalized_rule_id="ruff:pt001",
        fingerprint="fp:external:dedupe",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="ok", findings=[finding, finding]),
            ExternalLintRunResult(source="eslint", status="ok", findings=[]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="soft",
        external_lint="run",
    ).build()

    issues = [
        issue
        for issue in report["backend"]["issues"]
        if issue.get("rule_id") == "ruff:pt001"
    ]
    assert len(issues) == 1
    assert issues[0]["fingerprint"] == "fp:external:dedupe"
    assert issues[0]["source"] == "ruff"


def test_cross_engine_dedupe_relaxes_line_mismatch_for_wait_for_timeout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Internal/external wait_for_timeout overlap dedupes even when reported lines differ."""
    rel_path = "frontend/e2e/test_sleep_overlap.spec.js"
    target = tmp_path / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("test('sleep overlap', async ({ page }) => { await page.waitForTimeout(200); });\n", encoding="utf-8")

    def _fake_e2e_analyze_suite(self, _test_root: Path, file_matcher=None):  # type: ignore[no-untyped-def]
        suite = SuiteResult(suite_name="frontend_e2e")
        if file_matcher and not file_matcher(target):
            return suite
        suite.add_file(
            FileResult(
                file=rel_path,
                area="e2e",
                location_ok=True,
                tests=[],
                issues=[
                    Issue(
                        file=rel_path,
                        message="waitForTimeout used",
                        severity=Severity.WARNING,
                        category=IssueCategory.SLEEP_CALL,
                        line=9,
                        rule_id="wait_for_timeout",
                    )
                ],
            )
        )
        return suite

    monkeypatch.setattr(FrontendE2EAnalyzer, "analyze_suite", _fake_e2e_analyze_suite)

    external_finding = ExternalLintFinding(
        source="eslint",
        file=rel_path,
        line=3,
        col=1,
        external_rule_id="playwright/no-wait-for-timeout",
        message="Prefer web-first assertions",
        severity_raw="1",
        normalized_rule_id="wait_for_timeout",
        fingerprint="fp:sleep-overlap",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="ok", findings=[]),
            ExternalLintRunResult(source="eslint", status="ok", findings=[external_finding]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="frontend-e2e",
        include_files=[str(target.resolve())],
        semantic_rules="soft",
        external_lint="run",
    ).build()

    wait_issues = [
        issue
        for issue in report["frontend"]["e2e"]["issues"]
        if issue.get("rule_id") == "wait_for_timeout"
    ]
    assert len(wait_issues) == 1
    assert wait_issues[0].get("source") == "eslint"


def test_external_lint_summary_contains_mode_results_and_timings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Summary includes external lint metadata and timing information."""
    _write_backend_test(
        tmp_path,
        "backend/gym_app/tests/models/test_summary_metadata.py",
        "def test_summary_metadata():\n    assert True\n",
    )

    monkeypatch.setattr(
        quality_gate_module.ExternalLintRunner,
        "run",
        lambda self, **kwargs: [
            ExternalLintRunResult(source="ruff", status="ok", findings=[]),
            ExternalLintRunResult(source="eslint", status="ok", findings=[]),
        ],
    )

    report = QualityReport(
        repo_root=tmp_path,
        config=Config(),
        suite="backend",
        semantic_rules="soft",
        external_lint="run",
    ).build()

    summary = report["summary"]
    assert summary["semantic_rules"] == "soft"
    assert summary["external_lint"]["mode"] == "run"
    assert len(summary["external_lint"]["results"]) == 2
    assert "active_exceptions" in summary
    assert "timings" in summary
    assert "total" in summary["timings"]
    backend_findings = report["backend"]["suite_findings"]
    assert set(backend_findings).issuperset(
        {
            "semantic_issues_suppressed_by_mode",
            "active_exceptions_count",
            "error_count",
            "warning_count",
        }
    )


def test_external_lint_runner_fingerprint_normalizes_whitespace(tmp_path: Path) -> None:
    """Snippet hash is stable for whitespace-only context changes."""
    rel_path = "backend/gym_app/tests/models/test_fp_hash.py"
    absolute = tmp_path / rel_path
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_text(
        "def test_fp_hash():\n    assert  value  ==  1\n",
        encoding="utf-8",
    )

    runner_one = ExternalLintRunner(tmp_path)
    first = runner_one._build_fingerprint(rel_path, 2, "ruff:pt001")

    absolute.write_text(
        "def test_fp_hash():\n    assert value == 1\n",
        encoding="utf-8",
    )

    runner_two = ExternalLintRunner(tmp_path)
    second = runner_two._build_fingerprint(rel_path, 2, "ruff:pt001")

    assert first == second
