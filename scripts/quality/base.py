"""
Base classes and data structures for test quality analysis.

This module contains shared types used across all analyzers:
- Severity levels and issue categories
- Configuration dataclass
- Issue, TestInfo, FileResult, SuiteResult data classes
- Terminal color utilities
"""

from __future__ import annotations

import sys
from collections import Counter
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any


class Severity(Enum):
    """Severity levels for quality issues."""
    
    ERROR = "error"      # Must fix - blocks commit
    WARNING = "warning"  # Should fix - may block in strict mode  
    INFO = "info"        # Consider fixing - never blocks
    
    def __lt__(self, other: "Severity") -> bool:
        order = {Severity.INFO: 0, Severity.WARNING: 1, Severity.ERROR: 2}
        return order[self] < order[other]


class IssueCategory(Enum):
    """Categories of quality issues for reporting."""
    
    EMPTY_TEST = auto()
    NO_ASSERTIONS = auto()
    USELESS_ASSERTION = auto()
    VAGUE_ASSERTION = auto()
    POOR_NAMING = auto()
    TEST_TOO_LONG = auto()
    TEST_TOO_SHORT = auto()
    TOO_MANY_ASSERTIONS = auto()
    SLEEP_CALL = auto()
    PRINT_STATEMENT = auto()
    SILENT_EXCEPTION = auto()
    EXCESSIVE_MOCKING = auto()
    UNVERIFIED_MOCK = auto()
    MISSING_DOCSTRING = auto()
    DUPLICATE_NAME = auto()
    FORBIDDEN_TOKEN = auto()
    MISPLACED_FILE = auto()
    PARSE_ERROR = auto()
    CONSOLE_LOG = auto()
    HARDCODED_TIMEOUT = auto()
    FRAGILE_LOCATOR = auto()
    MISSING_DESCRIBE = auto()
    IMPLEMENTATION_COUPLING = auto()
    MULTI_RENDER = auto()
    NETWORK_DEPENDENCY = auto()
    NONDETERMINISTIC = auto()
    INLINE_PAYLOAD = auto()
    GLOBAL_STATE_LEAK = auto()
    SNAPSHOT_OVERRELIANCE = auto()
    SERIAL_DEPENDENCY = auto()
    EXCESSIVE_STEPS = auto()
    FRAGILE_TEST_DATA = auto()
    DATA_ISOLATION = auto()
    EXTERNAL_LINT = auto()
    LINTER_MISCONFIGURED = auto()
    TOOL_UNAVAILABLE = auto()
    PERFORMANCE_BUDGET = auto()
    # Junk-test categories (2026-07-23). Everything above checks the form of a
    # test; these ask whether it exercises the behavior it claims to cover.
    NO_USER_INTERACTION = auto()
    FLOW_TAG_MISMATCH = auto()
    DEEP_LINK_ENTRY = auto()
    NO_DATA_ASSERTION = auto()
    WEAK_ASSERTION = auto()
    DUPLICATE_COVERAGE = auto()
    TAUTOLOGICAL_SELECTOR = auto()


# Centralized semantic rule identifiers used for rollout gating and reporting.
SEMANTIC_RULE_IDS: frozenset[str] = frozenset(
    {
        # Backend semantics
        "nondeterministic",
        "network_dependency",
        "mock_call_contract_only",
        "inline_payload",
        "global_state_mutation",
        # Frontend unit semantics
        "implementation_coupling",
        "fragile_locator",
        "multi_render",
        "global_state_leak",
        "snapshot_overreliance",
        # Frontend E2E semantics
        "serial_dependency",
        "wait_for_timeout",
        "excessive_steps",
        "fragile_test_data",
        "data_isolation",
        "vague_assertion",
        # Junk-test rules: they judge meaning, not syntax, so they belong to the
        # semantic set and honour --semantic-rules off/soft/strict.
        "no_user_interaction",
        "flow_tag_mismatch",
        "deep_link_entry",
        "no_data_assertion",
        "weak_assertion",
        "duplicate_coverage",
        "tautological_selector",
    }
)


