"""
Backend (Python/pytest) test quality analyzer.

Analyzes Python test files using AST for comprehensive quality checks:
- Empty tests, missing assertions, useless assertions
- Naming issues (forbidden tokens, generic names, duplicates)
- Code quality (sleep calls, print statements, silent exceptions)
- Mocking issues (excessive mocking, unverified mocks)
- Structure (misplaced files, missing docstrings)
"""

from __future__ import annotations

import ast
import re
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING

from .base import (
    Severity,
    IssueCategory,
    Colors,
    Issue,
    TestInfo,
    FileResult,
    SuiteResult,
)

if TYPE_CHECKING:
    from .base import Config
    from .patterns import Patterns


ALLOW_CALL_CONTRACT_PATTERN = re.compile(
    r"quality:\s*allow-call-contract\s*\(([^)]*)\)",
    re.IGNORECASE,
)


class ASTAnalyzer:
    """
    Utility class for analyzing Python AST nodes.
    
    Provides methods to extract information about test functions,
    detect patterns, and count specific constructs.
    """
    
    # Assertion method names (pytest and unittest)
    ASSERTION_PATTERNS = {
        # pytest
        "assert",
        # unittest
        "assertEqual", "assertNotEqual", "assertTrue", "assertFalse",
        "assertIs", "assertIsNot", "assertIsNone", "assertIsNotNone",
        "assertIn", "assertNotIn", "assertIsInstance", "assertNotIsInstance",
        "assertRaises", "assertWarns", "assertAlmostEqual", "assertNotAlmostEqual",
        "assertGreater", "assertGreaterEqual", "assertLess", "assertLessEqual",
        "assertRegex", "assertNotRegex", "assertCountEqual",
        # DRF
        "assertContains", "assertNotContains", "assertRedirects",
        "assertTemplateUsed", "assertTemplateNotUsed",
    }
    
    # Mock assertion methods
    MOCK_ASSERTIONS = {
        "assert_called", "assert_called_once", "assert_called_with",
        "assert_called_once_with", "assert_any_call", "assert_has_calls",
        "assert_not_called",
    }
    
    @classmethod
    def get_function_lines(cls, node: ast.FunctionDef) -> int:
        """Get the number of lines in a function."""
        if node.end_lineno:
            return node.end_lineno - node.lineno + 1
        return 1
    
    @classmethod
    def has_docstring(cls, node: ast.FunctionDef) -> bool:
        """Check if a function has a docstring."""
        if not node.body:
            return False
        first = node.body[0]
        if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant):
            return isinstance(first.value.value, str)
        return False
    
    @classmethod
    def is_empty_body(cls, node: ast.FunctionDef) -> bool:
        """
        Check if a function body is effectively empty.
        
        Empty means: only pass, ..., docstring, or comments.
        """
        meaningful_stmts = []
        for stmt in node.body:
            # Skip docstring
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
                if isinstance(stmt.value.value, str):
                    continue
            # Skip pass
            if isinstance(stmt, ast.Pass):
                continue
            # Skip ellipsis (...)
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
                if stmt.value.value is ...:
                    continue
            meaningful_stmts.append(stmt)
        
        return len(meaningful_stmts) == 0
    
    @classmethod
    def count_assertions(cls, node: ast.FunctionDef) -> tuple[int, list[str]]:
        """
        Count assertions in a function and return assertion strings.
        
        Returns:
            Tuple of (count, list of assertion source representations).
        """
        assertions = []
        
        for child in ast.walk(node):
            # pytest assert
            if isinstance(child, ast.Assert):
                assertions.append(ast.unparse(child) if hasattr(ast, 'unparse') else "assert ...")
            
            # unittest self.assert*
            elif isinstance(child, ast.Call):
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr in cls.ASSERTION_PATTERNS:
                        assertions.append(child.func.attr)
        
        return len(assertions), assertions
    
    @classmethod
    def count_patches(cls, node: ast.FunctionDef) -> int:
        """Count @patch decorators on a function."""
        count = 0
        for decorator in node.decorator_list:
            target = decorator.func if isinstance(decorator, ast.Call) else decorator
            if cls._is_patch_decorator(target):
                count += 1
        return count

    @classmethod
    def _is_patch_decorator(cls, node: ast.AST) -> bool:
        """Check if a decorator node references unittest.mock.patch variants."""
        if isinstance(node, ast.Name):
            return node.id == "patch"

        if isinstance(node, ast.Attribute):
            if node.attr == "patch":
                return True
            if node.attr == "object":
                return cls._attribute_chain_has_patch(node.value)

        return False

    @classmethod
    def _attribute_chain_has_patch(cls, node: ast.AST) -> bool:
        """Check if an attribute chain contains a patch reference."""
        current = node
        while isinstance(current, ast.Attribute):
            if current.attr == "patch":
                return True
            current = current.value

        return isinstance(current, ast.Name) and current.id == "patch"

    @classmethod
    def has_sleep_call(cls, node: ast.FunctionDef) -> bool:
        """Check if function contains time.sleep() calls."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                # time.sleep()
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr == "sleep":
                        return True
                # from time import sleep; sleep()
                elif isinstance(child.func, ast.Name):
                    if child.func.id == "sleep":
                        return True
        return False
    
    @classmethod
    def has_print_call(cls, node: ast.FunctionDef) -> bool:
        """Check if function contains print() calls."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id == "print":
                    return True
        return False
    
    @classmethod
    def has_silent_except(cls, node: ast.FunctionDef) -> bool:
        """
        Check if function has try/except that silently catches exceptions.
        
        Silent = except block with only pass, continue, or nothing meaningful.
        """
        for child in ast.walk(node):
            if isinstance(child, ast.ExceptHandler):
                # Check if handler body is effectively empty
                body_empty = all(
                    isinstance(stmt, (ast.Pass, ast.Continue)) or
                    (isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant))
                    for stmt in child.body
                )
                if body_empty:
                    return True
        return False
    
    @classmethod
    def has_unverified_mock(cls, node: ast.FunctionDef) -> bool:
        """
        Check if function creates mocks but never verifies them.
        
        Looks for Mock(), MagicMock() without corresponding assert_called*.
        """
        has_mock_creation = False
        has_mock_assertion = False
        
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                # Check for Mock() or MagicMock()
                if isinstance(child.func, ast.Name):
                    if child.func.id in ("Mock", "MagicMock"):
                        has_mock_creation = True
                elif isinstance(child.func, ast.Attribute):
                    if child.func.attr in ("Mock", "MagicMock"):
                        has_mock_creation = True
                    # Check for mock assertions
                    if child.func.attr in cls.MOCK_ASSERTIONS:
                        has_mock_assertion = True
        
        return has_mock_creation and not has_mock_assertion
    
    @classmethod
    def get_vague_assertions(cls, node: ast.FunctionDef) -> list[int]:
        """
        Find vague assertions that just check truthiness.
        
        Examples: assert response, assert result, self.assertTrue(obj)
        
        Returns:
            List of line numbers with vague assertions.
        """
        vague_lines = []
        
        for child in ast.walk(node):
            if isinstance(child, ast.Assert):
                test = child.test
                # assert <name> (single variable)
                if isinstance(test, ast.Name):
                    vague_lines.append(child.lineno)
                # assert <attr> (single attribute)
                elif isinstance(test, ast.Attribute):
                    vague_lines.append(child.lineno)
        
        return vague_lines

    @classmethod
    def _call_name(cls, call: ast.Call) -> str:
        """Return dotted call path for a Call node (best effort)."""
        parts: list[str] = []
        current: ast.AST = call.func
        while isinstance(current, ast.Attribute):
            parts.append(current.attr)
            current = current.value
        if isinstance(current, ast.Name):
            parts.append(current.id)
        return ".".join(reversed(parts))

    @classmethod
    def _first_string_arg_contains(cls, call: ast.Call, *needles: str) -> bool:
        """Check if first call argument is a string containing any needle."""
        if not call.args:
            return False
        first = call.args[0]
        if not isinstance(first, ast.Constant) or not isinstance(first.value, str):
            return False
        lowered = first.value.lower()
        return any(needle in lowered for needle in needles)

    @classmethod
    def get_nondeterministic_signals(cls, node: ast.FunctionDef) -> set[str]:
        """Collect non-deterministic sources used inside a test function."""
        signals: set[str] = set()
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            call_name = cls._call_name(child)
            if call_name in {"datetime.now", "datetime.utcnow", "timezone.now", "time.time", "uuid.uuid4"}:
                signals.add(call_name)
            elif call_name.startswith("random.") and call_name != "random.seed":
                signals.add(call_name)
        return signals

    @classmethod
    def has_determinism_control(cls, node: ast.FunctionDef) -> bool:
        """Detect explicit deterministic controls (freeze_time, seed, monkeypatch setattr)."""
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            call_name = cls._call_name(child)
            if call_name in {"freeze_time", "freezegun.freeze_time", "random.seed"}:
                return True
            if call_name.endswith("setattr") and cls._first_string_arg_contains(
                child,
                "timezone.now",
                "datetime",
                "time.time",
                "uuid.uuid4",
                "random.",
            ):
                return True
        return False

    @classmethod
    def get_network_io_signals(cls, node: ast.FunctionDef) -> set[str]:
        """Collect direct network/IO dependency calls inside a test function."""
        signals: set[str] = set()
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            call_name = cls._call_name(child)
            if call_name == "open":
                signals.add("open")
            elif call_name.startswith(("requests.", "httpx.", "boto3.", "urllib.")):
                signals.add(call_name)
        return signals

    @classmethod
    def has_mock_call_contract_only(cls, node: ast.FunctionDef) -> bool:
        """Detect tests asserting only mock call contracts without observable-effect assertions."""
        has_mock_assertion = False
        observable_assertions = 0

        for child in ast.walk(node):
            if isinstance(child, ast.Assert):
                observable_assertions += 1
            elif isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute):
                if child.func.attr in cls.MOCK_ASSERTIONS:
                    has_mock_assertion = True
                if child.func.attr in cls.ASSERTION_PATTERNS:
                    observable_assertions += 1

        return has_mock_assertion and observable_assertions == 0

    @classmethod
    def get_inline_payload_lines(cls, node: ast.FunctionDef) -> list[int]:
        """Return lines where large inline dict/list payloads are detected."""
        lines: set[int] = set()
        for child in ast.walk(node):
            if isinstance(child, ast.Dict) and len(child.keys) >= 8:
                lines.add(child.lineno)
            elif isinstance(child, (ast.List, ast.Tuple)) and len(child.elts) >= 12:
                lines.add(child.lineno)
        return sorted(lines)

    @classmethod
    def _is_os_environ_node(cls, node: ast.AST) -> bool:
        """Check whether node references os.environ."""
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "os"
            and node.attr == "environ"
        )

    @classmethod
    def get_global_state_signals(cls, node: ast.FunctionDef) -> set[str]:
        """Collect global-state mutation signals within test function body."""
        signals: set[str] = set()
        for child in ast.walk(node):
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Subscript) and cls._is_os_environ_node(target.value):
                        signals.add("os.environ mutation")
                    elif isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "settings":
                        signals.add(f"settings.{target.attr} mutation")
            elif isinstance(child, ast.AnnAssign):
                target = child.target
                if isinstance(target, ast.Subscript) and cls._is_os_environ_node(target.value):
                    signals.add("os.environ mutation")
                elif isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "settings":
                    signals.add(f"settings.{target.attr} mutation")
            elif isinstance(child, ast.AugAssign):
                target = child.target
                if isinstance(target, ast.Subscript) and cls._is_os_environ_node(target.value):
                    signals.add("os.environ mutation")
                elif isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "settings":
                    signals.add(f"settings.{target.attr} mutation")

            if isinstance(child, ast.Call):
                call_name = cls._call_name(child)
                if call_name in {"os.putenv", "os.unsetenv"}:
                    signals.add(call_name)
                if call_name.startswith("os.environ.") and call_name.split(".")[-1] in {"update", "setdefault", "pop", "clear"}:
                    signals.add(call_name)

        return signals


