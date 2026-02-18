"""
Frontend E2E Test Analyzer.

Analyzes Playwright E2E test files using the Babel AST bridge.
Includes additional checks specific to E2E tests like fragile selectors.
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
)
from .patterns import Patterns
from .js_ast_bridge import JSASTBridge, JSFileResult, JSIssueInfo


# Map AST parser issue types to our categories
ISSUE_TYPE_MAP = {
    "PARSE_ERROR": (IssueCategory.PARSE_ERROR, Severity.ERROR),
    "EMPTY_TEST": (IssueCategory.EMPTY_TEST, Severity.ERROR),
    "NO_ASSERTIONS": (IssueCategory.NO_ASSERTIONS, Severity.WARNING),  # E2E may rely on implicit assertions
    "USELESS_ASSERTION": (IssueCategory.USELESS_ASSERTION, Severity.WARNING),
    "FORBIDDEN_TOKEN": (IssueCategory.FORBIDDEN_TOKEN, Severity.ERROR),
    "POOR_NAMING": (IssueCategory.POOR_NAMING, Severity.WARNING),
    "DUPLICATE_NAME": (IssueCategory.DUPLICATE_NAME, Severity.ERROR),
    "CONSOLE_LOG": (IssueCategory.PRINT_STATEMENT, Severity.INFO),  # Less critical in E2E
    "HARDCODED_TIMEOUT": (IssueCategory.SLEEP_CALL, Severity.ERROR),  # Critical in E2E
    "TOO_MANY_ASSERTIONS": (IssueCategory.TOO_MANY_ASSERTIONS, Severity.INFO),
    "TEST_TOO_LONG": (IssueCategory.TEST_TOO_LONG, Severity.INFO),
}

# Patterns for fragile selectors
FRAGILE_SELECTOR_PATTERNS = [
    (re.compile(r'\.locator\s*\(\s*[\'"]\.[\w-]+[\'"]'), "class-based"),
    (re.compile(r'\.locator\s*\(\s*[\'"]#[\w-]+[\'"]'), "id-based (OK if stable)"),
    (re.compile(r'\.locator\s*\(\s*[\'"]\w+\[\d+\][\'"]'), "index-based"),
    (re.compile(r'\.nth\s*\(\s*\d+\s*\)'), "nth() positional"),
    (re.compile(r'\.first\s*\(\s*\)'), "first() positional"),
    (re.compile(r'\.last\s*\(\s*\)'), "last() positional"),
]

# Recommended selector patterns
GOOD_SELECTOR_PATTERNS = [
    re.compile(r'getByRole\s*\('),
    re.compile(r'getByLabel\s*\('),
    re.compile(r'getByText\s*\('),
    re.compile(r'getByPlaceholder\s*\('),
    re.compile(r'getByTestId\s*\('),
    re.compile(r'getByAltText\s*\('),
    re.compile(r'getByTitle\s*\('),
]


class FrontendE2EAnalyzer:
    """
    Analyzes frontend E2E tests (Playwright).
    
    Uses the Babel AST bridge to parse JavaScript/TypeScript files
    and applies quality checks specific to E2E test best practices.
    """
    
    def __init__(
        self,
        repo_root: Path,
        config: Config,
        patterns: Patterns,
        verbose: bool = False,
    ):
        self.repo_root = repo_root
        self.config = config
        self.patterns = patterns
        self.verbose = verbose
        self.bridge = JSASTBridge(repo_root, verbose)
    
    def discover_files(
        self,
        test_root: Path,
        file_matcher: Callable[[Path], bool] | None = None,
    ) -> list[Path]:
        """Find all E2E test files."""
        if not test_root.exists():
            return []
        
        files = []
        for suffix in self.config.js_e2e_suffixes:
            files.extend(test_root.rglob(f"*{suffix}"))
        
        files = sorted(files)
        if file_matcher:
            files = [path for path in files if file_matcher(path)]

        return files
    
    def _convert_issue(
        self, 
        js_issue: JSIssueInfo, 
        file_path: str,
    ) -> Issue:
        """Convert a JS parser issue to our Issue format."""
        category, severity = ISSUE_TYPE_MAP.get(
            js_issue.issue_type, 
            (IssueCategory.PARSE_ERROR, Severity.WARNING),
        )
        
        return Issue(
            file=file_path,
            message=js_issue.message,
            severity=severity,
            category=category,
            line=js_issue.line,
            identifier=js_issue.identifier,
            suggestion=js_issue.suggestion or self._get_suggestion(category),
        )
    
    def _get_suggestion(self, category: IssueCategory) -> str:
        """Get fix suggestion for an issue category."""
        suggestions = {
            IssueCategory.EMPTY_TEST: "Add user flow actions and expect() assertions",
            IssueCategory.NO_ASSERTIONS: "Add expect() to verify page state or element visibility",
            IssueCategory.USELESS_ASSERTION: "Replace with meaningful assertions on page state",
            IssueCategory.POOR_NAMING: "Use descriptive name: 'user can <action> from <page>'",
            IssueCategory.DUPLICATE_NAME: "Rename to be unique within test file",
            IssueCategory.FORBIDDEN_TOKEN: "Remove forbidden token from name",
            IssueCategory.PRINT_STATEMENT: "Remove console.log (use Playwright trace/video)",
            IssueCategory.SLEEP_CALL: "Use page.waitForSelector() or expect().toBeVisible()",
            IssueCategory.TOO_MANY_ASSERTIONS: "Consider splitting into multiple test cases",
            IssueCategory.TEST_TOO_LONG: "Extract page object patterns or helper functions",
        }
        return suggestions.get(category, "")
    
    def _check_file_location(self, file_path: Path) -> list[Issue]:
        """Check if file is in correct location."""
        issues = []
        rel_path = file_path.relative_to(self.repo_root)
        
        # E2E tests should be in frontend/e2e/
        expected_prefix = Path("frontend") / "e2e"
        if not str(rel_path).startswith(str(expected_prefix)):
            issues.append(Issue(
                file=str(rel_path),
                message=f"E2E test file should be in frontend/e2e/",
                severity=Severity.WARNING,
                category=IssueCategory.MISPLACED_FILE,
                line=1,
                suggestion=f"Move to frontend/e2e/ directory",
            ))
        
        return issues
    
    def _check_selectors(self, file_path: Path) -> list[Issue]:
        """Check for fragile selectors in the file."""
        issues = []
        rel_path = str(file_path.relative_to(self.repo_root))
        
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            return issues
        
        lines = content.split("\n")
        
        for line_num, line in enumerate(lines, start=1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue
            
            # Check for fragile selectors
            for pattern, selector_type in FRAGILE_SELECTOR_PATTERNS:
                if pattern.search(line):
                    # Check if there's a good selector pattern on the same line
                    has_good = any(p.search(line) for p in GOOD_SELECTOR_PATTERNS)
                    if not has_good and "data-testid" not in line.lower():
                        issues.append(Issue(
                            file=rel_path,
                            message=f"Fragile selector ({selector_type}): consider using getByRole/getByTestId",
                            severity=Severity.INFO,
                            category=IssueCategory.FRAGILE_LOCATOR,
                            line=line_num,
                            suggestion="Use getByRole(), getByTestId(), or getByText() for resilient selectors",
                        ))
                        break  # One issue per line
        
        return issues
    
    def analyze_file(self, file_path: Path) -> FileResult:
        """Analyze a single E2E test file."""
        rel_path = str(file_path.relative_to(self.repo_root))
        
        # Parse with AST bridge
        parse_result = self.bridge.parse_file(file_path, is_e2e=True)
        
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
                area="e2e",
                location_ok=True,
                tests=[],
                issues=issues,
            )
        
        # Convert parser issues to our format
        for js_issue in parse_result.issues:
            issues.append(self._convert_issue(js_issue, rel_path))
        
        # E2E-specific checks
        issues.extend(self._check_file_location(file_path))
        issues.extend(self._check_selectors(file_path))
        
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
            area="e2e",
            location_ok=True,
            tests=tests,
            issues=issues,
        )
    
    def analyze_suite(
        self,
        test_root: Path,
        file_matcher: Callable[[Path], bool] | None = None,
    ) -> SuiteResult:
        """Analyze all E2E test files."""
        result = SuiteResult(suite_name="frontend_e2e")
        
        if not self.bridge.is_available():
            error_file = str((Path("frontend") / self.config.frontend_e2e_dir).as_posix())
            result.add_file(FileResult(
                file=error_file,
                area="e2e",
                location_ok=True,
                tests=[],
                issues=[Issue(
                    file=error_file,
                    message="AST bridge not available - frontend E2E tests were not analyzed",
                    severity=Severity.ERROR,
                    category=IssueCategory.PARSE_ERROR,
                    line=1,
                    suggestion="Install frontend dependencies and ensure Node.js is available",
                )],
            ))
            if self.verbose:
                print(f"  {Colors.YELLOW}AST bridge not available{Colors.RESET}")
            return result
        
        files = self.discover_files(test_root, file_matcher=file_matcher)
        
        if self.verbose:
            print(f"  Found {len(files)} E2E test files")
        
        for file_path in files:
            file_result = self.analyze_file(file_path)
            result.add_file(file_result)
            
            if self.verbose and file_result.issues:
                print(f"    {file_path.name}: {len(file_result.issues)} issues")
        
        if self.verbose:
            err = sum(1 for i in result.all_issues if i.severity == Severity.ERROR)
            warn = sum(1 for i in result.all_issues if i.severity == Severity.WARNING)
            print(f"  Total: {result.test_count} tests, {err} errors, {warn} warnings")
        
        return result