# Junk rules start as warnings so a fleet-wide calibration pass can measure the
# false-positive rate per rule before any of them can block a merge. Promotion
# to ERROR is a deliberate, separate change - not a side effect of rollout.
JUNK_RULE_CATEGORIES: dict[str, str] = {
    "no_user_interaction": "NO_USER_INTERACTION",
    "flow_tag_mismatch": "FLOW_TAG_MISMATCH",
    "deep_link_entry": "DEEP_LINK_ENTRY",
    "no_data_assertion": "NO_DATA_ASSERTION",
    "weak_assertion": "WEAK_ASSERTION",
    "duplicate_coverage": "DUPLICATE_COVERAGE",
    "tautological_selector": "TAUTOLOGICAL_SELECTOR",
}


class Colors:
    """ANSI color codes for terminal output."""
    
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"
    
    _enabled = True
    
    @classmethod
    def disable(cls) -> None:
        """Disable all colors."""
        cls._enabled = False
        for attr in ['RED', 'GREEN', 'YELLOW', 'BLUE', 'MAGENTA', 'CYAN', 'BOLD', 'DIM', 'RESET']:
            setattr(cls, attr, '')
    
    @classmethod
    def enable(cls) -> None:
        """Re-enable colors."""
        if not cls._enabled:
            cls._enabled = True
            cls.RED = "\033[91m"
            cls.GREEN = "\033[92m"
            cls.YELLOW = "\033[93m"
            cls.BLUE = "\033[94m"
            cls.MAGENTA = "\033[95m"
            cls.CYAN = "\033[96m"
            cls.BOLD = "\033[1m"
            cls.DIM = "\033[2m"
            cls.RESET = "\033[0m"
    
    @classmethod
    def severity(cls, sev: Severity) -> str:
        """Get color for severity level."""
        return {
            Severity.ERROR: cls.RED,
            Severity.WARNING: cls.YELLOW,
            Severity.INFO: cls.CYAN,
        }[sev]


@dataclass(frozen=True)
class Config:
    """
    Configuration for test quality scanning.
    
    Thresholds and patterns can be customized per project.
    """
    
    # File discovery
    backend_app_name: str = "content"
    py_allowed_folders: frozenset[str] = frozenset(
        {
            "commands",
            "management",
            "models",
            "permissions",
            "serializers",
            "services",
            "tasks",
            "utils",
            "views",
        }
    )
    py_test_file_glob: str = "test_*.py"
    js_unit_suffixes: tuple[str, ...] = (".test.js", ".spec.js", ".test.ts", ".spec.ts")
    js_e2e_suffixes: tuple[str, ...] = (".spec.js", ".spec.ts")
    
    # Frontend paths
    frontend_unit_dir: str = "test"
    frontend_e2e_dir: str = "e2e"
    frontend_unit_allowed_folders: frozenset[str] = frozenset({
        "stores", "composables", "router", "shared", "views", "components", "utils"
    })
    frontend_e2e_allowed_folders: frozenset[str] = frozenset({
        "auth", "checkout", "dashboard", "directory", "documents", 
        "electronic-signature", "error-handling", "helpers", "intranet",
        "legal-requests", "misc", "organizations", "policies", "process",
        "profile", "router-guards", "schedule", "subscriptions", "user-guide", "viewport"
    })
    
    # Naming
    banned_tokens: tuple[str, ...] = ("batch", "coverage", "cov", "deep")
    generic_test_names: tuple[str, ...] = (
        "test_1", "test_2", "test_3", "test_it", "test_this", "test_that",
        "test_something", "test_stuff", "test_thing", "test_test", "test_foo",
        "test_bar", "test_baz", "test_example", "test_sample", "test_demo",
        "test_temp", "test_tmp", "test_x", "test_y", "test_z", "test_a", "test_b",
    )
    generic_js_titles: tuple[str, ...] = (
        "it works", "should work", "test", "works", "does something",
        "handles it", "is correct", "passes", "runs",
    )
    
    # Quality thresholds
    max_test_lines: int = 50
    min_test_lines: int = 3
    max_assertions_per_test: int = 7
    max_patches_per_test: int = 5
    min_lines_for_docstring: int = 15
    max_timeout_ms: int = 100  # For waitForTimeout checks
    
    # Patterns to detect
    useless_assertions: tuple[str, ...] = (
        "assert True", "assert 1", "assert not False", "assert not 0",
        "self.assertTrue(True)", "self.assertFalse(False)",
        "expect(true).toBe(true)", "expect(1).toBe(1)",
        "expect(true).toBeTruthy()", "expect(false).toBeFalsy()",
    )


