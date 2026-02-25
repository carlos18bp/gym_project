import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
   * @param {{ outputDir?: string }} options
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'e2e-results';

    // Load flow definitions
    const definitionsPath = path.resolve(__dirname, '..', 'flow-definitions.json');
    if (fs.existsSync(definitionsPath)) {
      this.flowDefinitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf-8'));
    } else {
      this.flowDefinitions = { version: '0.0.0', lastUpdated: '', flows: {} };
      console.warn('\n  ⚠️  flow-definitions.json not found. Flow coverage will be limited.\n');
    }

    // Initialize stats for all defined flows
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

  /**
   * @param {import('@playwright/test/reporter').TestCase} test
   * @param {import('@playwright/test/reporter').TestResult} result
   */
  onTestEnd(test, result) {
    const tags = test.tags || [];
    const flowTags = tags.filter((t) => t.startsWith('@flow:'));
    const specFile = test.location.file;

    if (flowTags.length === 0) {
      this.unmappedTests.push({ title: test.title, file: specFile });
      return;
    }

    for (const tag of flowTags) {
      const flowId = tag.replace('@flow:', '');

      let stats = this.flowStats.get(flowId);
      if (!stats) {
        // Flow not in definitions — create dynamic entry
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

  /**
   * @param {import('@playwright/test/reporter').FullResult} result
   */
  onEnd(result) {
    // Calculate final status for each flow
    for (const stats of this.flowStats.values()) {
      if (stats.tests.total === 0) {
        stats.status = 'missing';
      } else if (stats.tests.failed > 0) {
        stats.status = 'failing';
      } else if (stats.tests.passed > 0 && stats.tests.skipped === 0) {
        stats.status = 'covered';
      } else {
        stats.status = 'partial';
      }
    }

    this.printReport();
    this.writeJsonReport();
  }

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

    // Summary
    console.log(`${ANSI.bold}📊 SUMMARY${ANSI.reset}`);
    console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
    console.log(`   Total Flows Defined:  ${ANSI.bold}${total}${ANSI.reset}`);
    console.log(`   ${ANSI.green}✅ Covered:${ANSI.reset}           ${covered.length} (${pct(covered.length)}%)`);
    console.log(`   ${ANSI.yellow}⚠️  Partial:${ANSI.reset}           ${partial.length} (${pct(partial.length)}%)`);
    console.log(`   ${ANSI.red}❌ Failing:${ANSI.reset}           ${failing.length} (${pct(failing.length)}%)`);
    console.log(`   ${ANSI.gray}⬜ Missing:${ANSI.reset}           ${missing.length} (${pct(missing.length)}%)`);
    console.log('');

    // Missing flows by priority
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

    // Failing flows
    if (failing.length > 0) {
      console.log(`${ANSI.bold}❌ FAILING FLOWS${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      for (const f of failing) {
        console.log(`   ${ANSI.red}${f.flowId}${ANSI.reset}: ${f.tests.failed}/${f.tests.total} failed`);
      }
      console.log('');
    }

    // Partial coverage
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

    // Coverage by module
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

    // Sort modules alphabetically
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

    // Unmapped tests warning
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

      // Sort by count descending, show top 15
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

    fs.writeFileSync(path.join(this.outputDir, 'flow-coverage.json'), JSON.stringify(report, null, 2));
  }
}

export default FlowCoverageReporter;
