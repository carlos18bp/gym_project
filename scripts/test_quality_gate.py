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
import sys
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
    Issue,
    SuiteResult,
    DEFAULT_CONFIG,
    Patterns,
)
from quality.backend_analyzer import PythonAnalyzer


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
    ):
        self.repo_root = repo_root
        self.config = config
        self.verbose = verbose
        self.suite = suite  # None = all, or 'backend', 'frontend-unit', 'frontend-e2e'
        self.patterns = Patterns(config)
        self.include_files = tuple(include_files or ())
        self.include_globs = tuple(include_globs or ())

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
    
    def build(self) -> dict[str, Any]:
        """Build complete quality report."""
        if self.verbose:
            print(f"\n{Colors.BOLD}Test Quality Gate - Modular{Colors.RESET}")
            print(f"Repository: {self.repo_root}")
            if self.suite:
                print(f"Suite: {self.suite}")
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
            
            py_analyzer = PythonAnalyzer(
                self.repo_root, self.config, self.patterns, self.verbose
            )
            backend_root = self.repo_root / "backend" / self.config.backend_app_name / "tests"
            backend = py_analyzer.analyze_suite(backend_root, file_matcher=path_matcher)
        
        # Analyze frontend unit tests
        if self.suite is None or self.suite == "frontend-unit":
            if self.verbose:
                print(f"\n{Colors.BLUE}[Frontend Unit Tests]{Colors.RESET}")
            
            try:
                from quality.frontend_unit_analyzer import FrontendUnitAnalyzer
                unit_analyzer = FrontendUnitAnalyzer(
                    self.repo_root, self.config, self.patterns, self.verbose
                )
                unit_root = self.repo_root / "frontend" / self.config.frontend_unit_dir
                unit = unit_analyzer.analyze_suite(unit_root, file_matcher=path_matcher)
            except ImportError:
                if self.verbose:
                    print(f"  {Colors.DIM}Frontend unit analyzer not available{Colors.RESET}")
        
        # Analyze frontend E2E tests
        if self.suite is None or self.suite == "frontend-e2e":
            if self.verbose:
                print(f"\n{Colors.BLUE}[Frontend E2E Tests]{Colors.RESET}")
            
            try:
                from quality.frontend_e2e_analyzer import FrontendE2EAnalyzer
                e2e_analyzer = FrontendE2EAnalyzer(
                    self.repo_root, self.config, self.patterns, self.verbose
                )
                e2e_root = self.repo_root / "frontend" / self.config.frontend_e2e_dir
                e2e = e2e_analyzer.analyze_suite(e2e_root, file_matcher=path_matcher)
            except ImportError:
                if self.verbose:
                    print(f"  {Colors.DIM}Frontend E2E analyzer not available{Colors.RESET}")

        # Optional include-file/include-glob filtering
        backend = self._filter_suite_result(backend, file_matcher)
        unit = self._filter_suite_result(unit, file_matcher)
        e2e = self._filter_suite_result(e2e, file_matcher)
        
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