DEFAULT_CONFIG = Config()


# ---------------------------------------------------------------------------
# Per-project configuration (.testquality.yml)
# ---------------------------------------------------------------------------
#
# The quality core is canonical and lives in the ops toolkit; it is propagated
# verbatim to every project. Everything that legitimately differs per project
# (Django app name, test directories, module folders) is declared in a
# `.testquality.yml` at the repo root instead of being forked into the code.
#
# Only a flat subset of YAML is supported on purpose: scalars, inline lists and
# block lists. This keeps the core dependency-free (no PyYAML) so it runs from
# any project venv, matching how the rest of the fleet parses YAML.

CONFIG_FILENAME = ".testquality.yml"

# Fields a project may override, mapped to how the raw value is coerced.
_CONFIG_COERCIONS: dict[str, str] = {
    "backend_app_name": "str",
    "py_test_file_glob": "str",
    "frontend_unit_dir": "str",
    "frontend_e2e_dir": "str",
    "py_allowed_folders": "frozenset",
    "frontend_unit_allowed_folders": "frozenset",
    "frontend_e2e_allowed_folders": "frozenset",
    "js_unit_suffixes": "tuple",
    "js_e2e_suffixes": "tuple",
    "banned_tokens": "tuple",
    "max_test_lines": "int",
    "min_test_lines": "int",
    "max_assertions_per_test": "int",
    "max_patches_per_test": "int",
    "min_lines_for_docstring": "int",
    "max_timeout_ms": "int",
}


def _strip_scalar(raw: str) -> str:
    """Strip inline comments and surrounding quotes from a scalar."""
    value = raw.strip()
    if value and value[0] in "\"'":
        quote = value[0]
        end = value.find(quote, 1)
        if end != -1:
            return value[1:end]
    value = value.split("#", 1)[0].strip()
    return value.strip("\"'")


def _parse_inline_list(raw: str) -> list[str]:
    """Parse `[a, "b", c]` into a list of strings."""
    inner = raw.strip()[1:-1]
    return [_strip_scalar(part) for part in inner.split(",") if _strip_scalar(part)]


def parse_simple_yaml(text: str) -> dict[str, Any]:
    """
    Parse the flat YAML subset used by `.testquality.yml`.

    Supports `key: scalar`, `key: [a, b]` and block lists of `  - item`.
    Nested mappings are intentionally not supported.
    """
    data: dict[str, Any] = {}
    current_key: str | None = None

    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        stripped = line.strip()

        # Block-list item belonging to the previous key.
        if stripped.startswith("- "):
            if current_key is not None:
                item = _strip_scalar(stripped[2:])
                if item:
                    data.setdefault(current_key, []).append(item)
            continue

        if ":" not in stripped:
            continue

        key, _, raw_value = stripped.partition(":")
        key = key.strip()
        raw_value = raw_value.strip()

        if not raw_value:
            # Key introducing a block list; items arrive on following lines.
            data[key] = []
            current_key = key
            continue

        current_key = None
        if raw_value.startswith("[") and raw_value.endswith("]"):
            data[key] = _parse_inline_list(raw_value)
        else:
            data[key] = _strip_scalar(raw_value)

    return data


def load_project_config(repo_root: Path | str, base: Config | None = None) -> Config:
    """
    Build a Config for a project, applying `.testquality.yml` overrides.

    Falls back to the canonical defaults when the file is absent, so a repo that
    has not been onboarded yet still gets analyzed instead of silently skipped.
    Unknown keys are ignored rather than fatal: the core is propagated ahead of
    the per-project files, so a newer key must not break an older checkout.
    """
    from dataclasses import replace

    config = base or DEFAULT_CONFIG
    config_path = Path(repo_root) / CONFIG_FILENAME
    if not config_path.is_file():
        return config

    raw = parse_simple_yaml(config_path.read_text(encoding="utf-8"))
    overrides: dict[str, Any] = {}

    for key, kind in _CONFIG_COERCIONS.items():
        if key not in raw:
            continue
        value = raw[key]
        try:
            if kind == "int":
                overrides[key] = int(str(value).strip())
            elif kind == "str":
                overrides[key] = str(value)
            elif kind == "frozenset":
                overrides[key] = frozenset(value if isinstance(value, list) else [value])
            elif kind == "tuple":
                overrides[key] = tuple(value if isinstance(value, list) else [value])
        except (TypeError, ValueError):
            # A malformed single field must not sink the whole run.
            continue

    return replace(config, **overrides) if overrides else config


