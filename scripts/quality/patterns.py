"""
Compiled regex patterns for test quality analysis.

This module contains all regex patterns used across analyzers
for detecting naming issues, forbidden tokens, and code patterns.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .base import Config


class Patterns:
    """Compiled regex patterns for test analysis."""
    
    def __init__(self, config: "Config") -> None:
        self.config = config
        self._compile()
    
    def _compile(self) -> None:
        """Compile all patterns."""
        # Banned tokens in class names (Python)
        tokens = "|".join(
            f"{t}(?!er)" if t.lower() == "cov" else t
            for t in self.config.banned_tokens
        )
        self.py_class_banned = re.compile(f"({tokens})", re.IGNORECASE)
        
        # Banned tokens in function names (Python)
        func_tokens = "|".join(self.config.banned_tokens)
        self.py_func_banned = re.compile(rf"(?:^|_)({func_tokens})(?:_|$)", re.IGNORECASE)
        
        # Banned tokens in JS titles
        self.js_title_banned = re.compile(rf"\b({func_tokens})\b", re.IGNORECASE)
        
        # Banned tokens in file names
        self.file_banned = re.compile(rf"(^|[-_])({func_tokens})([-_.\d]|$)", re.IGNORECASE)
        
        # JS test calls (regex fallback for simple parsing)
        self.js_call = re.compile(r"\b(?:it|test|describe)\s*\(\s*([`\"'])(.*?)\1", re.DOTALL)
        
        # Generic test name pattern (Python)
        generic = "|".join(re.escape(n) for n in self.config.generic_test_names)
        self.generic_name = re.compile(rf"^({generic})$", re.IGNORECASE)
        
        # Very short names (test_ + 1-2 chars)
        self.too_short_name = re.compile(r"^test_[a-z]{1,2}$", re.IGNORECASE)
        
        # Useless assertion patterns for source matching
        useless = "|".join(re.escape(u) for u in self.config.useless_assertions)
        self.useless_assertion = re.compile(rf"({useless})", re.IGNORECASE)
        
        # Generic JS titles
        generic_js = "|".join(re.escape(t) for t in self.config.generic_js_titles)
        self.generic_js_title = re.compile(rf"^({generic_js})$", re.IGNORECASE)
        
        # Console.log detection
        self.console_log = re.compile(r"\bconsole\.(log|debug|info|warn|error)\s*\(")
        
        # Hardcoded timeout detection (Playwright)
        self.hardcoded_timeout = re.compile(
            r"(?:waitForTimeout|setTimeout)\s*\(\s*(\d+)",
            re.IGNORECASE
        )
        
        # Fragile CSS selectors (overly specific)
        self.fragile_selector = re.compile(
            r"page\.locator\s*\(\s*['\"]"
            r"(?:"
            r"div\s*>\s*div\s*>\s*div|"  # Deep nesting
            r"\.[a-zA-Z_-]+\.[a-zA-Z_-]+\.[a-zA-Z_-]+|"  # Multiple classes
            r"#[a-zA-Z_-]+\s+\.[a-zA-Z_-]+\s+\.[a-zA-Z_-]+|"  # ID + multiple classes
            r"\[data-testid\]\s*>\s*\[data-testid\]"  # Nested test IDs
            r")"
        )
        
        # Sleep/wait patterns (Python)
        self.py_sleep = re.compile(r"\btime\.sleep\s*\(|\bsleep\s*\(")
        
        # Print statements (Python)
        self.py_print = re.compile(r"\bprint\s*\(")
