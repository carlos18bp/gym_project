"""
Frontend Unit Test Analyzer.

Analyzes Jest/Vue Test Utils test files using the Babel AST bridge.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Iterator

from .base import (
    Severity,
    IssueCategory,
    Issue,
    TestInfo,
    FileResult,
    SuiteResult,
    Config,
    Colors,
    SEMANTIC_RULE_IDS,
)
from .patterns import Patterns
from .js_ast_bridge import JSASTBridge, JSFileResult, JSIssueInfo
from .junk_detectors import (
    analyze_unit_source,
    collect_blocks,
    detect_duplicates,
    extract_test_blocks,
    findings_to_issues,
)


# Map AST parser issue types to our categories
ISSUE_TYPE_MAP = {
    "PARSE_ERROR": (IssueCategory.PARSE_ERROR, Severity.ERROR),
    "EMPTY_TEST": (IssueCategory.EMPTY_TEST, Severity.ERROR),
    "NO_ASSERTIONS": (IssueCategory.NO_ASSERTIONS, Severity.ERROR),
    "USELESS_ASSERTION": (IssueCategory.USELESS_ASSERTION, Severity.WARNING),
    "FORBIDDEN_TOKEN": (IssueCategory.FORBIDDEN_TOKEN, Severity.ERROR),
    "POOR_NAMING": (IssueCategory.POOR_NAMING, Severity.WARNING),
    "DUPLICATE_NAME": (IssueCategory.DUPLICATE_NAME, Severity.ERROR),
    "CONSOLE_LOG": (IssueCategory.PRINT_STATEMENT, Severity.WARNING),
    "HARDCODED_TIMEOUT": (IssueCategory.SLEEP_CALL, Severity.WARNING),
    "TOO_MANY_ASSERTIONS": (IssueCategory.TOO_MANY_ASSERTIONS, Severity.WARNING),
    "TEST_TOO_LONG": (IssueCategory.TEST_TOO_LONG, Severity.INFO),
    "IMPLEMENTATION_COUPLING": (IssueCategory.IMPLEMENTATION_COUPLING, Severity.WARNING),
    "FRAGILE_SELECTOR": (IssueCategory.FRAGILE_LOCATOR, Severity.WARNING),
    "MULTI_RENDER": (IssueCategory.MULTI_RENDER, Severity.INFO),
    "NETWORK_DEPENDENCY": (IssueCategory.NETWORK_DEPENDENCY, Severity.WARNING),
    "NONDETERMINISTIC": (IssueCategory.NONDETERMINISTIC, Severity.INFO),
    "GLOBAL_STATE_LEAK": (IssueCategory.GLOBAL_STATE_LEAK, Severity.WARNING),
    "SNAPSHOT_OVERRELIANCE": (IssueCategory.SNAPSHOT_OVERRELIANCE, Severity.INFO),
}

ISSUE_RULE_ID_MAP = {
    "IMPLEMENTATION_COUPLING": "implementation_coupling",
    "FRAGILE_SELECTOR": "fragile_locator",
    "MULTI_RENDER": "multi_render",
    "NETWORK_DEPENDENCY": "network_dependency",
    "NONDETERMINISTIC": "nondeterministic",
    "GLOBAL_STATE_LEAK": "global_state_leak",
    "SNAPSHOT_OVERRELIANCE": "snapshot_overreliance",
}


class FrontendUnitAnalyzer:
    """
    Analyzes frontend unit tests (Jest/Vue Test Utils).
    
    Uses the Babel AST bridge to parse JavaScript/TypeScript files
    and applies quality checks for unit test best practices.
    """
    
    def __init__(
        self,
        repo_root: Path,
        config: Config,
        patterns: Patterns,
        verbose: bool = False,
        semantic_rules: str = "soft",
    ):
        self.repo_root = repo_root
        self.config = config
        self.patterns = patterns
        self.verbose = verbose
        self.semantic_rules = semantic_rules
        self.bridge = JSASTBridge(repo_root, verbose)
    
    def discover_files(
        self,
        test_root: Path,
        file_matcher: Callable[[Path], bool] | None = None,
    ) -> list[Path]:
        """Find all unit test files."""
        if not test_root.exists():
            return []
        
        files = []
        for suffix in self.config.js_unit_suffixes:
            files.extend(test_root.rglob(f"*{suffix}"))
        
        # Exclude E2E files and build artifacts if they somehow end up here
        _EXCLUDED_DIRS = frozenset({
            "node_modules", "coverage", "coverage-e2e",
            ".next", "dist", "build", "test-results",
        })
        files = [
            f for f in files
            if "e2e" not in str(f).lower()
            and "playwright" not in str(f).lower()
            and not any(part in _EXCLUDED_DIRS for part in f.parts)
        ]
        
        files = sorted(files)
        if file_matcher:
            files = [path for path in files if file_matcher(path)]

        return files
    
    def _convert_issue(
        self, 
        js_issue: JSIssueInfo, 
        file_path: str,
    ) -> Issue | None:
        """Convert a JS parser issue to our Issue format."""
        category, severity = ISSUE_TYPE_MAP.get(
            js_issue.issue_type, 
            (IssueCategory.PARSE_ERROR, Severity.WARNING),
        )
        rule_id = ISSUE_RULE_ID_MAP.get(js_issue.issue_type, category.name.lower())

        if (
            js_issue.issue_type == "NETWORK_DEPENDENCY"
            and "without observable outcome" in js_issue.message.lower()
        ):
            severity = Severity.INFO

        if self.semantic_rules == "off" and rule_id in SEMANTIC_RULE_IDS:
            return None
        
        return Issue(
            file=file_path,
            message=js_issue.message,
            severity=severity,
            category=category,
            line=js_issue.line,
            identifier=js_issue.identifier,
            suggestion=js_issue.suggestion or self._get_suggestion(category),
            rule_id=rule_id,
        )
    
    def _get_suggestion(self, category: IssueCategory) -> str:
        """Get fix suggestion for an issue category."""
        suggestions = {
            IssueCategory.EMPTY_TEST: "Add meaningful test logic with expect() assertions",
            IssueCategory.NO_ASSERTIONS: "Add expect() assertions to verify behavior",
            IssueCategory.USELESS_ASSERTION: "Replace with meaningful assertions that test actual behavior",
            IssueCategory.POOR_NAMING: "Use descriptive name: 'should <action> when <condition>'",
            IssueCategory.DUPLICATE_NAME: "Rename to be unique within describe block",
            IssueCategory.FORBIDDEN_TOKEN: "Remove forbidden token from name",
            IssueCategory.PRINT_STATEMENT: "Remove console.log (use debugger or test reporter)",
            IssueCategory.SLEEP_CALL: "Use waitFor() or findBy* instead of fixed timeouts",
            IssueCategory.TOO_MANY_ASSERTIONS: "Split into multiple focused tests",
            IssueCategory.TEST_TOO_LONG: "Extract setup to beforeEach or helper functions",
            IssueCategory.IMPLEMENTATION_COUPLING: "Prefer user-observable assertions instead of wrapper.vm internals",
            IssueCategory.FRAGILE_LOCATOR: "Avoid class/id/querySelector selectors when resilient queries are possible",
            IssueCategory.MULTI_RENDER: "Split into focused tests or add quality: allow-multi-render (reason)",
            IssueCategory.NETWORK_DEPENDENCY: "Isolate network boundaries and assert behavior/state, not only call contracts",
            IssueCategory.NONDETERMINISTIC: "Control time/randomness via fake timers, setSystemTime, or deterministic mocks",
            IssueCategory.GLOBAL_STATE_LEAK: "Restore global state (storage/timers/mocks) to avoid cross-test leaks",
            IssueCategory.SNAPSHOT_OVERRELIANCE: "Add semantic assertions and keep snapshots small/focused",
        }
        return suggestions.get(category, "")
    
    def _check_file_location(self, file_path: Path) -> list[Issue]:
        """Check if file is in correct location."""
        issues = []
        rel_path = file_path.relative_to(self.repo_root)
        
        # Unit tests should be in configured frontend unit test directory.
        expected_prefix = Path("frontend") / self.config.frontend_unit_dir
        if not str(rel_path).startswith(str(expected_prefix)):
            issues.append(Issue(
                file=str(rel_path),
                message=f"Unit test file should be in {expected_prefix.as_posix()}/",
                severity=Severity.WARNING,
                category=IssueCategory.MISPLACED_FILE,
                line=1,
                suggestion=f"Move to {expected_prefix.as_posix()}/ directory",
            ))
        
        return issues
    
    def analyze_file(self, file_path: Path) -> FileResult:
        """Analyze a single unit test file."""
        rel_path = str(file_path.relative_to(self.repo_root))
        
        # Parse with AST bridge
        parse_result = self.bridge.parse_file(file_path, is_e2e=False)
        
        issues: list[Issue] = []
        
        # Handle parse errors
        if parse_result.error:
            issues.append(Issue(
                file=rel_path,
                message=f"Parse error: {parse_result.error}",
                severity=Severity.ERROR,
                category=IssueCategory.PARSE_ERROR,
                line=1,
            ))
            return FileResult(
                file=rel_path,
                area="unit",
                location_ok=True,
                tests=[],
                issues=issues,
            )
        
        # Convert parser issues to our format
        for js_issue in parse_result.issues:
            converted = self._convert_issue(js_issue, rel_path)
            if converted is not None:
                issues.append(converted)
        
        # Check file location
        issues.extend(self._check_file_location(file_path))

        # Junk-test detectors, read from source so they survive a missing bridge
        try:
            source = file_path.read_text(encoding="utf-8", errors="replace")
            issues.extend(findings_to_issues(analyze_unit_source(source, rel_path, file_path)))
        except OSError:
            pass
        
        # Build TestInfo list from parsed tests
        tests = [
            TestInfo(
                name=t.name,
                lineno=t.line,
                end_lineno=t.end_line,
                num_lines=t.num_lines,
                num_assertions=t.assertion_count,
                has_console_log=t.has_console_log,
                has_hardcoded_timeout=t.has_hardcoded_timeout,
                is_empty=t.is_empty,
                describe_block=t.describe_block,
                test_type=t.test_type,
            )
            for t in parse_result.tests
        ]
        
        return FileResult(
            file=rel_path,
            area="unit",
            location_ok=True,
            tests=tests,
            issues=issues,
        )
    
    def _analyze_file_source_only(self, file_path: Path) -> FileResult:
        """
        Junk detectors alone, for when the AST bridge is unavailable.

        Tests are enumerated from source so a degraded run does not report an
        empty suite.
        """
        rel_path = str(file_path.relative_to(self.repo_root))
        try:
            source = file_path.read_text(encoding="utf-8", errors="replace")
            issues = findings_to_issues(analyze_unit_source(source, rel_path, file_path))
        except OSError:
            source, issues = "", []

        tests = [
            TestInfo(
                name=block.name,
                lineno=block.start_line,
                end_lineno=block.end_line,
                num_lines=block.end_line - block.start_line + 1,
                num_assertions=len(re.findall(r"\bexpect\s*\(", block.source)),
                test_type="test",
            )
            for block in extract_test_blocks(source, rel_path)
        ]

        return FileResult(
            file=rel_path, area="unit", location_ok=True, tests=tests, issues=issues,
        )

    def _attach_duplicate_issues(self, result: SuiteResult, files: list[Path]) -> None:
        """Report duplicate coverage across the whole unit suite."""
        findings = detect_duplicates(collect_blocks(files, self.repo_root))
        if not findings:
            return
        by_file = {fr.file.replace("\\", "/"): fr for fr in result.files}
        for issue in findings_to_issues(findings):
            target = by_file.get(issue.file.replace("\\", "/"))
            if target is not None:
                target.issues.append(issue)

    def analyze_suite(
        self,
        test_root: Path,
        file_matcher: Callable[[Path], bool] | None = None,
    ) -> SuiteResult:
        """Analyze all unit test files."""
        result = SuiteResult(suite_name="frontend_unit")
        bridge_ok = self.bridge.is_available()

        if not bridge_ok:
            # Reported as an error so a run without the bridge is never mistaken
            # for a clean one, but the source-based junk detectors still run.
            error_file = str((Path("frontend") / self.config.frontend_unit_dir).as_posix())
            result.add_file(FileResult(
                file=error_file,
                area="unit",
                location_ok=True,
                tests=[],
                issues=[Issue(
                    file=error_file,
                    message=(
                        "AST bridge not available - AST-based unit rules were NOT run "
                        f"(junk detectors still applied): {self.bridge.unavailable_reason()}"
                    ),
                    severity=Severity.ERROR,
                    category=IssueCategory.PARSE_ERROR,
                    line=1,
                    suggestion="Install frontend dependencies and ensure Node.js is available",
                )],
            ))
            if self.verbose:
                print(f"  {Colors.YELLOW}AST bridge not available - source-only pass{Colors.RESET}")

        files = self.discover_files(test_root, file_matcher=file_matcher)

        if self.verbose:
            print(f"  Found {len(files)} unit test files")

        for file_path in files:
            file_result = (
                self.analyze_file(file_path) if bridge_ok
                else self._analyze_file_source_only(file_path)
            )
            result.add_file(file_result)

            if self.verbose and file_result.issues:
                print(f"    {file_path.name}: {len(file_result.issues)} issues")

        self._attach_duplicate_issues(result, files)
        
        if self.verbose:
            err = sum(1 for i in result.all_issues if i.severity == Severity.ERROR)
            warn = sum(1 for i in result.all_issues if i.severity == Severity.WARNING)
            print(f"  Total: {result.test_count} tests, {err} errors, {warn} warnings")
        
        return result
