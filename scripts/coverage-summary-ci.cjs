/**
 * coverage-summary-ci.cjs
 *
 * Reads coverage and test-result artifact JSON/XML files produced by CI
 * jobs and generates a unified Markdown report (coverage-report.md)
 * suitable for GITHUB_STEP_SUMMARY and sticky PR comments.
 *
 * Expected artifact layout (relative to repo root):
 *   coverage-artifacts/backend/coverage-backend.json              – pytest-cov JSON
 *   coverage-artifacts/backend-results/test-results/results.xml   – JUnit XML
 *   coverage-artifacts/frontend-unit/coverage-summary.json        – Jest json-summary
 *   coverage-artifacts/frontend-unit-results/jest-results.json    – Jest JSON output
 *   coverage-artifacts/frontend-e2e/flow-coverage.json            – flow-coverage-reporter
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ── helpers ──────────────────────────────────────────────────────────

const MAX_TOP_FILES = 10;
const MAX_FAILURES = 10;
const MAX_MSG_LEN = 120;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function dot(pct) {
  if (pct >= 90) return '🟢';
  if (pct >= 70) return '🟡';
  return '🔴';
}

function bar(pct) {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  return '▓'.repeat(filled) + '░'.repeat(width - filled);
}

function shortPath(fullPath) {
  const parts = fullPath.replace(/\\/g, '/').split('/');
  return parts.slice(-2).join('/');
}

function truncate(str, len) {
  if (!str) return '';
  const clean = str.replace(/[\r\n]+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

// ══════════════════════════════════════════════════════════════════════
// BACKEND PARSERS
// ══════════════════════════════════════════════════════════════════════

function parseBackend(artifactDir) {
  const data = readJson(path.join(artifactDir, 'coverage-backend.json'));
  if (!data || !data.totals) return null;

  const t = data.totals;
  const stmtsCovered = t.covered_lines ?? 0;
  const stmtsTotal  = t.num_statements ?? 0;
  const stmtsPct    = stmtsTotal > 0 ? ((stmtsCovered / stmtsTotal) * 100) : 0;
  const brCovered   = t.covered_branches ?? 0;
  const brTotal     = t.num_branches ?? 0;
  const brPct       = brTotal > 0 ? ((brCovered / brTotal) * 100) : 0;

  // Per-file top 10 lowest coverage
  const lowestFiles = [];
  if (data.files) {
    for (const [filePath, info] of Object.entries(data.files)) {
      const s = info.summary ?? info;
      const pct = s.percent_covered ?? 0;
      const missing = s.missing_lines ?? s.num_statements - s.covered_lines ?? 0;
      lowestFiles.push({ file: filePath, pct: +pct.toFixed(1), missing });
    }
    lowestFiles.sort((a, b) => a.pct - b.pct);
  }

  return {
    stmtsCovered, stmtsTotal, stmtsPct: +stmtsPct.toFixed(1),
    brCovered, brTotal, brPct: +brPct.toFixed(1),
    lowestFiles: lowestFiles.slice(0, MAX_TOP_FILES),
  };
}

function parseBackendFailures(resultsDir) {
  // JUnit XML: <testcase classname="..." name="..."><failure message="...">...</failure></testcase>
  const xmlPath = path.join(resultsDir, 'test-results', 'results.xml');
  const xml = readText(xmlPath);
  if (!xml) return [];

  const failures = [];
  const re = /<testcase[^>]*classname="([^"]*?)"[^>]*name="([^"]*?)"[^>]*>\s*<failure\s[^>]*?message="([^"]*?)"[^>]*>/gs;
  let m;
  while ((m = re.exec(xml)) !== null && failures.length < MAX_FAILURES) {
    failures.push({
      className: m[1],
      testName: m[2],
      message: truncate(m[3] || '', MAX_MSG_LEN),
    });
  }
  return failures;
}

// ══════════════════════════════════════════════════════════════════════
// FRONTEND UNIT PARSERS
// ══════════════════════════════════════════════════════════════════════

function parseFrontendUnit(artifactDir) {
  const data = readJson(path.join(artifactDir, 'coverage-summary.json'));
  if (!data || !data.total) return null;

  const t = data.total;
  const extract = (key) => ({
    covered: t[key].covered ?? 0,
    total: t[key].total ?? 0,
    pct: +(t[key].pct ?? 0).toFixed(1),
  });

  // Per-file top 10 lowest coverage (by statements)
  const lowestFiles = [];
  for (const [filePath, metrics] of Object.entries(data)) {
    if (filePath === 'total') continue;
    const pct = metrics.statements?.pct ?? 100;
    lowestFiles.push({ file: filePath, pct: +pct.toFixed(1) });
  }
  lowestFiles.sort((a, b) => a.pct - b.pct);

  return {
    statements: extract('statements'),
    branches: extract('branches'),
    functions: extract('functions'),
    lines: extract('lines'),
    lowestFiles: lowestFiles.slice(0, MAX_TOP_FILES),
  };
}

function parseFrontendUnitFailures(resultsDir) {
  const data = readJson(path.join(resultsDir, 'jest-results.json'));
  if (!data || !data.testResults) return [];

  const failures = [];
  for (const suite of data.testResults) {
    if (suite.status === 'passed') continue;
    for (const test of (suite.assertionResults ?? [])) {
      if (test.status !== 'failed') continue;
      if (failures.length >= MAX_FAILURES) break;
      failures.push({
        testName: test.ancestorTitles
          ? [...test.ancestorTitles, test.title].join(' > ')
          : test.fullName || test.title,
        message: truncate(
          (test.failureMessages ?? []).join(' '),
          MAX_MSG_LEN,
        ),
      });
    }
    if (failures.length >= MAX_FAILURES) break;
  }
  return failures;
}

// ══════════════════════════════════════════════════════════════════════
// FRONTEND E2E PARSER
// ══════════════════════════════════════════════════════════════════════

function parseFrontendE2E(artifactDir) {
  const data = readJson(path.join(artifactDir, 'flow-coverage.json'));
  if (!data || !data.summary) return null;

  const s = data.summary;
  const total   = s.total ?? 0;
  const covered = s.covered ?? 0;
  const partial = s.partial ?? 0;
  const failing = s.failing ?? 0;
  const missing = s.missing ?? 0;
  const pct = total > 0 ? +((covered / total) * 100).toFixed(1) : 0;

  // Detailed per-flow lists
  const failingFlows = [];
  const missingFlows = [];
  const partialFlows = [];

  if (data.flows) {
    for (const [flowId, flow] of Object.entries(data.flows)) {
      const def = flow.definition ?? {};
      const tests = flow.tests ?? {};
      switch (flow.status) {
        case 'failing':
          failingFlows.push({
            flowId,
            name: def.name ?? flowId,
            failed: tests.failed ?? 0,
            total: tests.total ?? 0,
          });
          break;
        case 'missing':
          missingFlows.push({
            flowId,
            name: def.name ?? flowId,
            priority: def.priority ?? 'P4',
          });
          break;
        case 'partial':
          partialFlows.push({
            flowId,
            name: def.name ?? flowId,
            passed: tests.passed ?? 0,
            total: tests.total ?? 0,
          });
          break;
      }
    }
  }

  // Sort missing by priority (P1 first)
  missingFlows.sort((a, b) => a.priority.localeCompare(b.priority));

  return {
    total, covered, partial, failing, missing, pct,
    failingFlows, missingFlows, partialFlows,
  };
}

// ══════════════════════════════════════════════════════════════════════
// BUILD MARKDOWN
// ══════════════════════════════════════════════════════════════════════

function buildMarkdown(backend, backendFailures, feUnit, feUnitFailures, feE2E) {
  const L = [];

  L.push('## 📊 Coverage Report');
  L.push('');

  // ── Main summary table ──
  L.push('| Suite | Coverage | Bar | Details |');
  L.push('|-------|----------|-----|---------|');

  if (backend) {
    const p = backend.stmtsPct;
    L.push(`| Backend (pytest) | ${dot(p)} ${p}% | ${bar(p)} | ${backend.stmtsCovered}/${backend.stmtsTotal} stmts, ${backend.brPct}% branches |`);
  } else {
    L.push('| Backend (pytest) | ⚠️ N/A | | No data |');
  }

  if (feUnit) {
    const p = feUnit.statements.pct;
    L.push(`| Frontend Unit (Jest) | ${dot(p)} ${p}% | ${bar(p)} | ${feUnit.statements.covered}/${feUnit.statements.total} stmts, ${feUnit.branches.pct}% branches, ${feUnit.functions.pct}% funcs |`);
  } else {
    L.push('| Frontend Unit (Jest) | ⚠️ N/A | | No data |');
  }

  if (feE2E) {
    const p = feE2E.pct;
    L.push(`| Frontend E2E (Playwright) | ${dot(p)} ${p}% | ${bar(p)} | ${feE2E.covered}/${feE2E.total} flows covered, ${feE2E.failing} failing, ${feE2E.missing} missing |`);
  } else {
    L.push('| Frontend E2E (Playwright) | ⚠️ N/A | | No data |');
  }

  L.push('');

  // ────────────────────────────────────────────────────────────────────
  // Backend Details
  // ────────────────────────────────────────────────────────────────────
  if (backend) {
    L.push('<details>');
    L.push('<summary>Backend Details</summary>');
    L.push('');
    L.push('| Metric | Covered | Total | % |');
    L.push('|--------|---------|-------|---|');
    L.push(`| Statements | ${backend.stmtsCovered} | ${backend.stmtsTotal} | ${backend.stmtsPct}% |`);
    L.push(`| Branches | ${backend.brCovered} | ${backend.brTotal} | ${backend.brPct}% |`);
    L.push('| Functions | — | — | *not tracked by pytest-cov* |');
    L.push(`| Lines | ${backend.stmtsCovered} | ${backend.stmtsTotal} | ${backend.stmtsPct}% |`);
    L.push('');

    if (backend.lowestFiles.length > 0) {
      L.push('#### 🔻 Top 10 — Lowest Coverage Files');
      L.push('');
      L.push('| File | Coverage | Missing lines |');
      L.push('|------|----------|---------------|');
      for (const f of backend.lowestFiles) {
        L.push(`| \`${shortPath(f.file)}\` | ${dot(f.pct)} ${f.pct}% | ${f.missing} |`);
      }
      L.push('');
    }

    if (backendFailures.length > 0) {
      L.push('#### ❌ Failed Tests');
      L.push('');
      L.push('| Test | Message |');
      L.push('|------|---------|');
      for (const f of backendFailures) {
        L.push(`| \`${f.className}::${f.testName}\` | ${f.message} |`);
      }
      L.push('');
    }

    L.push('</details>');
    L.push('');
  }

  // ────────────────────────────────────────────────────────────────────
  // Frontend Unit Details
  // ────────────────────────────────────────────────────────────────────
  if (feUnit) {
    L.push('<details>');
    L.push('<summary>Frontend Unit Details</summary>');
    L.push('');
    L.push('| Metric | Covered | Total | % |');
    L.push('|--------|---------|-------|---|');
    L.push(`| Statements | ${feUnit.statements.covered} | ${feUnit.statements.total} | ${feUnit.statements.pct}% |`);
    L.push(`| Branches | ${feUnit.branches.covered} | ${feUnit.branches.total} | ${feUnit.branches.pct}% |`);
    L.push(`| Functions | ${feUnit.functions.covered} | ${feUnit.functions.total} | ${feUnit.functions.pct}% |`);
    L.push(`| Lines | ${feUnit.lines.covered} | ${feUnit.lines.total} | ${feUnit.lines.pct}% |`);
    L.push('');

    if (feUnit.lowestFiles.length > 0) {
      L.push('#### 🔻 Top 10 — Lowest Coverage Files');
      L.push('');
      L.push('| File | Statements % |');
      L.push('|------|--------------|');
      for (const f of feUnit.lowestFiles) {
        L.push(`| \`${shortPath(f.file)}\` | ${dot(f.pct)} ${f.pct}% |`);
      }
      L.push('');
    }

    if (feUnitFailures.length > 0) {
      L.push('#### ❌ Failed Tests');
      L.push('');
      L.push('| Test | Message |');
      L.push('|------|---------|');
      for (const f of feUnitFailures) {
        L.push(`| \`${truncate(f.testName, 80)}\` | ${f.message} |`);
      }
      L.push('');
    }

    L.push('</details>');
    L.push('');
  }

  // ────────────────────────────────────────────────────────────────────
  // Frontend E2E Flow Details
  // ────────────────────────────────────────────────────────────────────
  if (feE2E) {
    L.push('<details>');
    L.push('<summary>Frontend E2E Flow Details</summary>');
    L.push('');
    L.push('| Status | Count |');
    L.push('|--------|-------|');
    L.push(`| ✅ Covered | ${feE2E.covered} |`);
    L.push(`| ⚠️ Partial | ${feE2E.partial} |`);
    L.push(`| ❌ Failing | ${feE2E.failing} |`);
    L.push(`| ⬜ Missing | ${feE2E.missing} |`);
    L.push(`| **Total** | **${feE2E.total}** |`);
    L.push('');

    if (feE2E.failingFlows.length > 0) {
      L.push('#### ❌ Failing Flows');
      L.push('');
      L.push('| Flow | Name | Failed / Total |');
      L.push('|------|------|----------------|');
      for (const f of feE2E.failingFlows) {
        L.push(`| \`${f.flowId}\` | ${f.name} | ${f.failed}/${f.total} |`);
      }
      L.push('');
    }

    if (feE2E.missingFlows.length > 0) {
      L.push('#### ⬜ Missing Flows by Priority');
      L.push('');
      L.push('| Priority | Flow | Name |');
      L.push('|----------|------|------|');
      for (const f of feE2E.missingFlows) {
        const icon = f.priority === 'P1' ? '🔴' : f.priority === 'P2' ? '🟠' : f.priority === 'P3' ? '🟡' : '⚪';
        L.push(`| ${icon} ${f.priority} | \`${f.flowId}\` | ${f.name} |`);
      }
      L.push('');
    }

    if (feE2E.partialFlows.length > 0) {
      L.push('#### ⚠️ Partial Flows');
      L.push('');
      L.push('| Flow | Name | Passed / Total |');
      L.push('|------|------|----------------|');
      for (const f of feE2E.partialFlows) {
        L.push(`| \`${f.flowId}\` | ${f.name} | ${f.passed}/${f.total} |`);
      }
      L.push('');
    }

    L.push('</details>');
    L.push('');
  }

  L.push('---');
  L.push('*Generated by CI — Coverage Summary*');
  L.push('');

  return L.join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════

function main() {
  const base = path.resolve('coverage-artifacts');

  const backend         = parseBackend(path.join(base, 'backend'));
  const backendFailures = parseBackendFailures(path.join(base, 'backend-results'));
  const feUnit          = parseFrontendUnit(path.join(base, 'frontend-unit'));
  const feUnitFailures  = parseFrontendUnitFailures(path.join(base, 'frontend-unit-results'));
  const feE2E           = parseFrontendE2E(path.join(base, 'frontend-e2e'));

  const md = buildMarkdown(backend, backendFailures, feUnit, feUnitFailures, feE2E);

  fs.writeFileSync('coverage-report.md', md);
  console.log('✅ coverage-report.md generated');

  if (backend) console.log(`   Backend:       ${backend.stmtsPct}% stmts, ${backend.brPct}% branches`);
  if (backendFailures.length) console.log(`   Backend:       ${backendFailures.length} test failure(s)`);
  if (feUnit) console.log(`   Frontend Unit: ${feUnit.statements.pct}% stmts`);
  if (feUnitFailures.length) console.log(`   Frontend Unit: ${feUnitFailures.length} test failure(s)`);
  if (feE2E) console.log(`   Frontend E2E:  ${feE2E.covered}/${feE2E.total} flows`);
}

main();
