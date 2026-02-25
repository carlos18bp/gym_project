# FLOW COVERAGE REPORT STANDARD

> **Version:** 1.0.0  
> **Last updated:** 2026-02-23  
> **Language:** English  
> **Scope:** Project-agnostic guide to implement the Flow Coverage Report system for Playwright E2E tests.

---

## Table of Contents

1. [Overview](#1-overview)
2. [How It Works](#2-how-it-works)
3. [File Structure](#3-file-structure)
4. [Step 1 — Create `flow-definitions.json`](#4-step-1--create-flow-definitionsjson)
5. [Step 2 — Create `flow-coverage-reporter.mjs`](#5-step-2--create-flow-coverage-reportermjs)
6. [Step 3 — Register the Reporter in `playwright.config`](#6-step-3--register-the-reporter-in-playwrightconfig)
7. [Step 4 — Tag Tests with `@flow:`](#7-step-4--tag-tests-with-flow)
8. [Step 5 (Optional) — Create `flow-tags.js` Constants](#8-step-5-optional--create-flow-tagsjs-constants)
9. [Report Sections Explained](#9-report-sections-explained)
10. [Status State Machine](#10-status-state-machine)
11. [JSON Output Reference](#11-json-output-reference)
12. [Maintenance Rules](#12-maintenance-rules)
13. [Checklist for New Projects](#13-checklist-for-new-projects)

---

## 1. Overview

The **Flow Coverage Report** is a custom Playwright reporter that measures E2E test coverage at the **user-flow level** rather than at the code-line level.

### Problems it solves

| Problem | How the report helps |
|---|---|
| "We have tests, but do they cover real user journeys?" | Every defined flow is tracked with a clear status: covered, partial, failing, or missing. |
| "Which critical flows have no tests at all?" | Missing flows are grouped by priority (P1–P3) in the terminal output. P4 is excluded to reduce noise. |
| "A test passed but the flow is only partially covered." | Flows with skipped tests are flagged as partial, with known gaps listed. |
| "We need a machine-readable artifact for CI dashboards." | A `flow-coverage.json` file is written after every run. |

### Key concepts

- **Flow definition** — A JSON entry describing a user journey (e.g., "Login with email/password").
- **Flow tag** — A Playwright test tag (`@flow:<flow-id>`) that links a test to one or more flow definitions.
- **Flow status** — Computed per flow: `covered`, `partial`, `failing`, or `missing`.

---

## 2. How It Works

```
┌─────────────────────┐
│ flow-definitions.json│  ← Source of truth: all known user flows
└─────────┬───────────┘
          │ loaded at reporter construction
          ▼
┌─────────────────────────────┐
│ FlowCoverageReporter (class)│  ← Custom Playwright reporter
│  • onTestEnd(test, result)  │  ← Collects @flow: tags + results
│  • onEnd(result)            │  ← Computes final statuses
│  • printReport()            │  ← Colored terminal output
│  • writeJsonReport()        │  ← Writes JSON artifact
└─────────┬───────────────────┘
          │
          ▼
┌──────────────────────────┐    ┌───────────────────────┐
│ Terminal: FLOW COVERAGE  │    │ e2e-results/           │
│ REPORT (colored output)  │    │   flow-coverage.json   │
└──────────────────────────┘    └───────────────────────┘
```

**Data flow step by step:**

1. The reporter constructor loads `flow-definitions.json` and initializes a `Map<flowId, FlowStats>` with status `missing` for every defined flow.
2. As each test finishes (`onTestEnd`), the reporter extracts `@flow:` tags from the test metadata. If a tag is found, the corresponding flow stats are updated (passed/failed/skipped counters, spec file set). Tests without tags are collected into `unmappedTests`.
3. When the suite ends (`onEnd`), the reporter calculates the final status for each flow based on the test results, prints a colored report to the terminal, and writes a JSON file.

---

## 3. File Structure

Create these files in your project:

```
<project-root>/
├── e2e/
│   ├── flow-definitions.json          # Step 1: Flow definitions
│   ├── reporters/
│   │   └── flow-coverage-reporter.mjs # Step 2: Reporter implementation
│   ├── helpers/
│   │   └── flow-tags.js               # (Optional) Step 5: Tag constants helper
│   ├── auth/
│   │   └── auth-login.spec.js         # Step 4: Tagged test files
│   └── ...
├── e2e-results/                        # Auto-created by reporter
│   └── flow-coverage.json             # JSON artifact
└── playwright.config.mjs              # Step 3: Reporter registration
```

> **Note:** Paths are relative to the frontend/app root. Adjust if your Playwright config lives elsewhere.

---

## 4. Step 1 — Create `flow-definitions.json`

This file is the **single source of truth** for all user flows tracked by the report.

### Schema

```jsonc
{
  "version": "<semver>",          // Version of this definitions file
  "lastUpdated": "<YYYY-MM-DD>",  // Date of last modification
  "flows": {
    "<flow-id>": {
      "name": "<string>",           // Human-readable flow name
      "module": "<string>",         // Module grouping (e.g., "auth", "documents")
      "roles": ["<string>", ...],   // Applicable roles (e.g., ["lawyer", "client"])
      "priority": "<P1|P2|P3|P4>",  // P1 = critical, P4 = nice-to-have
      "description": "<string>",    // What the flow does
      "expectedSpecs": <number>,    // How many spec files should cover this flow
      "knownGaps": ["<string>", ...]  // (Optional) Known coverage gaps
    }
  }
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `string` | Yes | Semantic version of the definitions file. Bump on structural changes. |
| `lastUpdated` | `string` | Yes | ISO date (`YYYY-MM-DD`) of the last edit. |
| `flows` | `object` | Yes | Map of `flowId → FlowDefinition`. |
| `flows.<id>.name` | `string` | Yes | Display name shown in the report. |
| `flows.<id>.module` | `string` | Yes | Logical module. Used for "Coverage by Module" grouping. |
| `flows.<id>.roles` | `string[]` | Yes | Which user roles exercise this flow. Use `"shared"` for all roles. |
| `flows.<id>.priority` | `string` | Yes | `P1` (critical) through `P4` (nice-to-have). Affects "Missing Flows by Priority" section. |
| `flows.<id>.description` | `string` | Yes | One-line explanation of what the flow covers. |
| `flows.<id>.expectedSpecs` | `number` | Yes | Target number of spec files for this flow. Informational. |
| `flows.<id>.knownGaps` | `string[]` | No | Documented limitations. Displayed in the "Partial Coverage" section. |

### Annotated example

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-15",
  "flows": {
    "auth-login-email": {
      "name": "Login with email/password",
      "module": "auth",
      "roles": ["shared"],
      "priority": "P1",
      "description": "User signs in with email and password credentials",
      "expectedSpecs": 1
    },
    "checkout-paid": {
      "name": "Paid subscription checkout",
      "module": "subscriptions",
      "roles": ["shared"],
      "priority": "P1",
      "description": "User completes payment for a paid plan via payment gateway",
      "expectedSpecs": 1,
      "knownGaps": ["Test verifies form submission, not actual payment callback"]
    }
  }
}
```

### Naming conventions for `flow-id`

- Use **kebab-case**: `auth-login-email`, `docs-create-template`.
- Prefix with the **module name**: `auth-`, `docs-`, `org-`, `sign-`, `legal-`.
- Keep IDs **stable** — tests reference them via `@flow:` tags.

---

## 5. Step 2 — Create `flow-coverage-reporter.mjs`

Create the file at `e2e/reporters/flow-coverage-reporter.mjs`.

Below is the **complete source code** with inline comments explaining each section:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- ESM __dirname equivalent ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Object} FlowDefinition
 * @property {string} name
 * @property {string} module
 * @property {string[]} roles
 * @property {string} priority
 * @property {string} description
 * @property {number} expectedSpecs
 * @property {string[]} [knownGaps]
 */

/**
 * @typedef {Object} FlowStats
 * @property {string} flowId
 * @property {FlowDefinition} definition
 * @property {{ total: number, passed: number, failed: number, skipped: number }} tests
 * @property {Set<string>} specs
 * @property {'covered'|'partial'|'missing'|'failing'} status
 */

class FlowCoverageReporter {
  /** @type {Map<string, FlowStats>} */
  flowStats = new Map();

  /** @type {{ version: string, lastUpdated: string, flows: Record<string, FlowDefinition> }} */
  flowDefinitions;

  /** @type {{ title: string, file: string }[]} */
  unmappedTests = [];

  /** @type {string} */
  outputDir;

  /**
   * Constructor — receives options from playwright.config reporter entry.
   * @param {{ outputDir?: string }} options
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'e2e-results';

    // Load flow definitions from the JSON file next to the e2e directory
    const definitionsPath = path.resolve(__dirname, '..', 'flow-definitions.json');
    if (fs.existsSync(definitionsPath)) {
      this.flowDefinitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf-8'));
    } else {
      this.flowDefinitions = { version: '0.0.0', lastUpdated: '', flows: {} };
      console.warn('\n  ⚠️  flow-definitions.json not found. Flow coverage will be limited.\n');
    }

    // Initialize stats for every defined flow with status "missing"
    for (const [flowId, definition] of Object.entries(this.flowDefinitions.flows)) {
      this.flowStats.set(flowId, {
        flowId,
        definition,
        tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
        specs: new Set(),
        status: 'missing',
      });
    }
  }

  // ---------- Playwright reporter lifecycle: onTestEnd ----------
  /**
   * Called after each test finishes.
   * Extracts @flow: tags and updates the corresponding flow stats.
   *
   * @param {import('@playwright/test/reporter').TestCase} test
   * @param {import('@playwright/test/reporter').TestResult} result
   */
  onTestEnd(test, result) {
    const tags = test.tags || [];
    const flowTags = tags.filter((t) => t.startsWith('@flow:'));
    const specFile = test.location.file;

    // If the test has no @flow: tag, record it as unmapped
    if (flowTags.length === 0) {
      this.unmappedTests.push({ title: test.title, file: specFile });
      return;
    }

    // A single test can belong to multiple flows
    for (const tag of flowTags) {
      const flowId = tag.replace('@flow:', '');

      let stats = this.flowStats.get(flowId);
      if (!stats) {
        // Flow not in definitions — create a dynamic entry so it still appears in the report
        stats = {
          flowId,
          definition: {
            name: flowId,
            module: 'unknown',
            roles: ['unknown'],
            priority: 'P4',
            description: 'Auto-detected flow (not in definitions)',
            expectedSpecs: 1,
          },
          tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
          specs: new Set(),
          status: 'missing',
        };
        this.flowStats.set(flowId, stats);
      }

      stats.tests.total++;
      stats.specs.add(specFile);

      switch (result.status) {
        case 'passed':
          stats.tests.passed++;
          break;
        case 'failed':
        case 'timedOut':
          stats.tests.failed++;
          break;
        case 'skipped':
          stats.tests.skipped++;
          break;
      }
    }
  }

  // ---------- Playwright reporter lifecycle: onEnd ----------
  /**
   * Called after all tests finish.
   * Computes final status for each flow, prints the report, writes JSON.
   *
   * @param {import('@playwright/test/reporter').FullResult} result
   */
  onEnd(result) {
    for (const stats of this.flowStats.values()) {
      if (stats.tests.total === 0) {
        stats.status = 'missing';           // No tests found for this flow
      } else if (stats.tests.failed > 0) {
        stats.status = 'failing';           // At least one test failed
      } else if (stats.tests.passed > 0 && stats.tests.skipped === 0) {
        stats.status = 'covered';           // All tests passed, none skipped
      } else {
        stats.status = 'partial';           // Some passed but some skipped
      }
    }

    this.printReport();
    this.writeJsonReport();
  }

  // ---------- Terminal output ----------
  printReport() {
    const flows = Array.from(this.flowStats.values());

    const covered = flows.filter((f) => f.status === 'covered');
    const partial = flows.filter((f) => f.status === 'partial');
    const failing = flows.filter((f) => f.status === 'failing');
    const missing = flows.filter((f) => f.status === 'missing');

    const missingP1 = missing.filter((f) => f.definition.priority === 'P1');
    const missingP2 = missing.filter((f) => f.definition.priority === 'P2');
    const missingP3 = missing.filter((f) => f.definition.priority === 'P3');

    const total = flows.length;
    const pct = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');

    // ANSI escape codes for colored terminal output
    const ANSI = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      brightRed: '\x1b[91m',
      brightGreen: '\x1b[92m',
      orange: '\x1b[38;5;208m',
      gray: '\x1b[90m',
    };

    console.log('');
    console.log(`${ANSI.bold}╔══════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
    console.log(`${ANSI.bold}║                    FLOW COVERAGE REPORT                         ║${ANSI.reset}`);
    console.log(`${ANSI.bold}╚══════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
    console.log('');

    // ── Summary ──
    console.log(`${ANSI.bold}📊 SUMMARY${ANSI.reset}`);
    console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
    console.log(`   Total Flows Defined:  ${ANSI.bold}${total}${ANSI.reset}`);
    console.log(`   ${ANSI.green}✅ Covered:${ANSI.reset}           ${covered.length} (${pct(covered.length)}%)`);
    console.log(`   ${ANSI.yellow}⚠️  Partial:${ANSI.reset}           ${partial.length} (${pct(partial.length)}%)`);
    console.log(`   ${ANSI.red}❌ Failing:${ANSI.reset}           ${failing.length} (${pct(failing.length)}%)`);
    console.log(`   ${ANSI.gray}⬜ Missing:${ANSI.reset}           ${missing.length} (${pct(missing.length)}%)`);
    console.log('');

    // ── Missing Flows by Priority (conditional) ──
    if (missing.length > 0) {
      console.log(`${ANSI.bold}🚨 MISSING FLOWS BY PRIORITY${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);

      if (missingP1.length > 0) {
        console.log(`   ${ANSI.red}🔴 P1 (Critical): ${missingP1.length}${ANSI.reset}`);
        for (const f of missingP1) {
          console.log(`      ${ANSI.dim}-${ANSI.reset} ${f.flowId}: ${f.definition.name}`);
        }
      }

      if (missingP2.length > 0) {
        console.log(`   ${ANSI.orange}🟠 P2 (High): ${missingP2.length}${ANSI.reset}`);
        for (const f of missingP2) {
          console.log(`      ${ANSI.dim}-${ANSI.reset} ${f.flowId}: ${f.definition.name}`);
        }
      }

      if (missingP3.length > 0) {
        console.log(`   ${ANSI.yellow}🟡 P3 (Medium): ${missingP3.length}${ANSI.reset}`);
        for (const f of missingP3) {
          console.log(`      ${ANSI.dim}-${ANSI.reset} ${f.flowId}: ${f.definition.name}`);
        }
      }
      console.log('');
    }

    // ── Failing Flows (conditional) ──
    if (failing.length > 0) {
      console.log(`${ANSI.bold}❌ FAILING FLOWS${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      for (const f of failing) {
        console.log(`   ${ANSI.red}${f.flowId}${ANSI.reset}: ${f.tests.failed}/${f.tests.total} failed`);
      }
      console.log('');
    }

    // ── Partial Coverage (conditional) ──
    if (partial.length > 0) {
      console.log(`${ANSI.bold}⚠️  PARTIAL COVERAGE${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      for (const f of partial) {
        const testPct = f.tests.total > 0 ? ((f.tests.passed / f.tests.total) * 100).toFixed(0) : '0';
        console.log(`   ${ANSI.yellow}${f.flowId}${ANSI.reset}: ${testPct}% (${f.tests.passed}/${f.tests.total})`);
        if (f.definition.knownGaps) {
          for (const gap of f.definition.knownGaps) {
            console.log(`      ${ANSI.dim}└─ Gap: ${gap}${ANSI.reset}`);
          }
        }
      }
      console.log('');
    }

    // ── Coverage by Module (always shown) ──
    console.log(`${ANSI.bold}📦 COVERAGE BY MODULE${ANSI.reset}`);
    console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);

    /** @type {Map<string, { covered: number, total: number }>} */
    const byModule = new Map();

    for (const flow of flows) {
      const mod = flow.definition.module;
      if (!byModule.has(mod)) {
        byModule.set(mod, { covered: 0, total: 0 });
      }
      const modStats = byModule.get(mod);
      modStats.total++;
      if (flow.status === 'covered') modStats.covered++;
    }

    const sortedModules = Array.from(byModule.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [mod, modStats] of sortedModules) {
      const modPct = modStats.total > 0 ? ((modStats.covered / modStats.total) * 100).toFixed(0) : '0';
      const bar = this.progressBar(modStats.covered, modStats.total, 20);
      const pctNum = parseInt(modPct, 10);
      let color = ANSI.red;
      if (pctNum >= 80) color = ANSI.brightGreen;
      else if (pctNum >= 60) color = ANSI.green;
      else if (pctNum >= 40) color = ANSI.yellow;
      else if (pctNum >= 20) color = ANSI.orange;
      console.log(`   ${mod.padEnd(18)} ${color}${bar}${ANSI.reset} ${color}${modPct}%${ANSI.reset} (${modStats.covered}/${modStats.total})`);
    }
    console.log('');

    // ── Tests Without Flow Tag (conditional) ──
    if (this.unmappedTests.length > 0) {
      console.log(`${ANSI.bold}⚠️  TESTS WITHOUT FLOW TAG${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      console.log(`   ${this.unmappedTests.length} tests are not tagged with @flow:`);

      /** @type {Map<string, number>} */
      const grouped = new Map();
      for (const t of this.unmappedTests) {
        const count = grouped.get(t.file) || 0;
        grouped.set(t.file, count + 1);
      }

      const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 15);
      for (const [file, count] of top) {
        const shortFile = file.split('/').slice(-2).join('/');
        console.log(`      ${ANSI.dim}${shortFile}: ${count} tests${ANSI.reset}`);
      }
      if (sorted.length > 15) {
        console.log(`      ${ANSI.dim}... and ${sorted.length - 15} more files${ANSI.reset}`);
      }
      console.log('');
    }

    console.log(`${ANSI.dim}${'═'.repeat(68)}${ANSI.reset}`);
    console.log(`${ANSI.green}  ✅ JSON report: ${this.outputDir}/flow-coverage.json${ANSI.reset}`);
    console.log('');
  }

  // ---------- Progress bar helper ----------
  /**
   * @param {number} value
   * @param {number} max
   * @param {number} width
   * @returns {string}
   */
  progressBar(value, max, width) {
    const pctVal = max > 0 ? value / max : 0;
    const filled = Math.round(pctVal * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  // ---------- JSON artifact ----------
  writeJsonReport() {
    const report = {
      timestamp: new Date().toISOString(),
      version: this.flowDefinitions.version,
      summary: {
        total: this.flowStats.size,
        covered: Array.from(this.flowStats.values()).filter((f) => f.status === 'covered').length,
        partial: Array.from(this.flowStats.values()).filter((f) => f.status === 'partial').length,
        failing: Array.from(this.flowStats.values()).filter((f) => f.status === 'failing').length,
        missing: Array.from(this.flowStats.values()).filter((f) => f.status === 'missing').length,
      },
      flows: Object.fromEntries(
        Array.from(this.flowStats.entries()).map(([id, stats]) => [
          id,
          {
            flowId: stats.flowId,
            definition: stats.definition,
            tests: stats.tests,
            specs: Array.from(stats.specs),
            status: stats.status,
          },
        ])
      ),
      unmappedTests: {
        count: this.unmappedTests.length,
        files: (() => {
          /** @type {Map<string, number>} */
          const grouped = new Map();
          for (const t of this.unmappedTests) {
            grouped.set(t.file, (grouped.get(t.file) || 0) + 1);
          }
          return Object.fromEntries(grouped);
        })(),
      },
    };

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(this.outputDir, 'flow-coverage.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

export default FlowCoverageReporter;
```

---

## 6. Step 3 — Register the Reporter in `playwright.config`

Add the custom reporter to the `reporter` array in your Playwright configuration file.

### Minimal config snippet

```javascript
// playwright.config.mjs
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  reporter: [
    ["list"],                                                          // Built-in: terminal list
    ["html", { open: "never" }],                                       // Built-in: HTML report
    ["json", { outputFile: "e2e-results/results.json" }],              // Built-in: JSON results
    ["./e2e/reporters/flow-coverage-reporter.mjs", { outputDir: "e2e-results" }], // Custom: Flow coverage
  ],
  // ... rest of your config
});
```

### Reporter options

| Option | Type | Default | Description |
|---|---|---|---|
| `outputDir` | `string` | `"e2e-results"` | Directory where `flow-coverage.json` is written. Created automatically if missing. |

### Path resolution

The reporter path (`"./e2e/reporters/flow-coverage-reporter.mjs"`) is resolved **relative to the Playwright config file**. Adjust if your directory structure differs.

The reporter internally resolves `flow-definitions.json` as:

```
path.resolve(__dirname, '..', 'flow-definitions.json')
```

This means it expects `flow-definitions.json` to be one level above the `reporters/` directory (i.e., in the `e2e/` directory). If you place the definitions file elsewhere, update the `definitionsPath` constant in the reporter.

---

## 7. Step 4 — Tag Tests with `@flow:`

Every Playwright test must be tagged with one or more `@flow:<flow-id>` tags to link it to a flow definition.

### Syntax

```javascript
import { test, expect } from '@playwright/test';

// Single flow tag
test('user can sign in with email and password', {
  tag: ['@flow:auth-login-email'],
}, async ({ page }) => {
  // test body
});

// Multiple flow tags (test covers two flows)
test('user completes checkout after signing in', {
  tag: ['@flow:auth-login-email', '@flow:checkout-paid'],
}, async ({ page }) => {
  // test body
});
```

### Naming rules

| Rule | Example |
|---|---|
| Tags must start with `@flow:` | `@flow:auth-login-email` |
| The value after `@flow:` must match a key in `flow-definitions.json` | `"auth-login-email"` in definitions → `@flow:auth-login-email` in test |
| Use kebab-case | `@flow:docs-create-template` (not `@flow:DocsCreateTemplate`) |
| A test can have multiple `@flow:` tags | `tag: ['@flow:auth-login-email', '@flow:auth-edge-cases']` |

### Auto-detection behavior

If a test uses a `@flow:` tag that **does not exist** in `flow-definitions.json`, the reporter will:

1. Create a **dynamic entry** with `module: "unknown"`, `priority: "P4"`, and `description: "Auto-detected flow (not in definitions)"`.
2. Include the flow in the report under the `unknown` module.
3. This is a **signal to add the missing definition** to `flow-definitions.json`.

### What happens to untagged tests

Tests without any `@flow:` tag are:

1. Collected in the `unmappedTests` array.
2. Displayed in the **"Tests Without Flow Tag"** section of the terminal report.
3. Included in the `unmappedTests` field of the JSON output.
4. They do **not** affect any flow's status.

> **Goal:** Every E2E test should have at least one `@flow:` tag. The "Tests Without Flow Tag" section should be empty in a mature project.

### Additional metadata tags (optional)

While only `@flow:` tags are consumed by the reporter, tests in practice also carry additional Playwright tags for filtering and organization:

| Tag | Purpose | Example |
|---|---|---|
| `@module:<name>` | Group tests by module for Playwright CLI filtering | `@module:auth` |
| `@priority:<P1-P4>` | Filter tests by priority | `@priority:P1` |
| `@role:<name>` | Filter tests by user role | `@role:client` |

These tags are **not required** for the Flow Coverage Report to work. They are useful for running subsets of the suite:

```bash
# Run only auth module tests
npx playwright test --grep @module:auth

# Run only P1 (critical) tests
npx playwright test --grep @priority:P1
```

---

## 8. Step 5 (Optional) — Create `flow-tags.js` Constants

To avoid repeating the same tag arrays across spec files, create a constants helper at `e2e/helpers/flow-tags.js`.

### Purpose

- **Single source** for tag arrays — change a tag value in one place.
- **Consistent metadata** — each constant bundles `@flow:`, `@module:`, and `@priority:` together.
- **Spread syntax** — use `...` to compose tags in tests.

### Example implementation

```javascript
/**
 * Flow tag constants for consistent E2E test tagging.
 *
 * Usage:
 *   import { AUTH_LOGIN_EMAIL } from '../helpers/flow-tags.js';
 *   test('...', { tag: [...AUTH_LOGIN_EMAIL, '@role:client'] }, async ({ page }) => { ... });
 */

// ── Auth ──
export const AUTH_LOGIN_EMAIL = ['@flow:auth-login-email', '@module:auth', '@priority:P1'];
export const AUTH_REGISTER = ['@flow:auth-register', '@module:auth', '@priority:P1'];
export const AUTH_FORGOT_PASSWORD = ['@flow:auth-forgot-password', '@module:auth', '@priority:P2'];

// ── Documents ──
export const DOCS_CREATE_TEMPLATE = ['@flow:docs-create-template', '@module:documents', '@priority:P1'];
export const DOCS_EDITOR = ['@flow:docs-editor', '@module:documents', '@priority:P1'];

// ... add one constant per flow defined in flow-definitions.json
```

### Usage in spec files

```javascript
import { test, expect } from '@playwright/test';
import { AUTH_LOGIN_EMAIL } from '../helpers/flow-tags.js';

test('user can sign in with email and password', {
  tag: [...AUTH_LOGIN_EMAIL, '@role:shared'],
}, async ({ page }) => {
  // test body
});
```

### Naming convention

| Pattern | Example |
|---|---|
| `SCREAMING_SNAKE_CASE` matching the flow ID | `auth-login-email` → `AUTH_LOGIN_EMAIL` |
| One constant per flow in `flow-definitions.json` | 101 flows → 101 constants |
| Grouped by module with section comments | `// ── Auth ──`, `// ── Documents ──` |

> This file is **optional**. Tests can use inline tag arrays (`tag: ['@flow:auth-login-email']`) if you prefer not to maintain a constants file.

---

## 9. Report Sections Explained

The terminal report contains up to **six sections**. Some sections are **conditional** — they only appear when relevant data exists. This means a clean report with no issues will show fewer sections.

### 9.1 Summary (always shown)

```
📊 SUMMARY
──────────────────────────────────────────────────
   Total Flows Defined:  101
   ✅ Covered:           95 (94.1%)
   ⚠️  Partial:           2 (2.0%)
   ❌ Failing:           0 (0.0%)
   ⬜ Missing:           4 (4.0%)
```

- **Always displayed.** Shows aggregate counts and percentages for all four statuses.
- Percentages are relative to the total number of defined flows.

### 9.2 Missing Flows by Priority (conditional)

```
🚨 MISSING FLOWS BY PRIORITY
──────────────────────────────────────────────────
   🔴 P1 (Critical): 1
      - auth-idle-logout: Idle logout automático
   🟠 P2 (High): 2
      - process-edit: Edit existing process
   🟡 P3 (Medium): 1
      - docs-duplicate: Duplicate document
```

- **Shown only when `missing.length > 0`.**
- Groups missing flows by priority level (P1, P2, P3). P4 flows are intentionally excluded from this section to reduce noise.
- **When this section is absent**, it means every defined flow has at least one test — an optimal state.

### 9.3 Failing Flows (conditional)

```
❌ FAILING FLOWS
──────────────────────────────────────────────────
   auth-login-email: 2/5 failed
   checkout-paid: 1/3 failed
```

- **Shown only when `failing.length > 0`.**
- Lists flows where at least one test failed or timed out, along with the failure ratio.
- **When this section is absent**, no flow has any failing tests.

### 9.4 Partial Coverage (conditional)

```
⚠️  PARTIAL COVERAGE
──────────────────────────────────────────────────
   auth-login-google: 67% (2/3)
      └─ Gap: Tests only verify render, not real OAuth
   docs-use-template: 50% (1/2)
      └─ Gap: Missing end-to-end complete flow test
```

- **Shown only when `partial.length > 0`.**
- A flow is partial when some tests passed but others were skipped (`test.skip`).
- If the flow definition includes `knownGaps`, they are displayed as indented sub-items.
- **When this section is absent**, no flow has skipped tests.

### 9.5 Coverage by Module (always shown)

```
📦 COVERAGE BY MODULE
──────────────────────────────────────────────────
   auth               [████████████████░░░░] 80% (8/10)
   dashboard          [████████████████████] 100% (9/9)
   documents          [██████████████░░░░░░] 70% (14/20)
   signatures         [████████████░░░░░░░░] 60% (6/10)
```

- **Always displayed.** Groups all flows by their `module` field and shows a progress bar.
- Modules are sorted alphabetically.
- Color coding: red (<20%), orange (20–39%), yellow (40–59%), green (60–79%), bright green (≥80%).
- **Optional module-scoped runs:** if your tests also include `@module:<name>` tags, you can filter a single module with Playwright’s `--grep` (e.g., `npx playwright test --grep @module:auth`). When running a subset, the report will list other modules/flows as missing because they were not executed.

### 9.6 Tests Without Flow Tag (conditional)

```
⚠️  TESTS WITHOUT FLOW TAG
──────────────────────────────────────────────────
   12 tests are not tagged with @flow:
      auth/auth-misc.spec.js: 5 tests
      documents/doc-helpers.spec.js: 4 tests
      misc/smoke-test.spec.js: 3 tests
```

- **Shown only when `unmappedTests.length > 0`.**
- Lists up to 15 spec files with untagged tests, sorted by count descending.
- If more than 15 files exist, a summary line shows the remaining count.
- **When this section is absent**, every test in the suite is tagged — an optimal state.

### Section visibility summary

| Section | Condition to appear |
|---|---|
| Summary | Always |
| Missing Flows by Priority | At least one flow has status `missing` |
| Failing Flows | At least one flow has status `failing` |
| Partial Coverage | At least one flow has status `partial` |
| Coverage by Module | Always |
| Tests Without Flow Tag | At least one test has no `@flow:` tag |

---

## 10. Status State Machine

Each flow is assigned exactly one status after all tests complete. The status is determined by the following rules, evaluated **in order**:

| Status | Condition | Meaning |
|---|---|---|
| `missing` | `tests.total === 0` | No tests exist for this flow. |
| `failing` | `tests.failed > 0` | At least one test failed or timed out. |
| `covered` | `tests.passed > 0 && tests.skipped === 0` | All tests passed, none were skipped. |
| `partial` | _(default)_ | Some tests passed but at least one was skipped. |

### Decision flowchart

```
                    ┌─────────────────┐
                    │ tests.total = 0 │
                    └────────┬────────┘
                        YES  │  NO
                        ▼    │
                   ┌─────────┐    ┌──────────────────┐
                   │ MISSING  │    │ tests.failed > 0 │
                   └─────────┘    └────────┬─────────┘
                                      YES  │  NO
                                      ▼    │
                                 ┌─────────┐    ┌──────────────────────────────────┐
                                 │ FAILING  │    │ tests.passed > 0 && skipped = 0 │
                                 └─────────┘    └────────────┬─────────────────────┘
                                                        YES  │  NO
                                                        ▼    │
                                                   ┌─────────┐    ┌─────────┐
                                                   │ COVERED  │    │ PARTIAL │
                                                   └─────────┘    └─────────┘
```

### Important notes

- **`timedOut` counts as `failed`.** A test that exceeds the timeout is treated as a failure.
- **`failing` takes priority over `partial`.** If a flow has both failed and skipped tests, it is `failing`, not `partial`.
- **A single failing test marks the entire flow as `failing`**, regardless of how many other tests passed.

---

## 11. JSON Output Reference

After every run, the reporter writes `<outputDir>/flow-coverage.json`. This file can be consumed by CI dashboards, trend analysis tools, or custom scripts.

### Schema

```jsonc
{
  "timestamp": "<ISO-8601>",       // When the report was generated
  "version": "<string>",           // Version from flow-definitions.json
  "summary": {
    "total": <number>,             // Total flows in the definitions
    "covered": <number>,           // Flows with status "covered"
    "partial": <number>,           // Flows with status "partial"
    "failing": <number>,           // Flows with status "failing"
    "missing": <number>            // Flows with status "missing"
  },
  "flows": {
    "<flow-id>": {
      "flowId": "<string>",
      "definition": {
        "name": "<string>",
        "module": "<string>",
        "roles": ["<string>"],
        "priority": "<P1|P2|P3|P4>",
        "description": "<string>",
        "expectedSpecs": <number>,
        "knownGaps": ["<string>"]   // Only present if defined
      },
      "tests": {
        "total": <number>,
        "passed": <number>,
        "failed": <number>,
        "skipped": <number>
      },
      "specs": ["<string>"],        // Absolute paths to spec files that cover this flow
      "status": "<covered|partial|failing|missing>"
    }
  },
  "unmappedTests": {
    "count": <number>,              // Total tests without @flow: tags
    "files": {
      "<file-path>": <number>       // File → count of untagged tests
    }
  }
}
```

### Example (abbreviated)

```json
{
  "timestamp": "2026-02-23T15:30:00.000Z",
  "version": "1.0.0",
  "summary": {
    "total": 101,
    "covered": 95,
    "partial": 2,
    "failing": 0,
    "missing": 4
  },
  "flows": {
    "auth-login-email": {
      "flowId": "auth-login-email",
      "definition": {
        "name": "Login with email/password",
        "module": "auth",
        "roles": ["shared"],
        "priority": "P1",
        "description": "User signs in with email and password",
        "expectedSpecs": 1
      },
      "tests": { "total": 3, "passed": 3, "failed": 0, "skipped": 0 },
      "specs": ["/app/e2e/auth/auth-sign-in.spec.js"],
      "status": "covered"
    }
  },
  "unmappedTests": {
    "count": 0,
    "files": {}
  }
}
```

### Recommended `.gitignore` entry

```gitignore
e2e-results/
```

The JSON file is a **build artifact**, not source code. Generate it fresh on every run.

---

## 12. Maintenance Rules

### Adding a new flow

1. Add a new entry to `flow-definitions.json` with all required fields.
2. Bump the `version` field if the change is structural.
3. Update the `lastUpdated` date.
4. Create or update spec files with the corresponding `@flow:<new-flow-id>` tag.
5. Run the E2E suite and verify the new flow appears in the report.

### Removing a flow

1. Delete the entry from `flow-definitions.json`.
2. Remove the `@flow:<deleted-flow-id>` tag from all spec files.
3. If the spec file has no remaining `@flow:` tags, either add a different tag or remove the file.
4. Run the suite and verify the flow no longer appears and no tests became unmapped.

### Renaming a flow ID

1. Update the key in `flow-definitions.json`.
2. Update **all** `@flow:` tags in spec files to match the new ID.
3. This must be done atomically — a mismatch will cause the old ID to appear as `missing` and the new ID to be auto-detected under the `unknown` module.

### Keeping definitions in sync with specs

| Signal | Action |
|---|---|
| "Missing Flows by Priority" section appears | Write tests for those flows or remove the flow definition if the feature was deleted. |
| "Tests Without Flow Tag" section appears | Add `@flow:` tags to the listed tests. |
| A flow appears under module `unknown` | The `@flow:` tag references an ID not in `flow-definitions.json`. Add the definition. |
| `expectedSpecs` does not match reality | Update the number in the definition. This field is informational only. |

### What is NOT a user flow

Not every testable concern qualifies as a user flow in `flow-definitions.json`. Cross-cutting quality attributes should be validated through other mechanisms:

| Concern | Why it is NOT a flow | Recommended approach |
|---|---|---|
| Responsive / viewport layout | "The app renders at 375px" is a design property, not a user journey | Use Playwright `projects` to run functional tests at multiple viewport sizes (see §3.9.4.8 in the Architecture Standard) |
| Performance / load time | Measured in milliseconds, not user steps | Use Lighthouse CI or Web Vitals |
| Accessibility compliance | Structural audit, not a user journey | Use axe-core or Playwright accessibility snapshots |
| SEO meta tags | Static content audit | Use Lighthouse or custom CI checks |

**Exception:** If a viewport change triggers **different observable behavior** (e.g., sidebar collapses into a hamburger menu on mobile), that specific interaction IS a user behavior and belongs in the relevant functional module — not in a dedicated responsive module.

### Version bumping guidelines

| Change | Version bump |
|---|---|
| Add/remove a flow | Patch (`1.0.0` → `1.0.1`) |
| Rename flow IDs or restructure modules | Minor (`1.0.0` → `1.1.0`) |
| Change the schema of the definitions file | Major (`1.0.0` → `2.0.0`) |

---

## 13. Checklist for New Projects

Use this checklist to go from zero to a working Flow Coverage Report in an existing Playwright project.

### Prerequisites

- [ ] Playwright is installed and configured (`npx playwright test` works).
- [ ] Tests use the `@playwright/test` runner (not a custom runner).
- [ ] Node.js supports ES modules (`.mjs` files or `"type": "module"` in `package.json`).

### Setup steps

- [ ] **1. Create `e2e/flow-definitions.json`**
  - Define at least one flow (see [Step 1](#4-step-1--create-flow-definitionsjson)).
  - Set `version`, `lastUpdated`, and at least one entry in `flows`.

- [ ] **2. Create `e2e/reporters/flow-coverage-reporter.mjs`**
  - Copy the full source code from [Step 2](#5-step-2--create-flow-coverage-reportermjs).
  - Verify the path to `flow-definitions.json` in the constructor matches your directory structure.

- [ ] **3. Register the reporter in `playwright.config.mjs`**
  - Add `["./e2e/reporters/flow-coverage-reporter.mjs", { outputDir: "e2e-results" }]` to the `reporter` array (see [Step 3](#6-step-3--register-the-reporter-in-playwrightconfig)).

- [ ] **4. Tag at least one test with `@flow:`**
  - Add `tag: ['@flow:<flow-id>']` to a test (see [Step 4](#7-step-4--tag-tests-with-flow)).
  - The `<flow-id>` must match a key in `flow-definitions.json`.

- [ ] **5. (Optional) Create `e2e/helpers/flow-tags.js`**
  - Add tag constants for each flow (see [Step 5](#8-step-5-optional--create-flow-tagsjs-constants)).

- [ ] **6. Run and verify**
  - Run `npx playwright test`.
  - Confirm the **FLOW COVERAGE REPORT** appears in the terminal output.
  - Confirm `e2e-results/flow-coverage.json` was created.
  - Add `e2e-results/` to `.gitignore`.

### Post-setup

- [ ] Define all user flows in `flow-definitions.json`.
- [ ] Tag all existing E2E tests with appropriate `@flow:` tags.
- [ ] Aim for zero entries in "Missing Flows by Priority" and "Tests Without Flow Tag".
- [ ] Integrate `flow-coverage.json` into your CI dashboard if applicable.
