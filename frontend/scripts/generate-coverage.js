#!/usr/bin/env node
/**
 * Static E2E flow coverage generator.
 *
 * Derives coverage purely from `@flow:<id>` tags present in spec files.
 * Unlike the Playwright `flow-coverage-reporter.mjs` (which requires tests to
 * actually run), this script walks the spec tree, resolves flow-tag constants
 * imported from `e2e/helpers/flow-tags.js`, cross-references
 * `e2e/flow-definitions.json`, and writes `e2e-results/flow-coverage-static.json`.
 *
 *   Usage: node frontend/scripts/generate-coverage.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const E2E_ROOT = path.join(FRONTEND_ROOT, 'e2e');
const FLOW_TAGS_PATH = path.join(E2E_ROOT, 'helpers', 'flow-tags.js');
const DEFINITIONS_PATH = path.join(E2E_ROOT, 'flow-definitions.json');
const OUTPUT_DIR = path.join(FRONTEND_ROOT, 'e2e-results');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'flow-coverage-static.json');

const SKIP_DIRS = new Set(['helpers', 'reporters', 'node_modules']);
const FLOW_TAG_REGEX = /@flow:([a-z0-9-]+)/g;
const EXPORT_CONST_REGEX = /export\s+const\s+([A-Z0-9_]+)\s*=\s*\[([^\]]*)\]/g;
const IMPORT_REGEX = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+flow-tags(?:\.js)?)['"]/g;

function readFile(file) {
  return fs.readFileSync(file, 'utf8');
}

/**
 * Parse flow-tags.js: produce { CONSTANT_NAME -> flowId } map.
 */
function parseFlowTagConstants() {
  if (!fs.existsSync(FLOW_TAGS_PATH)) return {};
  const src = readFile(FLOW_TAGS_PATH);
  const map = {};
  for (const match of src.matchAll(EXPORT_CONST_REGEX)) {
    const flowMatch = FLOW_TAG_REGEX.exec(match[2]);
    FLOW_TAG_REGEX.lastIndex = 0;
    if (flowMatch) map[match[1]] = flowMatch[1];
  }
  return map;
}

/**
 * Walk a directory recursively, returning absolute .spec.js file paths.
 */
function collectSpecs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSpecs(path.join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name.endsWith('.spec.js')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/**
 * For one spec file, return the set of flow ids it references via either
 * literal @flow:<id> strings or imported flow-tag constants.
 */
function extractFlowIds(specPath, constantMap) {
  const src = readFile(specPath);
  const flows = new Set();

  for (const m of src.matchAll(FLOW_TAG_REGEX)) flows.add(m[1]);

  for (const m of src.matchAll(IMPORT_REGEX)) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    for (const name of names) {
      const flowId = constantMap[name];
      if (flowId) flows.add(flowId);
    }
  }

  return flows;
}

function computeStatus(taggedSpecCount, expectedSpecs) {
  if (taggedSpecCount === 0) return 'missing';
  if (taggedSpecCount < expectedSpecs) return 'partial';
  return 'covered';
}

function relativeToRepo(abs) {
  return path.relative(path.resolve(FRONTEND_ROOT, '..'), abs);
}

function main() {
  const definitions = JSON.parse(readFile(DEFINITIONS_PATH));
  const constantMap = parseFlowTagConstants();

  const perFlow = new Map();
  for (const [id, def] of Object.entries(definitions.flows)) {
    perFlow.set(id, { flowId: id, definition: def, specFiles: new Set() });
  }

  const orphanTags = new Map();
  const specs = collectSpecs(E2E_ROOT);

  for (const specPath of specs) {
    const ids = extractFlowIds(specPath, constantMap);
    const rel = relativeToRepo(specPath);
    for (const id of ids) {
      const entry = perFlow.get(id);
      if (entry) {
        entry.specFiles.add(rel);
      } else {
        if (!orphanTags.has(id)) orphanTags.set(id, new Set());
        orphanTags.get(id).add(rel);
      }
    }
  }

  const flows = {};
  const counts = { covered: 0, partial: 0, missing: 0 };
  for (const [id, entry] of perFlow) {
    const expectedSpecs = entry.definition.expectedSpecs ?? 1;
    const taggedSpecCount = entry.specFiles.size;
    const status = computeStatus(taggedSpecCount, expectedSpecs);
    counts[status]++;
    flows[id] = {
      flowId: id,
      definition: entry.definition,
      taggedSpecCount,
      expectedSpecs,
      specFiles: Array.from(entry.specFiles).sort(),
      status,
    };
  }

  const orphanList = Array.from(orphanTags.entries())
    .map(([flowId, files]) => ({ flowId, specFiles: Array.from(files).sort() }))
    .sort((a, b) => a.flowId.localeCompare(b.flowId));

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'static',
    version: definitions.version ?? null,
    summary: {
      total: perFlow.size,
      covered: counts.covered,
      partial: counts.partial,
      missing: counts.missing,
      orphans: orphanList.length,
    },
    flows,
    orphanTags: orphanList,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

  printSummary(report);
}

function printSummary(report) {
  const { summary, flows, orphanTags } = report;
  console.log('');
  console.log('Static Flow Coverage');
  console.log('────────────────────');
  console.log(`  total:   ${summary.total}`);
  console.log(`  covered: ${summary.covered}`);
  console.log(`  partial: ${summary.partial}`);
  console.log(`  missing: ${summary.missing}`);
  console.log(`  orphans: ${summary.orphans}`);
  console.log('');

  const needsWork = Object.values(flows)
    .filter((f) => f.status !== 'covered')
    .sort((a, b) => {
      const pa = a.definition.priority ?? 'P5';
      const pb = b.definition.priority ?? 'P5';
      if (pa !== pb) return pa.localeCompare(pb);
      return a.flowId.localeCompare(b.flowId);
    });

  if (needsWork.length > 0) {
    console.log('Flows needing work (partial or missing):');
    for (const f of needsWork) {
      const tag = f.status.toUpperCase().padEnd(7);
      console.log(
        `  [${tag}] ${f.definition.priority ?? '--'} ${f.flowId}  ${f.taggedSpecCount}/${f.expectedSpecs}`
      );
    }
    console.log('');
  }

  if (orphanTags.length > 0) {
    console.log('Orphan @flow: tags (used in specs but missing from flow-definitions.json):');
    for (const o of orphanTags) {
      console.log(`  ${o.flowId}  (${o.specFiles.length} spec${o.specFiles.length === 1 ? '' : 's'})`);
    }
    console.log('');
  }

  console.log(`Report: ${path.relative(path.resolve(FRONTEND_ROOT, '..'), OUTPUT_PATH)}`);
}

main();
