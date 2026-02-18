"""External lint adapters for Ruff and ESLint findings.

This module executes external lint tooling and normalizes their output into a
version-agnostic structure consumed by the quality gate.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .base import ExternalLintFinding


# Curated PT selection for pytest-style checks (avoid enabling full PT set at once).
CURATED_RUFF_PT_RULES: tuple[str, ...] = (
    "PT001",
    "PT002",
    "PT003",
    "PT006",
    "PT007",
    "PT011",
    "PT012",
    "PT015",
    "PT018",
)


# Normalized IDs used for cross-engine dedupe where meaningful.
NORMALIZED_RULE_OVERRIDES: dict[tuple[str, str], str] = {
    ("eslint", "playwright/no-wait-for-timeout"): "wait_for_timeout",
}


@dataclass
class ExternalLintRunResult:
    """Result of running one external lint engine."""

    source: str
    status: str = "ok"  # ok | misconfigured | unavailable
    message: str | None = None
    findings: list[ExternalLintFinding] = field(default_factory=list)


class ExternalLintRunner:
    """Run external lint tools and normalize findings."""

    def __init__(self, repo_root: Path, verbose: bool = False):
        self.repo_root = repo_root
        self.verbose = verbose
        self._file_cache: dict[str, list[str] | None] = {}

    def run(
        self,
        *,
        backend_targets: list[Path],
        frontend_targets: list[Path],
    ) -> list[ExternalLintRunResult]:
        """Run configured external tools and return normalized results."""
        return [
            self.run_ruff(backend_targets),
            self.run_eslint(frontend_targets),
        ]

    def run_ruff(self, targets: list[Path]) -> ExternalLintRunResult:
        """Run Ruff on backend pytest targets and normalize PT findings."""
        if not targets:
            return ExternalLintRunResult(source="ruff")

        if shutil.which("ruff") is None:
            return ExternalLintRunResult(
                source="ruff",
                status="unavailable",
                message="ruff executable not found in PATH",
            )

        command = [
            "ruff",
            "check",
            "--output-format",
            "json",
            "--select",
            ",".join(CURATED_RUFF_PT_RULES),
            *[str(path) for path in targets],
        ]

        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            cwd=str(self.repo_root),
            check=False,
        )

        if process.returncode not in (0, 1):
            details = process.stderr.strip() or process.stdout.strip() or "ruff execution failed"
            return ExternalLintRunResult(
                source="ruff",
                status="misconfigured",
                message=details,
            )

        payload = process.stdout.strip()
        if not payload:
            return ExternalLintRunResult(source="ruff")

        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError as exc:
            return ExternalLintRunResult(
                source="ruff",
                status="misconfigured",
                message=f"Invalid Ruff JSON output: {exc}",
            )

        findings = []
        for entry in parsed:
            code = str(entry.get("code") or "PT000")
            relative_file = self._to_relative(entry.get("filename") or "")
            location = entry.get("location") or {}
            line = self._to_int(location.get("row"))
            col = self._to_int(location.get("column"))
            normalized_rule_id = self._normalize_rule_id("ruff", code)
            fingerprint = self._build_fingerprint(relative_file, line, normalized_rule_id)

            findings.append(
                ExternalLintFinding(
                    source="ruff",
                    file=relative_file,
                    line=line,
                    col=col,
                    external_rule_id=code,
                    message=str(entry.get("message") or "Ruff finding"),
                    severity_raw=str(entry.get("severity") or "error"),
                    normalized_rule_id=normalized_rule_id,
                    fingerprint=fingerprint,
                )
            )

        return ExternalLintRunResult(source="ruff", findings=findings)

    def run_eslint(self, targets: list[Path]) -> ExternalLintRunResult:
        """Run ESLint on frontend targets and normalize plugin findings."""
        if not targets:
            return ExternalLintRunResult(source="eslint")

        eslint_bin = self._eslint_binary()
        if eslint_bin is None:
            return ExternalLintRunResult(
                source="eslint",
                status="unavailable",
                message="eslint executable not found (frontend/node_modules/.bin/eslint or PATH)",
            )

        command = [
            eslint_bin,
            "--format",
            "json",
            "--no-error-on-unmatched-pattern",
            *[str(path) for path in targets],
        ]

        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            cwd=str(self.repo_root / "frontend"),
            check=False,
        )

        if process.returncode not in (0, 1):
            details = process.stderr.strip() or process.stdout.strip() or "eslint execution failed"
            return ExternalLintRunResult(
                source="eslint",
                status="misconfigured",
                message=details,
            )

        payload = process.stdout.strip()
        if not payload:
            return ExternalLintRunResult(source="eslint")

        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError as exc:
            return ExternalLintRunResult(
                source="eslint",
                status="misconfigured",
                message=f"Invalid ESLint JSON output: {exc}",
            )

        findings: list[ExternalLintFinding] = []
        for file_entry in parsed:
            relative_file = self._to_relative(file_entry.get("filePath") or "")
            for message in file_entry.get("messages", []):
                external_rule_id = str(message.get("ruleId") or "eslint/unknown")
                normalized_rule_id = self._normalize_rule_id("eslint", external_rule_id)
                line = self._to_int(message.get("line"))
                col = self._to_int(message.get("column"))
                fingerprint = self._build_fingerprint(relative_file, line, normalized_rule_id)

                findings.append(
                    ExternalLintFinding(
                        source="eslint",
                        file=relative_file,
                        line=line,
                        col=col,
                        external_rule_id=external_rule_id,
                        message=str(message.get("message") or "ESLint finding"),
                        severity_raw=str(message.get("severity") or "1"),
                        normalized_rule_id=normalized_rule_id,
                        fingerprint=fingerprint,
                    )
                )

        return ExternalLintRunResult(source="eslint", findings=findings)

    def _eslint_binary(self) -> str | None:
        local_bin = self.repo_root / "frontend" / "node_modules" / ".bin" / "eslint"
        if local_bin.exists():
            return str(local_bin)

        path_bin = shutil.which("eslint")
        return path_bin

    def _normalize_rule_id(self, source: str, external_rule_id: str) -> str:
        """Return a stable internal rule id for dedupe and reporting."""
        lowered = external_rule_id.strip().lower()
        override = NORMALIZED_RULE_OVERRIDES.get((source, lowered))
        if override:
            return override
        return f"{source}:{lowered}"

    def _to_relative(self, raw_path: str) -> str:
        """Normalize arbitrary file paths to repo-relative POSIX paths."""
        if not raw_path:
            return ""

        candidate = Path(raw_path)
        if candidate.is_absolute():
            resolved = candidate.resolve()
            try:
                return resolved.relative_to(self.repo_root).as_posix()
            except ValueError:
                return resolved.as_posix()

        normalized = candidate.as_posix().lstrip("./")
        tentative = (self.repo_root / normalized).resolve()
        if tentative.exists():
            try:
                return tentative.relative_to(self.repo_root).as_posix()
            except ValueError:
                return tentative.as_posix()

        return normalized

    def _build_fingerprint(self, relative_file: str, line: int | None, normalized_rule_id: str) -> str:
        """Build stable fingerprint using snippet hash with deterministic fallback."""
        snippet_hash = self._snippet_hash(relative_file, line)
        if snippet_hash:
            return f"{relative_file}:{normalized_rule_id}:{snippet_hash}"
        return f"{relative_file}:{line or 0}:{normalized_rule_id}"

    def _snippet_hash(self, relative_file: str, line: int | None) -> str | None:
        """Hash normalized context lines (line-1..line+1) for robust dedupe."""
        if line is None or line < 1 or not relative_file:
            return None

        lines = self._read_cached(relative_file)
        if not lines:
            return None

        start_idx = max(0, line - 2)
        end_idx = min(len(lines), line + 1)
        snippet = lines[start_idx:end_idx]
        if not snippet:
            return None

        normalized = "\n".join(" ".join(item.strip().split()) for item in snippet)
        digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]
        return digest

    def _read_cached(self, relative_file: str) -> list[str] | None:
        """Read and cache file content split by lines."""
        if relative_file in self._file_cache:
            return self._file_cache[relative_file]

        absolute = self.repo_root / relative_file
        try:
            content = absolute.read_text(encoding="utf-8")
        except Exception:
            self._file_cache[relative_file] = None
            return None

        lines = content.splitlines()
        self._file_cache[relative_file] = lines
        return lines

    @staticmethod
    def _to_int(value: object) -> int | None:
        """Best-effort integer conversion for line/column fields."""
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
