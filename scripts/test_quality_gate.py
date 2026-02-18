#!/usr/bin/env python3
"""
Test Quality Gate - Orchestrator.

Modular test quality analysis for backend (Python/pytest) and 
frontend (Jest/Playwright) test suites.

Usage:
    python test_quality_gate.py --repo-root /path/to/repo
    python test_quality_gate.py --repo-root . --verbose --strict
    python test_quality_gate.py --suite backend
    python test_quality_gate.py --suite frontend-unit
    python test_quality_gate.py --suite frontend-e2e

Exit codes:
    0 - All validations passed (or only info-level issues in non-strict mode)
    1 - Errors or warnings found
    2 - Configuration or runtime error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections.abc import Callable
from collections import Counter
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

# Import from modular quality package
from quality import (
    Severity,
    IssueCategory,
    Colors,
    Config,
    FileResult,
    Issue,
    ExternalLintFinding,
    SEMANTIC_RULE_IDS,
    SuiteResult,
    DEFAULT_CONFIG,
    Patterns,
)
from quality.backend_analyzer import PythonAnalyzer
from quality.external_lint import ExternalLintRunResult, ExternalLintRunner


DISABLE_MARKER_PATTERN = re.compile(
    r"quality:\s*disable\s+([a-z0-9_:\-]+)(?:\s*\(([^)]*)\))?",
    re.IGNORECASE,
)

ALLOW_MARKER_RULE_IDS: dict[str, str] = {
    "allow-call-contract": "mock_call_contract_only",
    "allow-fragile-selector": "fragile_locator",
    "allow-serial": "serial_dependency",
    "allow-multi-render": "multi_render",
}

ALLOW_MARKER_PATTERNS: dict[str, re.Pattern[str]] = {
    marker: re.compile(rf"quality:\s*{re.escape(marker)}(?:\s*\(([^)]*)\))?", re.IGNORECASE)
    for marker in ALLOW_MARKER_RULE_IDS
}

# Relaxed cross-engine dedupe for known overlapping rules that may disagree on line number.
RELAXED_CROSS_ENGINE_RULE_IDS: frozenset[str] = frozenset({"sleep_call", "wait_for_timeout"})


def build_config(args: argparse.Namespace) -> Config:
    """Build configuration from CLI arguments."""
    return Config(
        backend_app_name=args.backend_app,
        max_test_lines=args.max_test_lines,
        max_assertions_per_test=args.max_assertions,
        max_patches_per_test=args.max_patches,
    )


class QualityReport:
    """Builds and formats quality reports."""
    
    def __init__(
        self, 
        repo_root: Path, 
        config: Config = DEFAULT_CONFIG, 
        verbose: bool = False,
        suite: str | None = None,
        include_files: list[str] | None = None,
        include_globs: list[str] | None = None,
        semantic_rules: str = "soft",
        external_lint: str = "off",
        suite_time_budget_seconds: float | None = None,
        total_time_budget_seconds: float | None = None,
    ):
        self.repo_root = repo_root
        self.config = config
        self.verbose = verbose
        self.suite = suite  # None = all, or 'backend', 'frontend-unit', 'frontend-e2e'
        self.patterns = Patterns(config)
        self.include_files = tuple(include_files or ())
        self.include_globs = tuple(include_globs or ())
        self.semantic_rules = semantic_rules
        self.external_lint = external_lint
        self.suite_time_budget_seconds = suite_time_budget_seconds
        self.total_time_budget_seconds = total_time_budget_seconds

    def _normalize_rule_id(self, raw_rule_id: str) -> str:
        """Normalize rule IDs to stable lowercase underscore form."""
        return raw_rule_id.strip().lower().replace("-", "_")

    def _rule_id_for_issue(self, issue: Issue) -> str:
        """Return canonical rule identifier, assigning default when missing."""
        raw_rule_id = issue.rule_id or issue.category.name.lower()
        normalized = self._normalize_rule_id(raw_rule_id)
        issue.rule_id = normalized
        return normalized

    def _canonicalize_issue(self, issue: Issue) -> None:
        """Normalize issue fields used by suppression, dedupe, and report output."""
        issue.file = issue.file.replace("\\", "/")
        self._rule_id_for_issue(issue)

    def _issue_richness_score(self, issue: Issue) -> int:
        """Score issue detail richness to keep best duplicate when collisions occur."""
        score = 0
        if issue.identifier:
            score += 2
        if issue.suggestion:
            score += 2
        if issue.fingerprint:
            score += 1
        if issue.source != "internal":
            score += 1
        score += min(len(issue.message or ""), 160) // 40
        return score

    def _suite_bucket_for_file(self, file_path: str) -> str | None:
        """Map report file path to suite bucket key."""
        normalized = file_path.replace("\\", "/")
        if normalized.startswith("backend/"):
            return "backend"
        if normalized.startswith("frontend/test/"):
            return "frontend_unit"
        if normalized.startswith("frontend/e2e/"):
            return "frontend_e2e"
        return None

    def _collect_exception_markers(
        self,
        backend: SuiteResult,
        unit: SuiteResult,
        e2e: SuiteResult,
    ) -> tuple[dict[str, set[str]], list[dict[str, Any]], list[dict[str, Any]]]:
        """Collect disable/allow exception markers from analyzed files."""
        relative_files = {
            file_result.file.replace("\\", "/")
            for suite_result in (backend, unit, e2e)
            for file_result in suite_result.files
            if file_result.file and not file_result.file.startswith("__meta__/")
        }

        disable_rules_by_file: dict[str, set[str]] = {}
        active_exceptions: list[dict[str, Any]] = []
        invalid_markers: list[dict[str, Any]] = []

        for relative_file in sorted(relative_files):
            absolute_file = self.repo_root / relative_file
            try:
                content = absolute_file.read_text(encoding="utf-8")
            except OSError:
                continue

            for line_number, line in enumerate(content.splitlines(), start=1):
                for disable_match in DISABLE_MARKER_PATTERN.finditer(line):
                    marker_text = disable_match.group(0).strip()
                    raw_rule_id = disable_match.group(1) or ""
                    reason = (disable_match.group(2) or "").strip()
                    normalized_rule_id = self._normalize_rule_id(raw_rule_id)

                    if normalized_rule_id and reason:
                        disable_rules_by_file.setdefault(relative_file, set()).add(normalized_rule_id)
                        active_exceptions.append(
                            {
                                "type": "disable",
                                "file": relative_file,
                                "line": line_number,
                                "rule_id": normalized_rule_id,
                                "reason": reason,
                                "marker": marker_text,
                                "matched_issues": 0,
                            }
                        )
                    else:
                        invalid_markers.append(
                            {
                                "file": relative_file,
                                "line": line_number,
                                "marker": marker_text,
                                "reason": "disable marker requires non-empty reason",
                            }
                        )

                lowered = line.lower()
                for marker, rule_id in ALLOW_MARKER_RULE_IDS.items():
                    if f"quality: {marker}" not in lowered:
                        continue

                    marker_pattern = ALLOW_MARKER_PATTERNS[marker]
                    marker_match = marker_pattern.search(line)
                    marker_text = marker_match.group(0).strip() if marker_match else f"quality: {marker}"
                    reason = (
                        (marker_match.group(1) or "").strip()
                        if marker_match is not None
                        else ""
                    )

                    if reason:
                        active_exceptions.append(
                            {
                                "type": "allow",
                                "file": relative_file,
                                "line": line_number,
                                "rule_id": rule_id,
                                "reason": reason,
                                "marker": marker_text,
                            }
                        )
                    else:
                        invalid_markers.append(
                            {
                                "file": relative_file,
                                "line": line_number,
                                "marker": marker_text,
                                "reason": "allow marker requires non-empty reason",
                            }
                        )

        return disable_rules_by_file, active_exceptions, invalid_markers

    def _apply_disable_markers(
        self,
        backend: SuiteResult,
        unit: SuiteResult,
        e2e: SuiteResult,
        disable_rules_by_file: dict[str, set[str]],
        active_exceptions: list[dict[str, Any]],
    ) -> dict[str, int]:
        """Suppress matching issues for valid quality:disable markers."""
        suppressed_by_suite: dict[str, int] = {
            "backend": 0,
            "frontend_unit": 0,
            "frontend_e2e": 0,
        }
        matched_index: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for exception in active_exceptions:
            if exception.get("type") != "disable":
                continue
            key = (exception["file"], exception["rule_id"])
            matched_index.setdefault(key, []).append(exception)

        for suite_key, suite_result in (
            ("backend", backend),
            ("frontend_unit", unit),
            ("frontend_e2e", e2e),
        ):
            for file_result in suite_result.files:
                file_key = file_result.file.replace("\\", "/")
                disabled_rules = disable_rules_by_file.get(file_key)
                if not disabled_rules:
                    continue

                kept_issues: list[Issue] = []
                for issue in file_result.issues:
                    self._canonicalize_issue(issue)
                    issue_rule_id = self._rule_id_for_issue(issue)
                    if issue_rule_id in disabled_rules:
                        suppressed_by_suite[suite_key] += 1
                        for marker in matched_index.get((file_key, issue_rule_id), []):
                            marker["matched_issues"] = int(marker.get("matched_issues", 0)) + 1
                        continue
                    kept_issues.append(issue)

                file_result.issues = kept_issues

        return suppressed_by_suite

    def _apply_semantic_mode_off(
        self,
        backend: SuiteResult,
        unit: SuiteResult,
        e2e: SuiteResult,
    ) -> dict[str, int]:
        """Suppress semantic findings in off mode across backend/unit/e2e suites."""
        suppressed_by_suite: dict[str, int] = {
            "backend": 0,
            "frontend_unit": 0,
            "frontend_e2e": 0,
        }
        if self.semantic_rules != "off":
            return suppressed_by_suite

        for suite_key, suite_result in (
            ("backend", backend),
            ("frontend_unit", unit),
            ("frontend_e2e", e2e),
        ):
            for file_result in suite_result.files:
                kept_issues: list[Issue] = []
                for issue in file_result.issues:
                    self._canonicalize_issue(issue)
                    if self._rule_id_for_issue(issue) in SEMANTIC_RULE_IDS:
                        suppressed_by_suite[suite_key] += 1
                        continue
                    kept_issues.append(issue)
                file_result.issues = kept_issues

        return suppressed_by_suite

    def _active_exceptions_summary(
        self,
        active_exceptions: list[dict[str, Any]],
        invalid_markers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Build summary payload for active exception markers."""
        by_rule = Counter(exception["rule_id"] for exception in active_exceptions)
        by_file = Counter(exception["file"] for exception in active_exceptions)
        return {
            "total": len(active_exceptions),
            "by_rule": dict(sorted(by_rule.items())),
            "by_file": dict(sorted(by_file.items())),
            "details": active_exceptions,
            "invalid": {
                "total": len(invalid_markers),
                "details": invalid_markers,
            },
        }

    def _apply_suite_findings(
        self,
        backend: SuiteResult,
        unit: SuiteResult,
        e2e: SuiteResult,
        semantic_suppressed: dict[str, int],
        active_exceptions: list[dict[str, Any]],
    ) -> None:
        """Attach additive suite-level findings metrics without changing issue behavior."""
        active_by_suite = Counter()
        for exception in active_exceptions:
            bucket = self._suite_bucket_for_file(exception.get("file", ""))
            if bucket:
                active_by_suite[bucket] += 1

        for suite_key, suite_result in (
            ("backend", backend),
            ("frontend_unit", unit),
            ("frontend_e2e", e2e),
        ):
            suite_result.suite_findings = {
                "semantic_issues_suppressed_by_mode": semantic_suppressed.get(suite_key, 0),
                "active_exceptions_count": active_by_suite.get(suite_key, 0),
                "error_count": suite_result.error_count,
                "warning_count": suite_result.warning_count,
            }

    def _normalize_relative_path(self, raw_path: str) -> str:
        """Normalize user-provided include paths to repo-relative POSIX form."""
        candidate = Path(raw_path)
        if candidate.is_absolute():
            resolved = candidate.resolve()
            try:
                return resolved.relative_to(self.repo_root).as_posix()
            except ValueError:
                return resolved.as_posix()

        return candidate.as_posix().lstrip("./")

    def _normalize_glob(self, pattern: str) -> str:
        """Normalize glob patterns to the same path style used in reports."""
        return pattern.replace("\\", "/").lstrip("./")

    def _build_file_matcher(self) -> Callable[[str], bool] | None:
        """Build optional matcher used to filter report files by path/glob."""
        normalized_files = {
            self._normalize_relative_path(path)
            for path in self.include_files
            if path.strip()
        }
        normalized_globs = tuple(
            self._normalize_glob(pattern)
            for pattern in self.include_globs
            if pattern.strip()
        )

        if not normalized_files and not normalized_globs:
            return None

        def matcher(relative_path: str) -> bool:
            normalized = relative_path.replace("\\", "/")
            if normalized in normalized_files:
                return True
            return any(fnmatch(normalized, pattern) for pattern in normalized_globs)

        return matcher

    def _build_path_matcher(
        self,
        matcher: Callable[[str], bool] | None,
    ) -> Callable[[Path], bool] | None:
        """Build a Path-aware matcher for analyzers from the relative-path matcher."""
        if matcher is None:
            return None

        def path_matcher(path: Path) -> bool:
            try:
                relative_path = path.relative_to(self.repo_root).as_posix()
            except ValueError:
                relative_path = path.as_posix()
            return matcher(relative_path)

        return path_matcher

    def _filter_suite_result(
        self,
        suite_result: SuiteResult,
        matcher: Callable[[str], bool] | None,
    ) -> SuiteResult:
        """Filter suite files in-memory when include filters are provided."""
        if matcher is None:
            return suite_result

        filtered = SuiteResult(suite_name=suite_result.suite_name)
        filtered.files = [
            file_result
            for file_result in suite_result.files
            if matcher(file_result.file)
        ]
        return filtered

    def _suite_file_paths(self, suite_result: SuiteResult) -> list[Path]:
        """Return absolute file paths discovered in a suite result."""
        return [
            self.repo_root / file_result.file
            for file_result in suite_result.files
            if file_result.file
        ]

    def _severity_for_external_finding(self, finding: ExternalLintFinding) -> Severity:
        """Map raw external lint severities to gate severity by rollout mode."""
        if self.semantic_rules == "off":
            return Severity.INFO

        raw = finding.severity_raw.strip().lower()
        is_error_like = raw in {"2", "error", "fatal", "high"}
        if self.semantic_rules == "strict" and is_error_like:
            return Severity.ERROR
        if is_error_like:
            return Severity.WARNING
        return Severity.INFO

    def _category_for_external_rule(self, normalized_rule_id: str) -> IssueCategory:
        """Map normalized external rule identifiers to internal categories."""
        if normalized_rule_id in {"sleep_call", "wait_for_timeout"}:
            return IssueCategory.SLEEP_CALL
        return IssueCategory.EXTERNAL_LINT

    def _issue_for_external_finding(self, finding: ExternalLintFinding) -> Issue:
        """Convert normalized external finding into internal Issue representation."""
        return Issue(
            file=finding.file,
            message=finding.message,
            severity=self._severity_for_external_finding(finding),
            category=self._category_for_external_rule(finding.normalized_rule_id),
            line=finding.line,
            identifier=finding.external_rule_id,
            suggestion="Fix or suppress in external linter config where justified",
            rule_id=finding.normalized_rule_id,
            source=finding.source,
            fingerprint=finding.fingerprint,
        )

    def _severity_for_linter_failure(self, status: str) -> Severity:
        """Severity mapping for external linter execution failures."""
        if status == "misconfigured":
            return Severity.ERROR if self.semantic_rules == "strict" else Severity.WARNING
        return Severity.WARNING

    def _status_issue_for_external_run(self, result: ExternalLintRunResult) -> Issue | None:
        """Create issue for misconfigured/unavailable external lint tools."""
        if result.status == "ok":
            return None

        if result.status == "misconfigured":
            category = IssueCategory.LINTER_MISCONFIGURED
            message = f"External linter misconfigured ({result.source}): {result.message or 'configuration error'}"
            rule_id = f"{result.source}:misconfigured"
        else:
            category = IssueCategory.TOOL_UNAVAILABLE
            message = f"External lint tool unavailable ({result.source}): {result.message or 'tool unavailable'}"
            rule_id = f"{result.source}:unavailable"

        file_hint = (
            f"backend/{self.config.backend_app_name}/tests"
            if result.source == "ruff"
            else "frontend"
        )
        return Issue(
            file=file_hint,
            message=message,
            severity=self._severity_for_linter_failure(result.status),
            category=category,
            line=1,
            rule_id=rule_id,
            source=result.source,
            fingerprint=f"external-status:{result.source}:{result.status}",
        )

    def _find_or_create_file_result(self, suite_result: SuiteResult, file_path: str, area: str) -> FileResult:
        """Find an existing file result by path or create a placeholder entry."""
        for file_result in suite_result.files:
            if file_result.file == file_path:
                return file_result

        created = FileResult(
            file=file_path,
            area=area,
            location_ok=True,
            tests=[],
            issues=[],
        )
        suite_result.add_file(created)
        return created

    def _attach_issue(self, backend: SuiteResult, unit: SuiteResult, e2e: SuiteResult, issue: Issue) -> None:
        """Attach issue into the proper suite bucket based on file path."""
        normalized_file = issue.file.replace("\\", "/")
        issue.file = normalized_file

        if normalized_file.startswith("backend/"):
            self._find_or_create_file_result(backend, normalized_file, "backend").issues.append(issue)
            return
        if normalized_file.startswith("frontend/e2e/"):
            self._find_or_create_file_result(e2e, normalized_file, "e2e").issues.append(issue)
            return
        if normalized_file.startswith("frontend/test/"):
            self._find_or_create_file_result(unit, normalized_file, "unit").issues.append(issue)
            return

        self._find_or_create_file_result(backend, normalized_file, "backend").issues.append(issue)

    def _run_external_lints(self, backend: SuiteResult, unit: SuiteResult, e2e: SuiteResult) -> dict[str, Any]:
        """Execute configured external lints and attach normalized findings as issues."""
        metadata: dict[str, Any] = {
            "mode": self.external_lint,
            "results": [],
        }
        if self.external_lint != "run":
            return metadata

        backend_targets = self._suite_file_paths(backend)
        frontend_targets: list[Path] = []
        if self.suite is None or self.suite == "frontend-unit":
            frontend_targets.extend(self._suite_file_paths(unit))
        if self.suite is None or self.suite == "frontend-e2e":
            frontend_targets.extend(self._suite_file_paths(e2e))

        deduped_frontend_targets: list[Path] = []
        seen_frontend_targets: set[str] = set()
        for target in frontend_targets:
            key = str(target)
            if key in seen_frontend_targets:
                continue
            seen_frontend_targets.add(key)
            deduped_frontend_targets.append(target)

        runner = ExternalLintRunner(self.repo_root, verbose=self.verbose)
        results = runner.run(
            backend_targets=backend_targets,
            frontend_targets=deduped_frontend_targets,
        )

        for result in results:
            metadata["results"].append(
                {
                    "source": result.source,
                    "status": result.status,
                    "message": result.message,
                    "findings": len(result.findings),
                }
            )

            status_issue = self._status_issue_for_external_run(result)
            if status_issue is not None:
                self._attach_issue(backend, unit, e2e, status_issue)

            for finding in result.findings:
                self._attach_issue(backend, unit, e2e, self._issue_for_external_finding(finding))

        return metadata

    def _issue_identity_keys(self, issue: Issue) -> tuple[str, ...]:
        """Build identity keys used for cross-engine dedupe matching."""
        self._canonicalize_issue(issue)
        normalized_rule = self._rule_id_for_issue(issue)
        canonical_key = f"{issue.file}:{issue.line or 0}:{normalized_rule}"
        if issue.fingerprint:
            return (issue.fingerprint, canonical_key)
        return (canonical_key,)

    def _dedupe_issues(self, backend: SuiteResult, unit: SuiteResult, e2e: SuiteResult) -> None:
        """Deduplicate issues across suites, keeping the richest payload per key."""
        seen: dict[str, Issue] = {}
        relaxed_internal_index: dict[str, Issue] = {}
        for suite_result in (backend, unit, e2e):
            for file_result in suite_result.files:
                deduped: list[Issue] = []
                for issue in file_result.issues:
                    normalized_rule = self._rule_id_for_issue(issue)
                    relaxed_key = None
                    if normalized_rule in RELAXED_CROSS_ENGINE_RULE_IDS:
                        relaxed_key = f"{issue.file}:{normalized_rule}"

                    identity_keys = self._issue_identity_keys(issue)
                    existing = None
                    for key in identity_keys:
                        existing = seen.get(key)
                        if existing is not None:
                            break

                    if (
                        existing is None
                        and relaxed_key is not None
                        and issue.source != "internal"
                    ):
                        existing = relaxed_internal_index.get(relaxed_key)

                    if existing is None:
                        for key in identity_keys:
                            seen[key] = issue
                        deduped.append(issue)
                        if relaxed_key is not None and issue.source == "internal":
                            relaxed_internal_index.setdefault(relaxed_key, issue)
                        continue

                    if self._issue_richness_score(issue) > self._issue_richness_score(existing):
                        existing.message = issue.message
                        existing.severity = issue.severity
                        existing.category = issue.category
                        existing.line = issue.line
                        existing.identifier = issue.identifier
                        existing.suggestion = issue.suggestion
                        existing.rule_id = issue.rule_id
                        existing.source = issue.source
                        existing.fingerprint = issue.fingerprint

                    for key in identity_keys:
                        seen[key] = existing

                file_result.issues = deduped

    def _performance_budget_issues(self, timings: dict[str, float]) -> list[Issue]:
        """Create performance-budget warnings when configured thresholds are exceeded."""
        issues: list[Issue] = []
        if self.suite_time_budget_seconds and self.suite_time_budget_seconds > 0:
            for suite_name in ("backend", "frontend_unit", "frontend_e2e"):
                elapsed = timings.get(suite_name, 0.0)
                if elapsed <= self.suite_time_budget_seconds:
                    continue
                issues.append(
                    Issue(
                        file=f"__meta__/performance/{suite_name}",
                        message=(
                            f"Performance budget exceeded for {suite_name}: "
                            f"{elapsed:.3f}s > {self.suite_time_budget_seconds:.3f}s"
                        ),
                        severity=Severity.WARNING,
                        category=IssueCategory.PERFORMANCE_BUDGET,
                        line=1,
                        rule_id="performance_budget",
                        fingerprint=(
                            f"performance:{suite_name}:{round(elapsed, 3)}:"
                            f"{self.suite_time_budget_seconds:.3f}"
                        ),
                    )
                )

        if self.total_time_budget_seconds and self.total_time_budget_seconds > 0:
            total_elapsed = timings.get("total", 0.0)
            if total_elapsed > self.total_time_budget_seconds:
                issues.append(
                    Issue(
                        file="__meta__/performance/total",
                        message=(
                            "Performance budget exceeded for full gate run: "
                            f"{total_elapsed:.3f}s > {self.total_time_budget_seconds:.3f}s"
                        ),
                        severity=Severity.WARNING,
                        category=IssueCategory.PERFORMANCE_BUDGET,
                        line=1,
                        rule_id="performance_budget",
                        fingerprint=(
                            f"performance:total:{round(total_elapsed, 3)}:"
                            f"{self.total_time_budget_seconds:.3f}"
                        ),
                    )
                )

        return issues
    
    def build(self) -> dict[str, Any]:
        """Build complete quality report."""
        started_at = time.perf_counter()
        timings = {
            "backend": 0.0,
            "frontend_unit": 0.0,
            "frontend_e2e": 0.0,
            "external_lint": 0.0,
            "total": 0.0,
        }

        if self.verbose:
            print(f"\n{Colors.BOLD}Test Quality Gate - Modular{Colors.RESET}")
            print(f"Repository: {self.repo_root}")
            if self.suite:
                print(f"Suite: {self.suite}")
            print(f"Semantic rules mode: {self.semantic_rules}")
            print(f"External lint mode: {self.external_lint}")
            print()

        file_matcher = self._build_file_matcher()
        path_matcher = self._build_path_matcher(file_matcher)
        if file_matcher and self.verbose:
            print(f"{Colors.DIM}Applying include filters (files/globs){Colors.RESET}")
        
        backend = SuiteResult(suite_name="backend")
        unit = SuiteResult(suite_name="frontend_unit")
        e2e = SuiteResult(suite_name="frontend_e2e")
        
        # Analyze backend
        if self.suite is None or self.suite == "backend":
            if self.verbose:
                print(f"{Colors.BLUE}[Backend Python Tests]{Colors.RESET}")
            
            suite_started = time.perf_counter()
            py_analyzer = PythonAnalyzer(
                self.repo_root, self.config, self.patterns, self.verbose
            )
            backend_root = self.repo_root / "backend" / self.config.backend_app_name / "tests"
            backend = py_analyzer.analyze_suite(backend_root, file_matcher=path_matcher)
            timings["backend"] = time.perf_counter() - suite_started
        
        # Analyze frontend unit tests
        if self.suite is None or self.suite == "frontend-unit":
            if self.verbose:
                print(f"\n{Colors.BLUE}[Frontend Unit Tests]{Colors.RESET}")
            
            suite_started = time.perf_counter()
            try:
                from quality.frontend_unit_analyzer import FrontendUnitAnalyzer
                unit_analyzer = FrontendUnitAnalyzer(
                    self.repo_root,
                    self.config,
                    self.patterns,
                    self.verbose,
                    self.semantic_rules,
                )
                unit_root = self.repo_root / "frontend" / self.config.frontend_unit_dir
                unit = unit_analyzer.analyze_suite(unit_root, file_matcher=path_matcher)
            except ImportError:
                if self.verbose:
                    print(f"  {Colors.DIM}Frontend unit analyzer not available{Colors.RESET}")
            timings["frontend_unit"] = time.perf_counter() - suite_started
        
        # Analyze frontend E2E tests
        if self.suite is None or self.suite == "frontend-e2e":
            if self.verbose:
                print(f"\n{Colors.BLUE}[Frontend E2E Tests]{Colors.RESET}")
            
            suite_started = time.perf_counter()
            try:
                from quality.frontend_e2e_analyzer import FrontendE2EAnalyzer
                e2e_analyzer = FrontendE2EAnalyzer(
                    self.repo_root,
                    self.config,
                    self.patterns,
                    self.verbose,
                    self.semantic_rules,
                )
                e2e_root = self.repo_root / "frontend" / self.config.frontend_e2e_dir
                e2e = e2e_analyzer.analyze_suite(e2e_root, file_matcher=path_matcher)
            except ImportError:
                if self.verbose:
                    print(f"  {Colors.DIM}Frontend E2E analyzer not available{Colors.RESET}")
            timings["frontend_e2e"] = time.perf_counter() - suite_started

        # Optional include-file/include-glob filtering
        backend = self._filter_suite_result(backend, file_matcher)
        unit = self._filter_suite_result(unit, file_matcher)
        e2e = self._filter_suite_result(e2e, file_matcher)

        external_started = time.perf_counter()
        external_lint = self._run_external_lints(backend, unit, e2e)
        timings["external_lint"] = time.perf_counter() - external_started

        timings["total"] = time.perf_counter() - started_at
        for budget_issue in self._performance_budget_issues(timings):
            self._attach_issue(backend, unit, e2e, budget_issue)

        disable_rules_by_file, active_exceptions, invalid_markers = self._collect_exception_markers(
            backend,
            unit,
            e2e,
        )
        self._apply_disable_markers(
            backend,
            unit,
            e2e,
            disable_rules_by_file,
            active_exceptions,
        )
        semantic_suppressed = self._apply_semantic_mode_off(backend, unit, e2e)

        self._dedupe_issues(backend, unit, e2e)
        self._apply_suite_findings(backend, unit, e2e, semantic_suppressed, active_exceptions)
        active_exceptions_summary = self._active_exceptions_summary(active_exceptions, invalid_markers)
        
        # Build summary
        all_issues = backend.all_issues + unit.all_issues + e2e.all_issues
        
        # Categorize by severity
        errors = sum(1 for i in all_issues if i.severity == Severity.ERROR)
        warnings = sum(1 for i in all_issues if i.severity == Severity.WARNING)
        infos = sum(1 for i in all_issues if i.severity == Severity.INFO)
        
        # Categorize by type
        by_category = Counter(i.category.name.lower() for i in all_issues)
        
        # Calculate quality score (0-100)
        total_tests = backend.test_count + unit.test_count + e2e.test_count
        if total_tests > 0:
            deductions = (errors * 10) + (warnings * 3) + (infos * 1)
            max_deduction = total_tests * 10
            score = max(0, 100 - int((deductions / max(max_deduction, 1)) * 100))
        else:
            score = 100
        
        return {
            "summary": {
                "total_files": backend.file_count + unit.file_count + e2e.file_count,
                "total_tests": total_tests,
                "errors": errors,
                "warnings": warnings,
                "info": infos,
                "quality_score": score,
                "status": "passed" if errors == 0 else "failed",
                "issues_by_category": dict(by_category),
                "semantic_rules": self.semantic_rules,
                "semantic_suppressed_by_mode": semantic_suppressed,
                "active_exceptions": active_exceptions_summary,
                "external_lint": external_lint,
                "timings": {name: round(value, 4) for name, value in timings.items()},
            },
            "backend": backend.to_dict(),
            "frontend": {
                "unit": unit.to_dict(),
                "e2e": e2e.to_dict(),
            },
        }


