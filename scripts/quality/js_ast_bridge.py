"""
JavaScript AST Bridge.

Provides Python interface to the Node.js Babel AST parser.
Handles execution of the parser and parsing of JSON results.
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class JSTestInfo:
    """Parsed JavaScript test information."""
    
    name: str
    full_context: str
    line: int
    end_line: int
    num_lines: int
    test_type: str  # 'it' or 'test'
    is_skipped: bool = False
    is_only: bool = False
    has_assertions: bool = False
    assertion_count: int = 0
    has_console_log: bool = False
    has_hardcoded_timeout: bool = False
    timeout_value: int = 0
    is_empty: bool = False
    describe_block: str | None = None
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JSTestInfo":
        return cls(
            name=data.get("name", ""),
            full_context=data.get("fullContext", ""),
            line=data.get("line", 0),
            end_line=data.get("endLine", 0),
            num_lines=data.get("numLines", 0),
            test_type=data.get("type", "test"),
            is_skipped=data.get("isSkipped", False),
            is_only=data.get("isOnly", False),
            has_assertions=data.get("hasAssertions", False),
            assertion_count=data.get("assertionCount", 0),
            has_console_log=data.get("hasConsoleLog", False),
            has_hardcoded_timeout=data.get("hasHardcodedTimeout", False),
            timeout_value=data.get("timeoutValue", 0),
            is_empty=data.get("isEmpty", False),
            describe_block=data.get("describeBlock"),
        )


@dataclass
class JSIssueInfo:
    """Parsed JavaScript quality issue."""
    
    issue_type: str
    message: str
    line: int
    identifier: str | None = None
    suggestion: str | None = None
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JSIssueInfo":
        return cls(
            issue_type=data.get("type", "UNKNOWN"),
            message=data.get("message", ""),
            line=data.get("line", 0),
            identifier=data.get("identifier"),
            suggestion=data.get("suggestion"),
        )


@dataclass
class JSFileResult:
    """Result of parsing a JavaScript test file."""
    
    file_path: str
    tests: list[JSTestInfo] = field(default_factory=list)
    issues: list[JSIssueInfo] = field(default_factory=list)
    error: str | None = None
    test_count: int = 0
    issue_count: int = 0
    has_parse_error: bool = False
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JSFileResult":
        tests = [JSTestInfo.from_dict(t) for t in data.get("tests", [])]
        issues = [JSIssueInfo.from_dict(i) for i in data.get("issues", [])]
        summary = data.get("summary", {})
        
        return cls(
            file_path=data.get("file", ""),
            tests=tests,
            issues=issues,
            error=data.get("error"),
            test_count=summary.get("testCount", len(tests)),
            issue_count=summary.get("issueCount", len(issues)),
            has_parse_error=summary.get("hasParseError", False),
        )


class JSASTBridge:
    """
    Bridge to Node.js Babel AST parser.
    
    Executes the ast-parser.cjs script and parses JSON results.
    """
    
    def __init__(self, repo_root: Path, verbose: bool = False):
        self.repo_root = repo_root
        self.verbose = verbose
        self.parser_script = repo_root / "frontend" / "scripts" / "ast-parser.cjs"
        self._node_available: bool | None = None
        self._parser_available: bool | None = None
    
    def _check_node(self) -> bool:
        """Check if Node.js is available."""
        if self._node_available is not None:
            return self._node_available
        
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            self._node_available = result.returncode == 0
        except (subprocess.SubprocessError, FileNotFoundError):
            self._node_available = False
        
        return self._node_available
    
    def _check_parser(self) -> bool:
        """Check if the parser script exists and dependencies are installed."""
        if self._parser_available is not None:
            return self._parser_available
        
        if not self.parser_script.exists():
            self._parser_available = False
            return False
        
        # Check if @babel/parser is installed
        node_modules = self.repo_root / "frontend" / "node_modules" / "@babel" / "parser"
        self._parser_available = node_modules.exists()
        
        return self._parser_available
    
    def is_available(self) -> bool:
        """Check if the bridge is usable."""
        return self._check_node() and self._check_parser()
    
    def parse_file(self, file_path: Path, is_e2e: bool = False) -> JSFileResult:
        """
        Parse a JavaScript test file using the Babel AST parser.
        
        Args:
            file_path: Path to the test file.
            is_e2e: Whether this is an E2E test file (affects some checks).
            
        Returns:
            JSFileResult with parsed test information and issues.
        """
        if not self.is_available():
            return JSFileResult(
                file_path=str(file_path),
                error="AST parser not available (check Node.js and npm dependencies)",
            )
        
        try:
            cmd = ["node", str(self.parser_script), str(file_path)]
            if is_e2e:
                cmd.append("--e2e")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(self.repo_root / "frontend"),
            )
            
            if result.returncode != 0:
                # Try to parse error from stderr or stdout
                error_msg = result.stderr.strip() or result.stdout.strip()
                try:
                    error_data = json.loads(error_msg)
                    return JSFileResult(
                        file_path=str(file_path),
                        error=error_data.get("error", error_msg),
                    )
                except json.JSONDecodeError:
                    return JSFileResult(
                        file_path=str(file_path),
                        error=f"Parser failed: {error_msg[:200]}",
                    )
            
            # Parse JSON output
            try:
                data = json.loads(result.stdout)
                return JSFileResult.from_dict(data)
            except json.JSONDecodeError as e:
                return JSFileResult(
                    file_path=str(file_path),
                    error=f"Invalid JSON from parser: {e}",
                )
                
        except subprocess.TimeoutExpired:
            return JSFileResult(
                file_path=str(file_path),
                error="Parser timeout (30s)",
            )
        except Exception as e:
            return JSFileResult(
                file_path=str(file_path),
                error=f"Unexpected error: {e}",
            )
    
    def parse_files(
        self, 
        file_paths: list[Path], 
        is_e2e: bool = False,
    ) -> list[JSFileResult]:
        """Parse multiple files."""
        results = []
        for path in file_paths:
            if self.verbose:
                print(f"  Parsing: {path.name}")
            results.append(self.parse_file(path, is_e2e))
        return results
