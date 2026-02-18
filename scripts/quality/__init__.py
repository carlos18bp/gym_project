"""
Test Quality Gate - Modular Quality Analysis Package.

This package provides modular analyzers for test quality validation
across backend (Python/pytest) and frontend (Jest/Playwright) test suites.
"""

from .base import (
    Severity,
    IssueCategory,
    Colors,
    Config,
    SEMANTIC_RULE_IDS,
    ExternalLintFinding,
    Issue,
    TestInfo,
    FileResult,
    SuiteResult,
    DEFAULT_CONFIG,
)
from .patterns import Patterns

__all__ = [
    "Severity",
    "IssueCategory", 
    "Colors",
    "Config",
    "SEMANTIC_RULE_IDS",
    "ExternalLintFinding",
    "Issue",
    "TestInfo",
    "FileResult",
    "SuiteResult",
    "DEFAULT_CONFIG",
    "Patterns",
]