def print_report(report: dict[str, Any], show_all: bool = False) -> None:
    """Print formatted report to terminal."""
    summary = report["summary"]
    
    print(f"\n{Colors.BOLD}{'═' * 65}{Colors.RESET}")
    print(f"{Colors.BOLD}  TEST QUALITY REPORT{Colors.RESET}")
    print(f"{'═' * 65}")
    
    # Stats
    print(f"\n{Colors.CYAN}  Statistics:{Colors.RESET}")
    print(f"    Files scanned:  {summary['total_files']}")
    print(f"    Tests found:    {summary['total_tests']}")
    print(f"    Semantic mode:  {summary.get('semantic_rules', 'soft')}")

    external_lint = summary.get("external_lint") or {}
    print(f"    External lint:  {external_lint.get('mode', 'off')}")
    
    # Quality score with color
    score = summary['quality_score']
    if score >= 80:
        score_color = Colors.GREEN
    elif score >= 60:
        score_color = Colors.YELLOW
    else:
        score_color = Colors.RED
    
    print(f"\n{Colors.CYAN}  Quality Score:{Colors.RESET} {score_color}{Colors.BOLD}{score}/100{Colors.RESET}")
    
    # Issues by severity
    print(f"\n{Colors.CYAN}  Issues:{Colors.RESET}")
    print(f"    {Colors.RED}Errors:   {summary['errors']}{Colors.RESET}")
    print(f"    {Colors.YELLOW}Warnings: {summary['warnings']}{Colors.RESET}")
    print(f"    {Colors.CYAN}Info:     {summary['info']}{Colors.RESET}")
    
    # Issues by category
    if summary['issues_by_category']:
        print(f"\n{Colors.CYAN}  By Category:{Colors.RESET}")
        for cat, count in sorted(summary['issues_by_category'].items(), key=lambda x: -x[1]):
            print(f"    {cat}: {count}")

    if summary.get("timings"):
        print(f"\n{Colors.CYAN}  Timings (s):{Colors.RESET}")
        for key, value in summary["timings"].items():
            print(f"    {key}: {value}")
    
    # Status
    status = summary['status']
    if status == "passed":
        print(f"\n{Colors.BOLD}  Status: {Colors.GREEN}✓ PASSED{Colors.RESET}")
    else:
        print(f"\n{Colors.BOLD}  Status: {Colors.RED}✗ FAILED{Colors.RESET}")
    
    print(f"{'═' * 65}\n")
    
    # Show issues
    all_issues = (
        report["backend"]["issues"] +
        report["frontend"]["unit"]["issues"] +
        report["frontend"]["e2e"]["issues"]
    )
    
    if not all_issues:
        print(f"{Colors.GREEN}  No issues found! 🎉{Colors.RESET}\n")
        return
    
    # Group by severity
    errors = [i for i in all_issues if i["severity"] == "error"]
    warnings = [i for i in all_issues if i["severity"] == "warning"]
    infos = [i for i in all_issues if i["severity"] == "info"]
    
    def print_issues(issues: list, label: str, color: str) -> None:
        if not issues:
            return
        print(f"\n{color}{Colors.BOLD}  {label}:{Colors.RESET}")
        for issue in issues[:20 if not show_all else None]:
            line = f":{issue['line']}" if issue.get('line') else ""
            print(f"    {color}•{Colors.RESET} {issue['file']}{line}")
            print(f"      {issue['message']}")
            if issue.get('suggestion'):
                print(f"      {Colors.DIM}→ {issue['suggestion']}{Colors.RESET}")
        if len(issues) > 20 and not show_all:
            print(f"      {Colors.DIM}... and {len(issues) - 20} more (use --show-all){Colors.RESET}")
    
    print_issues(errors, "ERRORS", Colors.RED)
    print_issues(warnings, "WARNINGS", Colors.YELLOW)
    if show_all:
        print_issues(infos, "INFO", Colors.CYAN)
    elif infos:
        print(f"\n{Colors.CYAN}  INFO: {len(infos)} suggestions (use --show-all to see){Colors.RESET}")
    
    print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test Quality Gate - Modular test quality analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument("--repo-root", type=Path, default=Path("."),
                        help="Repository root (default: .)")
    parser.add_argument("--report-path", type=Path,
                        default=Path("test-results/test-quality-report.json"),
                        help="JSON report output path")
    parser.add_argument("--backend-app", default="gym_app",
                        help="Django app name (default: gym_app)")
    parser.add_argument("--suite", choices=["backend", "frontend-unit", "frontend-e2e"],
                        help="Analyze specific suite only")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Verbose output")
    parser.add_argument("--strict", action="store_true",
                        help="Fail on warnings too (not just errors)")
    parser.add_argument(
        "--semantic-rules",
        choices=["off", "soft", "strict"],
        default="soft",
        help="Semantic rule mode: off, soft, or strict (default: soft)",
    )
    parser.add_argument(
        "--external-lint",
        choices=["off", "run"],
        default="off",
        help="External lint integration mode (default: off)",
    )
    parser.add_argument(
        "--suite-time-budget-seconds",
        type=float,
        default=None,
        help="Optional per-suite performance budget in seconds",
    )
    parser.add_argument(
        "--total-time-budget-seconds",
        type=float,
        default=None,
        help="Optional total performance budget in seconds",
    )
    parser.add_argument("--show-all", action="store_true",
                        help="Show all issues including info-level")
    parser.add_argument("--no-color", action="store_true",
                        help="Disable colored output")
    parser.add_argument("--json-only", action="store_true",
                        help="Output JSON only")
    parser.add_argument(
        "--include-file",
        dest="include_files",
        action="append",
        default=[],
        help=(
            "Include only this exact file path (repeatable). "
            "Paths should be repo-relative (e.g., backend/gym_app/tests/models/test_x.py)."
        ),
    )
    parser.add_argument(
        "--include-glob",
        dest="include_globs",
        action="append",
        default=[],
        help=(
            "Include files matching glob pattern (repeatable). "
            "Example: 'backend/gym_app/tests/models/test_*.py'."
        ),
    )
    
    # Threshold overrides
    parser.add_argument("--max-test-lines", type=int, default=50)
    parser.add_argument("--max-assertions", type=int, default=7)
    parser.add_argument("--max-patches", type=int, default=5)
    
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    
    if args.no_color or args.json_only or not sys.stdout.isatty():
        Colors.disable()
    
    repo_root = args.repo_root.resolve()
    if not repo_root.exists():
        print(f"Error: Repository not found: {repo_root}", file=sys.stderr)
        return 2
    
    # Build config
    config = build_config(args)
    
    # Build report
    try:
        builder = QualityReport(
            repo_root,
            config,
            args.verbose,
            args.suite,
            args.include_files,
            args.include_globs,
            args.semantic_rules,
            args.external_lint,
            args.suite_time_budget_seconds,
            args.total_time_budget_seconds,
        )
        report = builder.build()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 2
    
    # Write JSON
    report_path = (repo_root / args.report_path).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    # Output
    if args.json_only:
        print(json.dumps(report, indent=2))
    else:
        print_report(report, args.show_all)
        print(f"Report: {report_path}")
    
    # Exit code
    summary = report["summary"]
    if summary["errors"] > 0:
        return 1
    if args.strict and summary["warnings"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