@dataclass
class Issue:
    """
    Represents a single quality issue found in a test.
    
    Attributes:
        file: Relative path to the file.
        message: Human-readable description.
        line: Line number (if applicable).
        severity: ERROR, WARNING, or INFO.
        category: Type of issue for grouping.
        identifier: The specific test name/element.
        suggestion: How to fix the issue.
    """
    
    file: str
    message: str
    severity: Severity
    category: IssueCategory
    line: int | None = None
    identifier: str | None = None
    suggestion: str | None = None
    rule_id: str | None = None
    source: str = "internal"
    fingerprint: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "file": self.file,
            "message": self.message,
            "severity": self.severity.value,
            "category": self.category.name.lower(),
        }
        if self.line:
            result["line"] = self.line
        if self.identifier:
            result["identifier"] = self.identifier
        if self.suggestion:
            result["suggestion"] = self.suggestion
        if self.rule_id:
            result["rule_id"] = self.rule_id
        if self.source and self.source != "internal":
            result["source"] = self.source
        if self.fingerprint:
            result["fingerprint"] = self.fingerprint
        return result


@dataclass(frozen=True)
class ExternalLintFinding:
    """Normalized finding produced by external lint tooling (Ruff/ESLint)."""

    source: str  # ruff | eslint
    file: str
    line: int | None
    col: int | None
    external_rule_id: str
    message: str
    severity_raw: str
    normalized_rule_id: str
    fingerprint: str


@dataclass
class TestInfo:
    """
    Information about a single test function/method.
    
    Used for detailed quality analysis.
    """
    
    name: str
    lineno: int
    end_lineno: int
    num_lines: int
    num_assertions: int = 0
    num_patches: int = 0
    has_docstring: bool = False
    has_sleep: bool = False
    has_print: bool = False
    has_console_log: bool = False
    has_silent_except: bool = False
    has_unverified_mock: bool = False
    has_hardcoded_timeout: bool = False
    is_empty: bool = False
    assertions: list[str] = field(default_factory=list)
    # JS-specific
    describe_block: str | None = None
    test_type: str | None = None  # 'it', 'test', 'describe'


@dataclass
class FileResult:
    """Result of analyzing a single test file."""
    
    file: str
    area: str
    location_ok: bool
    tests: list[TestInfo] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    
    @property
    def test_count(self) -> int:
        return len(self.tests)
    
    @property
    def issue_count(self) -> int:
        return len(self.issues)
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.WARNING)


@dataclass 
class SuiteResult:
    """Result of analyzing a test suite."""
    
    suite_name: str
    files: list[FileResult] = field(default_factory=list)
    suite_findings: dict[str, Any] = field(default_factory=dict)
    
    def add_file(self, file_result: FileResult) -> None:
        """Add a file result to the suite."""
        self.files.append(file_result)
    
    @property
    def file_count(self) -> int:
        return len(self.files)
    
    @property
    def test_count(self) -> int:
        return sum(f.test_count for f in self.files)
    
    @property
    def all_issues(self) -> list[Issue]:
        return [i for f in self.files for i in f.issues]
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == Severity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == Severity.WARNING)
    
    @property
    def info_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == Severity.INFO)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "files": self.file_count,
            "tests": self.test_count,
            "errors": self.error_count,
            "warnings": self.warning_count,
            "info": self.info_count,
            "issues": [i.to_dict() for i in self.all_issues],
            "suite_findings": self.suite_findings,
            "file_details": [
                {
                    "file": f.file,
                    "area": f.area,
                    "location_ok": f.location_ok,
                    "tests": f.test_count,
                    "issues": f.issue_count,
                }
                for f in self.files
            ],
        }
