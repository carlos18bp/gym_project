/**
 * coverage-summary-ci.cjs
 *
 * Reads the three coverage artifact JSON files produced by CI jobs and
 * generates a unified Markdown report (coverage-report.md) suitable for
 * GITHUB_STEP_SUMMARY and sticky PR comments.
 *
 * Expected artifact layout (relative to repo root):
 *   coverage-artifacts/backend/coverage-backend.json      – pytest-cov JSON
 *   coverage-artifacts/frontend-unit/coverage-summary.json – Jest json-summary
 *   coverage-artifacts/frontend-e2e/flow-coverage.json     – flow-coverage-reporter
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ── helpers ──────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/** Return a colored-dot emoji based on percentage. */
function dot(pct) {
  if (pct >= 90) return '🟢';
  if (pct >= 70) return '🟡';
  return '🔴';
}

/** Unicode progress bar (20 chars wide). */
function bar(pct) {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  return '▓'.repeat(filled) + '░'.repeat(width - filled);
}

// ── parse backend (pytest-cov JSON) ──────────────────────────────────

function parseBackend(artifactDir) {
  const data = readJson(path.join(artifactDir, 'coverage-backend.json'));
  if (!data || !data.totals) return null;

  const t = data.totals;
  const stmtsCovered = t.covered_lines ?? 0;
  const stmtsTotal = t.num_statements ?? 0;
  const stmtsPct = stmtsTotal > 0 ? ((stmtsCovered / stmtsTotal) * 100) : 0;

  const brCovered = t.covered_branches ?? 0;
  const brTotal = t.num_branches ?? 0;
  const brPct = brTotal > 0 ? ((brCovered / brTotal) * 100) : 0;

  return {
    stmtsCovered, stmtsTotal, stmtsPct: +stmtsPct.toFixed(1),
    brCovered, brTotal, brPct: +brPct.toFixed(1),
  };
}

// ── parse frontend unit (Jest json-summary) ──────────────────────────

function parseFrontendUnit(artifactDir) {
  const data = readJson(path.join(artifactDir, 'coverage-summary.json'));
  if (!data || !data.total) return null;

  const t = data.total;
  const extract = (key) => ({
    covered: t[key].covered ?? 0,
    total: t[key].total ?? 0,
    pct: +(t[key].pct ?? 0).toFixed(1),
  });

  return {
    statements: extract('statements'),
    branches: extract('branches'),
    functions: extract('functions'),
    lines: extract('lines'),
  };
}

// ── parse frontend E2E (flow-coverage.json) ──────────────────────────

function parseFrontendE2E(artifactDir) {
  const data = readJson(path.join(artifactDir, 'flow-coverage.json'));
  if (!data || !data.summary) return null;

  const s = data.summary;
  const total = s.total ?? 0;
  const covered = s.covered ?? 0;
  const partial = s.partial ?? 0;
  const failing = s.failing ?? 0;
  const missing = s.missing ?? 0;
  const pct = total > 0 ? +((covered / total) * 100).toFixed(1) : 0;

  return { total, covered, partial, failing, missing, pct };
}

// ── build markdown ───────────────────────────────────────────────────