class PythonAnalyzer:
    """
    Analyzes Python test files for quality issues.
    """
    
    def __init__(
        self, 
        repo_root: Path, 
        config: "Config", 
        patterns: "Patterns", 
        verbose: bool = False
    ):
        self.repo_root = repo_root
        self.config = config
        self.patterns = patterns
        self.verbose = verbose
    
    def _rel(self, path: Path) -> str:
        return path.relative_to(self.repo_root).as_posix()
    
    def _log(self, msg: str) -> None:
        if self.verbose:
            print(f"  {Colors.DIM}→{Colors.RESET} {msg}")

    @staticmethod
    def _has_allow_call_contract(node: ast.FunctionDef, source: str | None) -> bool:
        """Check inline allow marker with required non-empty reason."""
        if not source:
            return False
        lines = source.splitlines()
        start = max((node.lineno or 1) - 1, 0)
        end = node.end_lineno or node.lineno or start + 1
        snippet = "\n".join(lines[start:end])
        marker = ALLOW_CALL_CONTRACT_PATTERN.search(snippet)
        if marker is None:
            return False
        return bool((marker.group(1) or "").strip())
    
    def analyze_suite(
        self,
        tests_root: Path,
        file_matcher: Callable[[Path], bool] | None = None,
    ) -> SuiteResult:
        """Analyze all Python test files in a directory."""
        result = SuiteResult(suite_name="backend")
        
        if not tests_root.exists():
            self._log(f"Directory not found: {tests_root}")
            return result
        
        for path in sorted(tests_root.rglob(self.config.py_test_file_glob)):
            if file_matcher and not file_matcher(path):
                continue
            file_result = self._analyze_file(path, tests_root)
            result.files.append(file_result)
        
        return result
    
    def _analyze_file(self, path: Path, tests_root: Path) -> FileResult:
        """Analyze a single Python test file."""
        rel_path = self._rel(path)
        self._log(f"Analyzing: {rel_path}")
        
        # Determine area and location validity
        relative = path.relative_to(tests_root)
        area = relative.parts[0] if len(relative.parts) > 1 else ""
        location_ok = area in self.config.py_allowed_folders
        
        file_result = FileResult(file=rel_path, area=area, location_ok=location_ok)
        
        # Check location
        if not location_ok:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Test file in wrong location (area='{area}')",
                severity=Severity.ERROR,
                category=IssueCategory.MISPLACED_FILE,
                suggestion=f"Move to one of: {sorted(self.config.py_allowed_folders)}",
            ))
        
        # Check file name
        if self.patterns.file_banned.search(path.name):
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Forbidden token in file name: {path.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                identifier=path.name,
            ))
        
        # Parse file
        try:
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as e:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Syntax error: {e.msg}",
                severity=Severity.ERROR,
                category=IssueCategory.PARSE_ERROR,
                line=e.lineno,
            ))
            return file_result
        except Exception as e:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Parse error: {e}",
                severity=Severity.ERROR,
                category=IssueCategory.PARSE_ERROR,
            ))
            return file_result
        
        # Track names for duplicate detection
        module_names: dict[str, list[int]] = {}
        
        # Analyze module-level functions
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                module_names.setdefault(node.name, []).append(node.lineno)
                test_info = self._analyze_test_function(node, rel_path, file_result, source=source)
                file_result.tests.append(test_info)
        
        # Check for module-level duplicates
        for name, lines in module_names.items():
            if len(lines) > 1:
                file_result.issues.append(Issue(
                    file=rel_path,
                    message=f"Duplicate test function: {name}",
                    severity=Severity.ERROR,
                    category=IssueCategory.DUPLICATE_NAME,
                    line=lines[0],
                    identifier=name,
                    suggestion=f"Appears on lines {lines}. Rename or merge.",
                ))
        
        # Analyze classes
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                self._analyze_test_class(node, rel_path, file_result, source)
        
        return file_result
    
    def _analyze_test_function(
        self, 
        node: ast.FunctionDef, 
        file: str, 
        result: FileResult,
        class_name: str | None = None,
        source: str | None = None,
    ) -> TestInfo:
        """Analyze a single test function for quality issues."""
        full_name = f"{class_name}.{node.name}" if class_name else node.name
        
        # Basic info
        num_lines = ASTAnalyzer.get_function_lines(node)
        num_assertions, assertions = ASTAnalyzer.count_assertions(node)
        
        test_info = TestInfo(
            name=node.name,
            lineno=node.lineno,
            end_lineno=node.end_lineno or node.lineno,
            num_lines=num_lines,
            num_assertions=num_assertions,
            num_patches=ASTAnalyzer.count_patches(node),
            has_docstring=ASTAnalyzer.has_docstring(node),
            has_sleep=ASTAnalyzer.has_sleep_call(node),
            has_print=ASTAnalyzer.has_print_call(node),
            has_silent_except=ASTAnalyzer.has_silent_except(node),
            has_unverified_mock=ASTAnalyzer.has_unverified_mock(node),
            is_empty=ASTAnalyzer.is_empty_body(node),
            assertions=assertions,
        )
        
        # === Quality Checks ===
        
        # 1. Empty test
        if test_info.is_empty:
            result.issues.append(Issue(
                file=file,
                message="Empty test (only pass/... or docstring)",
                severity=Severity.ERROR,
                category=IssueCategory.EMPTY_TEST,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add meaningful test logic or remove.",
            ))
        
        # 2. No assertions
        elif num_assertions == 0:
            result.issues.append(Issue(
                file=file,
                message="Test has no assertions",
                severity=Severity.ERROR,
                category=IssueCategory.NO_ASSERTIONS,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add assert statements to verify behavior.",
            ))
        
        # 3. Useless assertions
        for assertion in assertions:
            if self.patterns.useless_assertion.search(assertion):
                result.issues.append(Issue(
                    file=file,
                    message=f"Useless assertion: {assertion}",
                    severity=Severity.ERROR,
                    category=IssueCategory.USELESS_ASSERTION,
                    line=node.lineno,
                    identifier=full_name,
                    suggestion="Assert specific values or conditions.",
                ))
        
        # 4. Vague assertions
        vague_lines = ASTAnalyzer.get_vague_assertions(node)
        if vague_lines:
            result.issues.append(Issue(
                file=file,
                message="Vague assertion(s) - only checking truthiness",
                severity=Severity.WARNING,
                category=IssueCategory.VAGUE_ASSERTION,
                line=vague_lines[0],
                identifier=full_name,
                suggestion="Assert specific properties (e.g., assert response.status_code == 200).",
            ))
        
        # 5. Poor naming
        if self.patterns.generic_name.match(node.name) or self.patterns.too_short_name.match(node.name):
            result.issues.append(Issue(
                file=file,
                message=f"Generic/poor test name: {node.name}",
                severity=Severity.WARNING,
                category=IssueCategory.POOR_NAMING,
                line=node.lineno,
                identifier=full_name,
                suggestion="Use descriptive name: test_<action>_<condition>_<expected>",
            ))
        
        # 6. Forbidden tokens in name
        if self.patterns.py_func_banned.search(node.name):
            result.issues.append(Issue(
                file=file,
                message=f"Forbidden token in test name: {node.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                line=node.lineno,
                identifier=full_name,
            ))
        
        # 7. Test too long
        if num_lines > self.config.max_test_lines:
            result.issues.append(Issue(
                file=file,
                message=f"Test too long ({num_lines} lines > {self.config.max_test_lines})",
                severity=Severity.WARNING,
                category=IssueCategory.TEST_TOO_LONG,
                line=node.lineno,
                identifier=full_name,
                suggestion="Split into smaller, focused tests.",
            ))
        
        # 8. Test too short (but not empty)
        if num_lines < self.config.min_test_lines and not test_info.is_empty:
            result.issues.append(Issue(
                file=file,
                message=f"Test suspiciously short ({num_lines} lines)",
                severity=Severity.INFO,
                category=IssueCategory.TEST_TOO_SHORT,
                line=node.lineno,
                identifier=full_name,
                suggestion="Ensure test is meaningful and complete.",
            ))
        
        # 9. Too many assertions
        if num_assertions > self.config.max_assertions_per_test:
            result.issues.append(Issue(
                file=file,
                message=f"Too many assertions ({num_assertions} > {self.config.max_assertions_per_test})",
                severity=Severity.WARNING,
                category=IssueCategory.TOO_MANY_ASSERTIONS,
                line=node.lineno,
                identifier=full_name,
                suggestion="Split into multiple focused tests.",
            ))
        
        # 10. Sleep call (flaky test)
        if test_info.has_sleep:
            result.issues.append(Issue(
                file=file,
                message="Test uses sleep() - likely flaky",
                severity=Severity.ERROR,
                category=IssueCategory.SLEEP_CALL,
                line=node.lineno,
                identifier=full_name,
                suggestion="Use mocking or async waiting instead.",
            ))
        
        # 11. Print statement (forgotten debug)
        if test_info.has_print:
            result.issues.append(Issue(
                file=file,
                message="Test contains print() - forgotten debug?",
                severity=Severity.WARNING,
                category=IssueCategory.PRINT_STATEMENT,
                line=node.lineno,
                identifier=full_name,
                suggestion="Remove print statements or use logging.",
            ))
        
        # 12. Silent exception handler
        if test_info.has_silent_except:
            result.issues.append(Issue(
                file=file,
                message="Test has silent try/except - may hide failures",
                severity=Severity.ERROR,
                category=IssueCategory.SILENT_EXCEPTION,
                line=node.lineno,
                identifier=full_name,
                suggestion="Re-raise exceptions or use pytest.raises().",
            ))
        
        # 13. Excessive mocking
        if test_info.num_patches > self.config.max_patches_per_test:
            result.issues.append(Issue(
                file=file,
                message=f"Excessive mocking ({test_info.num_patches} patches)",
                severity=Severity.WARNING,
                category=IssueCategory.EXCESSIVE_MOCKING,
                line=node.lineno,
                identifier=full_name,
                suggestion="Consider integration test or refactor code.",
            ))
        
        # 14. Unverified mock
        if test_info.has_unverified_mock:
            result.issues.append(Issue(
                file=file,
                message="Mock created but never verified",
                severity=Severity.WARNING,
                category=IssueCategory.UNVERIFIED_MOCK,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add mock.assert_called*() verification.",
            ))
        
        # 15. Missing docstring on complex test
        if num_lines >= self.config.min_lines_for_docstring and not test_info.has_docstring:
            result.issues.append(Issue(
                file=file,
                message=f"Complex test ({num_lines} lines) lacks docstring",
                severity=Severity.INFO,
                category=IssueCategory.MISSING_DOCSTRING,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add docstring explaining what is being tested.",
            ))

        # 16. Non-deterministic sources without explicit control
        nondeterministic_signals = ASTAnalyzer.get_nondeterministic_signals(node)
        if nondeterministic_signals and not ASTAnalyzer.has_determinism_control(node):
            detected = ", ".join(sorted(nondeterministic_signals))
            result.issues.append(Issue(
                file=file,
                message=f"Non-deterministic source(s) without explicit control: {detected}",
                severity=Severity.WARNING,
                category=IssueCategory.NONDETERMINISTIC,
                rule_id="nondeterministic",
                line=node.lineno,
                identifier=full_name,
                suggestion="Use freezegun/monkeypatch/random.seed or equivalent deterministic control.",
            ))

        # 17. Direct network/IO dependency
        network_io_signals = ASTAnalyzer.get_network_io_signals(node)
        if network_io_signals:
            detected = ", ".join(sorted(network_io_signals))
            result.issues.append(Issue(
                file=file,
                message=f"Direct network/IO dependency in test: {detected}",
                severity=Severity.WARNING,
                category=IssueCategory.NETWORK_DEPENDENCY,
                rule_id="network_dependency",
                line=node.lineno,
                identifier=full_name,
                suggestion="Isolate external boundaries and assert observable outcomes.",
            ))

        # 18. Mock call-contract-only assertions (contextual signal)
        if ASTAnalyzer.has_mock_call_contract_only(node) and not self._has_allow_call_contract(node, source):
            result.issues.append(Issue(
                file=file,
                message="Mock call-contract assertions without observable-effect assertions",
                severity=Severity.INFO,
                category=IssueCategory.UNVERIFIED_MOCK,
                rule_id="mock_call_contract_only",
                line=node.lineno,
                identifier=full_name,
                suggestion=(
                    "Add assertions on returned state/side effects, or document exception with "
                    "quality: allow-call-contract (reason)."
                ),
            ))

        # 19. Large inline payload
        inline_payload_lines = ASTAnalyzer.get_inline_payload_lines(node)
        if inline_payload_lines:
            result.issues.append(Issue(
                file=file,
                message="Large inline payload detected in test",
                severity=Severity.INFO,
                category=IssueCategory.INLINE_PAYLOAD,
                rule_id="inline_payload",
                line=inline_payload_lines[0],
                identifier=full_name,
                suggestion="Prefer factory/data-builder fixtures for complex payload setup.",
            ))

        # 20. Global-state mutation signal
        global_state_signals = ASTAnalyzer.get_global_state_signals(node)
        if global_state_signals:
            detected = ", ".join(sorted(global_state_signals))
            result.issues.append(Issue(
                file=file,
                message=f"Potential global-state mutation in test: {detected}",
                severity=Severity.INFO,
                category=IssueCategory.GLOBAL_STATE_LEAK,
                rule_id="global_state_mutation",
                line=node.lineno,
                identifier=full_name,
                suggestion="Use scoped fixtures/monkeypatch and ensure cleanup to avoid leaking state.",
            ))
        
        return test_info
    
    def _analyze_test_class(
        self, 
        cls: ast.ClassDef, 
        file: str, 
        result: FileResult,
        source: str,
    ) -> None:
        """Analyze a test class and its methods."""
        # Check class name for forbidden tokens
        if cls.name.startswith("Test") and self.patterns.py_class_banned.search(cls.name):
            result.issues.append(Issue(
                file=file,
                message=f"Forbidden token in class name: {cls.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                line=cls.lineno,
                identifier=cls.name,
            ))
        
        # Track method names for duplicates
        method_names: dict[str, list[int]] = {}
        
        for node in cls.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                method_names.setdefault(node.name, []).append(node.lineno)
                test_info = self._analyze_test_function(node, file, result, cls.name, source)
                result.tests.append(test_info)
        
        # Check for duplicates within class
        for name, lines in method_names.items():
            if len(lines) > 1:
                result.issues.append(Issue(
                    file=file,
                    message=f"Duplicate method in {cls.name}: {name}",
                    severity=Severity.ERROR,
                    category=IssueCategory.DUPLICATE_NAME,
                    line=lines[0],
                    identifier=f"{cls.name}.{name}",
                    suggestion=f"Appears on lines {lines}. Rename or merge.",
                ))