function buildMarkdown(backend, feUnit, feE2E) {
  const lines = [];

  lines.push('## 📊 Coverage Report');
  lines.push('');

  // ── main summary table ──
  lines.push('| Suite | Coverage | Bar | Details |');
  lines.push('|-------|----------|-----|---------|');

  if (backend) {
    const mainPct = backend.stmtsPct;
    lines.push(
      `| Backend (pytest) | ${dot(mainPct)} ${mainPct}% | ${bar(mainPct)} | ${backend.stmtsCovered}/${backend.stmtsTotal} stmts, ${backend.brPct}% branches |`
    );
  } else {
    lines.push('| Backend (pytest) | ⚠️ N/A | | No data |');
  }

  if (feUnit) {
    const mainPct = feUnit.statements.pct;
    lines.push(
      `| Frontend Unit (Jest) | ${dot(mainPct)} ${mainPct}% | ${bar(mainPct)} | ${feUnit.statements.covered}/${feUnit.statements.total} stmts, ${feUnit.branches.pct}% branches, ${feUnit.functions.pct}% funcs |`
    );
  } else {
    lines.push('| Frontend Unit (Jest) | ⚠️ N/A | | No data |');
  }

  if (feE2E) {
    const mainPct = feE2E.pct;
    lines.push(
      `| Frontend E2E (Playwright) | ${dot(mainPct)} ${mainPct}% | ${bar(mainPct)} | ${feE2E.covered}/${feE2E.total} flows covered, ${feE2E.failing} failing, ${feE2E.missing} missing |`
    );
  } else {
    lines.push('| Frontend E2E (Playwright) | ⚠️ N/A | | No data |');
  }

  lines.push('');

  // ── Backend Details ──
  if (backend) {
    lines.push('<details>');
    lines.push('<summary>Backend Details</summary>');
    lines.push('');
    lines.push('| Metric | Covered | Total | % |');
    lines.push('|--------|---------|-------|---|');
    lines.push(`| Statements | ${backend.stmtsCovered} | ${backend.stmtsTotal} | ${backend.stmtsPct}% |`);
    lines.push(`| Branches | ${backend.brCovered} | ${backend.brTotal} | ${backend.brPct}% |`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // ── Frontend Unit Details ──
  if (feUnit) {
    lines.push('<details>');
    lines.push('<summary>Frontend Unit Details</summary>');
    lines.push('');
    lines.push('| Metric | Covered | Total | % |');
    lines.push('|--------|---------|-------|---|');
    lines.push(`| Statements | ${feUnit.statements.covered} | ${feUnit.statements.total} | ${feUnit.statements.pct}% |`);
    lines.push(`| Branches | ${feUnit.branches.covered} | ${feUnit.branches.total} | ${feUnit.branches.pct}% |`);
    lines.push(`| Functions | ${feUnit.functions.covered} | ${feUnit.functions.total} | ${feUnit.functions.pct}% |`);
    lines.push(`| Lines | ${feUnit.lines.covered} | ${feUnit.lines.total} | ${feUnit.lines.pct}% |`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // ── Frontend E2E Flow Details ──
  if (feE2E) {
    lines.push('<details>');
    lines.push('<summary>Frontend E2E Flow Details</summary>');
    lines.push('');
    lines.push('| Status | Count |');
    lines.push('|--------|-------|');
    lines.push(`| ✅ Covered | ${feE2E.covered} |`);
    lines.push(`| ⚠️ Partial | ${feE2E.partial} |`);
    lines.push(`| ❌ Failing | ${feE2E.failing} |`);
    lines.push(`| ⬜ Missing | ${feE2E.missing} |`);
    lines.push(`| **Total** | **${feE2E.total}** |`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by CI — Coverage Summary*');
  lines.push('');

  return lines.join('\n');
}

// ── main ─────────────────────────────────────────────────────────────

function main() {
  const base = path.resolve('coverage-artifacts');

  const backend = parseBackend(path.join(base, 'backend'));
  const feUnit = parseFrontendUnit(path.join(base, 'frontend-unit'));
  const feE2E = parseFrontendE2E(path.join(base, 'frontend-e2e'));

  const md = buildMarkdown(backend, feUnit, feE2E);

  fs.writeFileSync('coverage-report.md', md);
  console.log('✅ coverage-report.md generated');

  if (backend) console.log(`   Backend:       ${backend.stmtsPct}% stmts, ${backend.brPct}% branches`);
  if (feUnit) console.log(`   Frontend Unit: ${feUnit.statements.pct}% stmts`);
  if (feE2E) console.log(`   Frontend E2E:  ${feE2E.covered}/${feE2E.total} flows`);
}

main();
