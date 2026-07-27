#!/usr/bin/env node
'use strict';

/*
 * ast-parser.cjs — canonical AST parser for the fleet test-quality core.
 *
 * Contract (consumer: workflows/testing/quality/js_ast_bridge.py):
 *   node ast-parser.cjs <file> [--e2e]      (cwd = <repo>/frontend, 30s budget)
 *   stdout: ONE single-line JSON object:
 *     {
 *       file: string,
 *       tests: [{ name, fullContext, line, endLine, numLines, type,
 *                 isSkipped, isOnly, hasAssertions, assertionCount,
 *                 hasConsoleLog, hasHardcodedTimeout, timeoutValue,
 *                 isEmpty, describeBlock }],
 *       issues: [{ type, message, line, identifier?, suggestion? }],
 *       error: string|null,
 *       summary: { testCount, issueCount, hasParseError }
 *     }
 *   Exit code is ALWAYS 0. Failures (unresolvable dependency, unreadable
 *   file, syntax error) are reported inside the payload as `error` plus a
 *   PARSE_ERROR issue — never as a non-zero exit or a bare stack trace.
 *   issue.type must stay within the sets mapped by frontend_unit_analyzer.py
 *   (unit mode) and frontend_e2e_analyzer.py (--e2e mode): unknown types get
 *   misfiled as PARSE_ERROR downstream. The NETWORK_DEPENDENCY message for
 *   the call-contract-only case must contain the literal fragment
 *   "without observable outcome" (the unit analyzer downgrades on it).
 *
 * Lineage: unified 2026-07 from the three fleet forks — variant A
 * (xpandia/tuhuella: walker architecture, F44 rooted-chain fix), variant B
 * (gym: semantic rule set), variant C (vue: modifier exclusions,
 * dynamic-title convention). F44: member calls hanging off a non-Identifier
 * root (e.g. /re/.test(x)) can never classify as test declarations. F45:
 * member calls on it/test whose chain carries a config/annotation modifier
 * (test.use, test.setTimeout, test.step, ...) are not test declarations.
 *
 * Only dependency: @babel/parser, resolved from the consuming repo's
 * frontend/node_modules. No @babel/traverse — the walker is hand-rolled so
 * the parser keeps working on hosts where dev dependencies are pruned.
 */

const fs = require('fs');
const path = require('path');

// Guarded load: a pruned node_modules must yield a JSON error payload with
// exit 0, never a stack trace with exit 1 (the bridge treats non-zero exits
// as parser failures and loses the whole file analysis).
let babelParser = null;
let dependencyError = null;
try {
  babelParser = require('@babel/parser');
} catch (error) {
  dependencyError =
    '@babel/parser not resolvable (run npm install in frontend/): ' +
    String(error && error.message ? error.message : error);
}

/* ===================================================================== */
/* Rule tables                                                           */
/* ===================================================================== */

const LIFECYCLE_HOOKS = new Set(['beforeEach', 'afterEach', 'beforeAll', 'afterAll']);

// F45 exclusion set: modifiers that turn an it./test. member call into a
// config/annotation call, never a test declaration. Bug class: test.use({...})
// parsed as an unnamed empty test (phantom EMPTY_TEST — measured at 8 phantoms
// per 40 Playwright specs). skip/todo/fixme/fail are handled conditionally
// below (declaration-shaped calls remain tests); `each` is handled through the
// curried-call check.
const NON_DECLARATION_MODIFIERS = new Set([
  'use', 'setTimeout', 'step', 'slow', 'info', 'extend',
  'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
]);

// Titles that describe nothing — the test cannot name the bug it would catch.
const GENERIC_TITLES = new Set([
  'it works', 'should work', 'test', 'works', 'does something',
  'handles it', 'is correct', 'passes', 'runs',
]);

// Tokens reserved for coverage-farming artifacts (batch/coverage sweeps).
const FORBIDDEN_TOKEN_RE = /\b(batch|coverage|cov|deep)\b/i;

// Assertions that can never fail — pure gate noise.
const USELESS_ASSERTION_PATTERNS = [
  /expect\(\s*true\s*\)\s*\.toBe\(\s*true\s*\)/,
  /expect\(\s*1\s*\)\s*\.toBe\(\s*1\s*\)/,
  /expect\(\s*false\s*\)\s*\.toBe\(\s*false\s*\)/,
  /expect\(\s*true\s*\)\s*\.toBeTruthy\(\s*\)/,
  /expect\(\s*false\s*\)\s*\.toBeFalsy\(\s*\)/,
  /assert\(\s*true\s*\)/,
];

// Assertion counting is a broad source regex ON PURPOSE — never a matcher
// whitelist. A whitelist cannot know custom/jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, ...) and misreads every test using
// them as assertion-less: measured 326-334 false NO_ASSERTIONS errors per
// jest-dom repo. Covers: expect(, expect.soft(, assert(, assert.<method>(.
const ASSERTION_RE = /\b(?:expect(?:\.soft)?|assert(?:\.[A-Za-z_$][\w$]*)?)\s*\(/g;

const CONSOLE_METHODS = new Set(['log', 'debug', 'info', 'warn', 'error']);

// Weak matchers assert existence, not value — a wrong value still passes.
const WEAK_ASSERTION_METHODS = new Set([
  'toBeTruthy', 'toBeFalsy', 'toBeDefined', 'toBeUndefined', 'toBeNull', 'toBeNaN',
]);

// Matchers that verify only that a spy was called — the observable effect on
// the user/state may still be wrong.
const CALL_CONTRACT_ASSERTION_METHODS = new Set([
  'toHaveBeenCalled', 'toHaveBeenCalledTimes', 'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith', 'toHaveBeenNthCalledWith', 'toHaveBeenCalledOnce',
]);

const SNAPSHOT_METHODS = new Set(['toMatchSnapshot', 'toMatchInlineSnapshot']);
const LARGE_INLINE_SNAPSHOT_CHARS = 300;

const MOUNT_RENDER_METHODS = new Set(['mount', 'shallowMount', 'render']);

const E2E_ACTION_METHODS = new Set([
  'click', 'fill', 'goto', 'press', 'check', 'uncheck', 'selectOption',
  'type', 'hover', 'dblclick', 'dragTo', 'setInputFiles', 'tap',
]);

// Hardcoded values that rot when the seeded dataset changes: emails, UUIDs,
// long numeric ids.
const FRAGILE_TEST_DATA_PATTERNS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b\d{8,}\b/,
];

// E2E data-lifecycle heuristics — applied to ROOTED call paths only (F44:
// chains hanging off literals/expressions carry the '<expr>' sentinel and are
// excluded, so 'text'.replace(...) can never look like a data operation).
const DATA_CREATION_SUFFIXES = ['.post', '.create', '.insert', '.seed'];
const DATA_CLEANUP_SUFFIXES = ['.delete', '.cleanup', '.reset', '.truncate', '.clear'];

// Hook-body cleanup/control tokens (regex over the hook call's own source).
const MOCK_RESET_RE = /restoreAllMocks|resetAllMocks|clearAllMocks|mockRestore|mockReset/;
const TIMER_RESTORE_RE = /useRealTimers/;
const STORAGE_CLEANUP_RE = /(?:localStorage|sessionStorage)\.(?:clear|removeItem)/;
const TIMER_CONTROL_RE = /useFakeTimers|setSystemTime/;

// File-wide mock declarations (jest.mock hoists, so file scope is correct).
const HTTP_MOCK_RE = /(?:jest|vi)\.mock\(\s*['"]([^'"]+)['"]/g;
// fetch stubbed anywhere in the file (assignment, stubGlobal, spyOn, module mock).
const FETCH_STUB_RE = /\bfetch\s*=(?!=)|stubGlobal\(\s*['"]fetch['"]|spyOn\(\s*[^)]{0,60}?,\s*['"]fetch['"]|(?:jest|vi)\.mock\(\s*['"](?:node-|cross-|whatwg-)?fetch['"]/;

// quality: allow-<rule> (reason) markers — the reason inside parentheses is
// REQUIRED for the marker to count. Scope is resolved by POSITION (see
// buildAllowResolution): inside a test -> that test; directly above a
// test/describe -> that declaration; elsewhere inside a describe -> that
// describe's subtree; elsewhere -> whole file. Position-based attribution is
// what prevents a test-scoped marker from silently suppressing the rule for
// its sibling tests (the slice-regex approach leaked exactly that way).
const ALLOW_RE = {
  multiRender: /quality:\s*allow-multi-render\s*\(.+\)/i,
  fragileSelector: /quality:\s*allow-fragile-selector\s*\(.+\)/i,
  implementationCoupling: /quality:\s*allow-implementation-coupling\s*\(.+\)/i,
  fragileTestData: /quality:\s*allow-fragile-test-data\s*\(.+\)/i,
  tooManyAssertions: /quality:\s*allow-too-many-assertions\s*\(.+\)/i,
  testTooLong: /quality:\s*allow-test-too-long\s*\(.+\)/i,
  serial: /quality:\s*allow-serial\s*\(.+\)/i,
};
const ALLOW_KEYS = Object.keys(ALLOW_RE);

// Per-mode thresholds.
const MAX_ASSERTIONS_UNIT = 7;
const MAX_ASSERTIONS_E2E = 15;
const MAX_LINES_UNIT = 50;
const MAX_LINES_E2E = 100;
const MAX_TIMEOUT_MS = 100; // hardcoded timeouts at or below this are not sleeps
const MAX_E2E_ACTIONS = 12; // more actions than this with <=1 strong assert = tour, not test

/* ===================================================================== */
/* Generic helpers                                                       */
/* ===================================================================== */

function printJson(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function errorPayload(file, message) {
  return {
    file,
    tests: [],
    issues: [{ type: 'PARSE_ERROR', message, line: 1 }],
    error: message,
    summary: { testCount: 0, issueCount: 1, hasParseError: true },
  };
}

function isAstNode(value) {
  return !!value && typeof value === 'object' && typeof value.type === 'string';
}

function isFnNode(node) {
  return !!node && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression');
}

// Optional-chaining forms (a?.b(), a?.b.c) parse as Optional* node types.
// Every structural check treats them as their plain counterparts — skipping
// them silently dropped real findings (measured: 8 fragile `?.querySelector`
// selectors in one kore file).
function isCallNode(node) {
  return !!node && (node.type === 'CallExpression' || node.type === 'OptionalCallExpression');
}

function isMemberNode(node) {
  return !!node && (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression');
}

const SKIP_CHILD_KEYS = new Set([
  'loc', 'start', 'end', 'range', 'extra', 'comments',
  'leadingComments', 'trailingComments', 'innerComments', 'tokens',
]);

function collectChildren(node) {
  const children = [];
  for (const key of Object.keys(node)) {
    if (SKIP_CHILD_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isAstNode(item)) children.push(item);
      }
      continue;
    }
    if (isAstNode(value)) children.push(value);
  }
  return children;
}

function sliceOf(source, node) {
  if (!node || node.start == null || node.end == null) return '';
  return source.slice(node.start, node.end);
}

function startLine(node) {
  return (node && node.loc && node.loc.start && node.loc.start.line) || 1;
}

function normalizeTitle(value) {
  return value.replace(/\s+/g, ' ').trim();
}

// Static text of a literal, or null when the value is not statically known.
function staticText(node) {
  if (!node) return null;
  if (node.type === 'StringLiteral') return String(node.value == null ? '' : node.value);
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => (q.value.cooked != null ? q.value.cooked : q.value.raw) || '').join('');
  }
  return null;
}

// Titles: '(unnamed test)' when absent, '<dynamic-title>' when present but not
// statically resolvable. The sentinel keeps dynamic tests out of
// DUPLICATE_NAME — under the old '(unnamed test)' fallback, two unrelated
// template-titled tests collided as duplicates.
function testTitleOf(argNode) {
  if (!argNode || isFnNode(argNode)) return '(unnamed test)';
  const text = staticText(argNode);
  if (text === null) return '<dynamic-title>';
  const normalized = normalizeTitle(text);
  return normalized || '(unnamed test)';
}

function describeTitleOf(argNode) {
  if (!argNode || isFnNode(argNode)) return '';
  const text = staticText(argNode);
  if (text === null) return '<dynamic-title>';
  return normalizeTitle(text);
}

// Flatten a callee into its member chain: it.skip -> ['it','skip'];
// it.each(tbl)(...) flattens through the inner CallExpression to ['it','each'].
function getMemberChain(callee) {
  const chain = [];
  let current = callee;
  let rooted = false;

  while (current) {
    if (current.type === 'Identifier') {
      chain.unshift(current.name);
      rooted = true;
      break;
    }

    if (isMemberNode(current)) {
      if (current.computed) {
        if (current.property && current.property.type === 'StringLiteral') {
          chain.unshift(String(current.property.value || ''));
        } else {
          break;
        }
      } else if (current.property && current.property.type === 'Identifier') {
        chain.unshift(current.property.name);
      } else {
        break;
      }
      current = current.object;
      continue;
    }

    // it.each(array)(name, fn) — the callee of the outer call is itself a
    // CallExpression; keep flattening toward the root.
    if (isCallNode(current)) {
      current = current.callee;
      continue;
    }

    break;
  }

  // F44: a chain that never reached an Identifier root hangs off a literal or
  // dynamic expression — /re/.test(x), 'str'.includes(y), arr[i].test(z). The
  // walk used to return ['test'] for those, and the classifier mistook the
  // member call for a bare test() declaration (phantom test -> false
  // EMPTY_TEST). The sentinel keeps the member names available to heuristics
  // while making the root unmatchable to test/it/describe.
  if (!rooted && chain.length > 0) {
    chain.unshift('<expr>');
  }

  return chain;
}

// Dotted path when the chain is rooted in a real Identifier, else null.
function rootedPath(chain) {
  if (chain.length === 0 || chain[0] === '<expr>') return null;
  return chain.join('.');
}

function memberPropName(memberExpr) {
  if (!isMemberNode(memberExpr)) return null;
  const property = memberExpr.property;
  if (!property) return null;
  if (!memberExpr.computed && property.type === 'Identifier') return property.name;
  if (memberExpr.computed && property.type === 'StringLiteral') return property.value;
  return null;
}

/* ===================================================================== */
/* Test/describe classification (F44 + F45)                              */
/* ===================================================================== */

// Decide whether a CallExpression declares a describe block, declares a test,
// or is neither. Phantom-test bug classes covered:
//   - unrooted chains (/re/.test(x))               -> '<expr>' sentinel (F44)
//   - config/annotation modifiers (test.use, ...)  -> exclusion set (F45)
//   - inner curried call (it.each(table) alone)    -> curried check
//   - conditional/annotation skip forms
//     (test.skip(), test.skip(cond, why), test.fail(), test.fixme())
//     while keeping declaration-shaped skip/todo/fixme as isSkipped tests.
function classifyCall(node) {
  if (!node || node.type !== 'CallExpression') return null;
  const chain = getMemberChain(node.callee);
  if (chain.length === 0 || chain[0] === '<expr>') return null;
  const root = chain[0];
  if (root !== 'describe' && root !== 'it' && root !== 'test') return null;

  const modifiers = chain.slice(1);
  // it.each(table)('title', fn): the OUTER (curried) call is the declaration.
  // A direct-callee chain containing `each` is the inner it.each(table)
  // expression — evaluating it declares nothing.
  const isCurried = node.callee.type === 'CallExpression';
  if (!isCurried && modifiers.includes('each')) return null;

  const isOnly = modifiers.includes('only');
  const isSerial = modifiers.includes('serial');
  const skipLike =
    modifiers.includes('skip') || modifiers.includes('todo') || modifiers.includes('fixme');

  if (root === 'describe' || modifiers.includes('describe')) {
    return { kind: 'describe', isOnly, isSkipped: skipLike, isSerial };
  }

  for (const modifier of modifiers) {
    if (NON_DECLARATION_MODIFIERS.has(modifier)) return null; // F45
  }

  const args = node.arguments || [];
  const first = args[0];
  const titleFirst = !!first && (
    first.type === 'StringLiteral' ||
    first.type === 'TemplateLiteral' ||
    (first.type === 'Literal' && typeof first.value === 'string')
  );
  const fnLater = args.slice(1).some(isFnNode);
  const testType = root === 'it' ? 'it' : 'test';

  if (modifiers.includes('todo')) {
    // it.todo('x') is a (skipped) test; test.todo() argless declares nothing.
    if (args.length === 0) return null;
    return { kind: 'test', testType, isOnly, isSerial, isSkipped: true };
  }
  if (modifiers.includes('skip') || modifiers.includes('fixme')) {
    // Declaration shape = a title first (fn optional: title-only is a
    // disabled placeholder). test.skip() / test.skip(cond, 'reason') /
    // test.fixme(predicate, 'reason') are runtime annotations, not tests.
    if (!titleFirst) return null;
    return { kind: 'test', testType, isOnly, isSerial, isSkipped: true };
  }
  if (modifiers.includes('fail')) {
    // test.fail('title', fn) declares an expected-to-fail test (it RUNS, so
    // not skipped); argless/conditional test.fail(...) is an annotation.
    if (!titleFirst || !fnLater) return null;
    return { kind: 'test', testType, isOnly, isSerial, isSkipped: false };
  }

  return { kind: 'test', testType, isOnly, isSerial, isSkipped: false };
}

/* ===================================================================== */
/* Scope frames (file root + one per describe)                           */
/* ===================================================================== */

// Cleanup registered in lifecycle hooks, detected on the hook call's own
// source slice. Only the DIRECT statements of the scope body are scanned, and
// the resulting flags live on a frame that pushes/pops with the describe
// stack. Bug class fixed (B5): cleanup flags set on describe entry that were
// never cleared on exit suppressed GLOBAL_STATE_LEAK file-wide after the
// first describe with an afterEach.
function scanHookStatements(statements, source) {
  const flags = { mockReset: false, timerRestore: false, storageCleanup: false, timerControl: false };
  for (const stmt of statements || []) {
    if (!stmt || stmt.type !== 'ExpressionStatement') continue;
    const call = stmt.expression;
    if (!call || call.type !== 'CallExpression') continue;
    const chain = getMemberChain(call.callee);
    let hook = null;
    if (LIFECYCLE_HOOKS.has(chain[0])) hook = chain[0];
    else if ((chain[0] === 'test' || chain[0] === 'it') && LIFECYCLE_HOOKS.has(chain[1])) hook = chain[1];
    if (!hook) continue;

    const hookSource = sliceOf(source, call);
    // Leak suppression needs a PER-TEST reset; beforeAll/afterAll do not
    // prevent state bleeding between tests inside the suite.
    const perTest = hook === 'beforeEach' || hook === 'afterEach';
    if (perTest && MOCK_RESET_RE.test(hookSource)) flags.mockReset = true;
    if (perTest && TIMER_RESTORE_RE.test(hookSource)) flags.timerRestore = true;
    if (perTest && STORAGE_CLEANUP_RE.test(hookSource)) flags.storageCleanup = true;
    // Determinism control is a SETUP concern: fake timers installed in
    // beforeEach/beforeAll govern the tests below them.
    if ((hook === 'beforeEach' || hook === 'beforeAll') && TIMER_CONTROL_RE.test(hookSource)) {
      flags.timerControl = true;
    }
  }
  return flags;
}

function buildDescribeFrame(id, title, callbackNode, source, cls, parentSkipped) {
  const bodyStatements =
    callbackNode && callbackNode.body && callbackNode.body.type === 'BlockStatement'
      ? callbackNode.body.body
      : [];
  return {
    id, // null for the file root; describe frames get walk-order ids
    title,
    isSkipped: parentSkipped || cls.isSkipped,
    cleanup: scanHookStatements(bodyStatements, source),
  };
}

/* ===================================================================== */
/* File-level mock context                                               */
/* ===================================================================== */

function scanFileMocks(source) {
  const httpMockTargets = [];
  for (const match of source.matchAll(HTTP_MOCK_RE)) {
    const target = (match[1] || '').toLowerCase();
    if (target === 'axios' || target.includes('api/')) httpMockTargets.push(target);
  }
  return {
    httpMockTargets,
    axiosMocked: httpMockTargets.includes('axios'),
    fetchStubbed: FETCH_STUB_RE.test(source),
  };
}

/* ===================================================================== */
/* Matcher classification (AST-grade, whitelist-free)                    */
/* ===================================================================== */

// A matcher call is any method invoked on an expect()/expect.soft() chain
// (through .not/.resolves/.rejects), or an assert()/assert.method() call.
// Being structure-based instead of name-based means custom and jest-dom
// matchers are first-class — the whitelist fork misread them all as
// missing assertions.
function matcherInfo(callNode) {
  const callee = callNode.callee;
  if (callee && callee.type === 'Identifier' && callee.name === 'assert') {
    return { method: 'assert', expectRooted: false };
  }
  if (!isMemberNode(callee)) return null;
  const method = memberPropName(callee);
  if (!method) return null;

  let base = callee.object;
  while (isMemberNode(base)) base = base.object;

  if (isCallNode(base)) {
    const baseChain = getMemberChain(base.callee);
    if (baseChain[0] === 'expect') return { method, expectRooted: true };
    return null;
  }
  if (base && base.type === 'Identifier' && base.name === 'assert' && callee.object === base) {
    return { method, expectRooted: false }; // assert.equal(a, b) style
  }
  return null;
}

// Weak = existence-only: a wrong value still passes.
function isWeakMatcher(method, callNode) {
  if (WEAK_ASSERTION_METHODS.has(method)) return true;
  if (method !== 'toBe' && method !== 'toEqual' && method !== 'toStrictEqual') return false;
  const arg = callNode.arguments && callNode.arguments[0];
  if (!arg) return false;
  return (
    arg.type === 'BooleanLiteral' ||
    arg.type === 'NullLiteral' ||
    (arg.type === 'Identifier' && arg.name === 'undefined')
  );
}

function inlineSnapshotLength(callNode) {
  const arg = callNode.arguments && callNode.arguments[0];
  if (!arg) return 0;
  if (arg.type === 'StringLiteral') return (arg.value || '').length;
  if (arg.type === 'TemplateLiteral') {
    return arg.quasis
      .map((q) => (q.value.cooked != null ? q.value.cooked : q.value.raw) || '')
      .join('').length;
  }
  return 0;
}

/* ===================================================================== */
/* Test body analysis (AST walk — in-body issues get precise lines)      */
/* ===================================================================== */

function newSignals() {
  return {
    consoleLine: 0,
    timeoutEvents: [], // { line, value: number|null, isWaitForTimeout }
    matcherTotal: 0,
    weakCount: 0,
    strongCount: 0,
    hasCallContractAssertion: false,
    hasObservableAssertion: false,
    snapshotCount: 0,
    hasLargeInlineSnapshot: false,
    mountRenderCount: 0,
    couplingSignal: null,
    fragileSelector: null,
    directNetwork: false,
    networkSignals: new Set(),
    httpMockCallContract: false,
    nondetSignals: new Set(),
    hasDeterministicControl: false,
    storageMutation: false,
    storageCleanup: false,
    fakeTimers: false,
    timerRestore: false,
    spyMutation: false,
    mockReset: false,
    actionCount: 0,
    dataCreation: false,
    dataCleanup: false,
    fragileDataSignals: new Set(),
  };
}

function analyzeBody(callbackNode, source, isE2E, fileMocks) {
  const sig = newSignals();
  if (!callbackNode) return sig;

  const walk = (node) => {
    if (!isAstNode(node)) return;
    const line = startLine(node);

    // wrapper.vm.* — the test reaches into component internals instead of
    // observable output; refactors that keep behavior break the test.
    if (!isE2E && isMemberNode(node)) {
      const obj = node.object;
      if (
        isMemberNode(obj) &&
        obj.object && obj.object.type === 'Identifier' && obj.object.name === 'wrapper' &&
        memberPropName(obj) === 'vm'
      ) {
        if (!sig.couplingSignal) sig.couplingSignal = 'wrapper.vm';
      }
    }

    // new Date() WITHOUT args is wall-clock (nondeterministic); new Date(ts)
    // with a fixed timestamp is deterministic and must not flag.
    if (
      !isE2E && node.type === 'NewExpression' &&
      node.callee && node.callee.type === 'Identifier' && node.callee.name === 'Date' &&
      (node.arguments || []).length === 0
    ) {
      sig.nondetSignals.add('new Date()');
    }

    // Hardcoded fixture values (emails/uuids/long ids) rot when seed data
    // changes; URLs are exempt.
    if (
      isE2E &&
      (node.type === 'StringLiteral' ||
        (node.type === 'TemplateLiteral' && node.expressions.length === 0))
    ) {
      const value = staticText(node) || '';
      if (value && !value.toLowerCase().startsWith('http')) {
        for (const pattern of FRAGILE_TEST_DATA_PATTERNS) {
          if (pattern.test(value)) {
            sig.fragileDataSignals.add(value.length > 40 ? value.slice(0, 37) + '...' : value);
            break;
          }
        }
      }
    }

    if (isCallNode(node)) {
      const callee = node.callee;
      const prop = memberPropName(callee);
      const objName =
        isMemberNode(callee) && callee.object && callee.object.type === 'Identifier'
          ? callee.object.name
          : null;

      // Forgotten debug output.
      if (objName === 'console' && prop && CONSOLE_METHODS.has(prop) && !sig.consoleLine) {
        sig.consoleLine = line;
      }

      // Fixed sleeps hide race conditions and slow the suite; runner config
      // calls (test/jest/vi.setTimeout) are not sleeps.
      if (prop === 'setTimeout' || (callee && callee.type === 'Identifier' && callee.name === 'setTimeout')) {
        const isRunnerConfig = objName === 'test' || objName === 'jest' || objName === 'vi';
        if (!isRunnerConfig) {
          const arg0 = node.arguments && node.arguments[0];
          if (arg0 && arg0.type === 'NumericLiteral') {
            sig.timeoutEvents.push({ line, value: arg0.value, isWaitForTimeout: false });
          }
        }
      }
      if (prop === 'waitForTimeout') {
        const arg0 = node.arguments && node.arguments[0];
        sig.timeoutEvents.push({
          line,
          value: arg0 && arg0.type === 'NumericLiteral' ? arg0.value : null,
          isWaitForTimeout: true,
        });
      }

      const matcher = matcherInfo(node);
      if (matcher) {
        sig.matcherTotal += 1;
        if (isWeakMatcher(matcher.method, node)) sig.weakCount += 1;
        else sig.strongCount += 1;
        if (matcher.expectRooted && CALL_CONTRACT_ASSERTION_METHODS.has(matcher.method)) {
          sig.hasCallContractAssertion = true;
        } else {
          sig.hasObservableAssertion = true;
        }
        if (matcher.expectRooted && SNAPSHOT_METHODS.has(matcher.method)) {
          sig.snapshotCount += 1;
          if (
            matcher.method === 'toMatchInlineSnapshot' &&
            inlineSnapshotLength(node) > LARGE_INLINE_SNAPSHOT_CHARS
          ) {
            sig.hasLargeInlineSnapshot = true;
          }
        }
      }

      if (!isE2E) {
        // Multiple component instances in one test = several tests glued
        // together; failures stop isolating.
        if (callee && callee.type === 'Identifier' && MOUNT_RENDER_METHODS.has(callee.name)) {
          sig.mountRenderCount += 1;
        } else if (prop && MOUNT_RENDER_METHODS.has(prop)) {
          sig.mountRenderCount += 1;
        }

        // Enzyme-style .instance() — implementation internals.
        if (prop === 'instance' && (node.arguments || []).length === 0 && !sig.couplingSignal) {
          sig.couplingSignal = '.instance()';
        }

        // Class/id/DOM selectors break on styling refactors that keep
        // behavior intact.
        if (prop === 'find') {
          const selector = staticText(node.arguments && node.arguments[0]);
          if (selector && (selector.startsWith('.') || selector.startsWith('#')) && !sig.fragileSelector) {
            sig.fragileSelector = ".find('" + selector + "')";
          }
        }
        if ((prop === 'querySelector' || prop === 'querySelectorAll') && !sig.fragileSelector) {
          sig.fragileSelector = prop;
        }

        // Real HTTP from a unit test = flaky + slow + environment-coupled.
        if (callee && callee.type === 'Identifier' && callee.name === 'fetch' && !fileMocks.fetchStubbed) {
          sig.directNetwork = true;
          sig.networkSignals.add('fetch');
        }
        if (
          ((callee && callee.type === 'Identifier' && callee.name === 'axios') || objName === 'axios') &&
          !fileMocks.axiosMocked
        ) {
          sig.directNetwork = true;
          sig.networkSignals.add('axios');
        }

        // Global state leaks: what a test mutates it must restore, or the
        // NEXT test inherits the state and passes/fails by ordering.
        if (objName === 'localStorage' || objName === 'sessionStorage') {
          if (prop === 'setItem') sig.storageMutation = true;
          if (prop === 'removeItem' || prop === 'clear') sig.storageCleanup = true;
        }

        if (objName === 'Date' && prop === 'now') sig.nondetSignals.add('Date.now');
        if (objName === 'Math' && prop === 'random') sig.nondetSignals.add('Math.random');

        if (objName === 'jest' || objName === 'vi') {
          if (prop === 'useFakeTimers') {
            sig.fakeTimers = true;
            sig.hasDeterministicControl = true;
          }
          if (prop === 'useRealTimers') sig.timerRestore = true;
          if (prop === 'setSystemTime') sig.hasDeterministicControl = true;
          if (prop === 'spyOn') {
            sig.spyMutation = true;
            const target = node.arguments && node.arguments[0];
            if (target && target.type === 'Identifier' && (target.name === 'Date' || target.name === 'Math')) {
              sig.hasDeterministicControl = true;
            }
          }
          if (prop === 'restoreAllMocks' || prop === 'resetAllMocks' || prop === 'clearAllMocks') {
            sig.mockReset = true;
          }
          if (prop === 'mock') {
            const target = (staticText(node.arguments && node.arguments[0]) || '').toLowerCase();
            if (target === 'axios' || target.includes('api/')) {
              sig.httpMockCallContract = true;
              sig.networkSignals.add('mock(' + target + ')');
            }
          }
        }
        if (prop === 'mockRestore' || prop === 'mockReset') sig.mockReset = true;
      } else {
        // Interaction density for the tour-not-test heuristic.
        if (prop && E2E_ACTION_METHODS.has(prop)) sig.actionCount += 1;

        // Data lifecycle suffixes on rooted call paths only (F44 sentinel
        // keeps literal-rooted chains out).
        const dotted = rootedPath(getMemberChain(callee));
        if (dotted) {
          const lowered = dotted.toLowerCase();
          if (DATA_CREATION_SUFFIXES.some((s) => lowered.endsWith(s))) sig.dataCreation = true;
          if (DATA_CLEANUP_SUFFIXES.some((s) => lowered.endsWith(s))) sig.dataCleanup = true;
        }
      }
    }

    for (const child of collectChildren(node)) walk(child);
  };

  walk(callbackNode.body || callbackNode);
  return sig;
}

/* ===================================================================== */
/* Test record construction                                              */
/* ===================================================================== */

function buildTestRecord(context, callNode, cls, frames) {
  const { source, isE2E, fileMocks } = context;
  const args = callNode.arguments || [];
  const title = testTitleOf(args[0]);
  const callback = args.find(isFnNode) || null;

  const line = startLine(callNode);
  let endLine = (callNode.loc && callNode.loc.end && callNode.loc.end.line) || line;
  if (callback && callback.body && callback.body.loc && callback.body.loc.end) {
    endLine = callback.body.loc.end.line || endLine;
  }
  const numLines = Math.max(1, endLine - line + 1);

  const blockNode = callback ? (callback.body || callback) : callNode;
  const blockText = sliceOf(source, blockNode);

  const assertionMatches = blockText.match(ASSERTION_RE);
  const assertionCount = assertionMatches ? assertionMatches.length : 0;

  const isEmpty =
    !callback ||
    !callback.body ||
    (callback.body.type === 'BlockStatement' && callback.body.body.length === 0);

  const describeTitles = frames.map((f) => f.title).filter(Boolean);
  const describeBlock = describeTitles.length > 0 ? describeTitles.join(' > ') : null;
  const fullContext = describeBlock ? describeBlock + ' > ' + title : title;

  // describe.skip/todo propagates: tests inside a skipped suite do not run,
  // so they must not fire runtime-shape issues (EMPTY_TEST/NO_ASSERTIONS).
  const effectiveSkipped = cls.isSkipped || frames.some((f) => f.isSkipped);

  const signals = analyzeBody(callback, source, isE2E, fileMocks);

  // jest.mock hoists: file-level HTTP-boundary mocks apply to every test.
  if (fileMocks.httpMockTargets.length > 0) {
    signals.httpMockCallContract = true;
    for (const target of fileMocks.httpMockTargets) {
      signals.networkSignals.add('mock(' + target + ')');
    }
  }

  const frameCleanup = {
    mockReset: frames.some((f) => f.cleanup.mockReset),
    timerRestore: frames.some((f) => f.cleanup.timerRestore),
    storageCleanup: frames.some((f) => f.cleanup.storageCleanup),
    timerControl: frames.some((f) => f.cleanup.timerControl),
  };

  const numericTimeouts = signals.timeoutEvents.filter((e) => e.value !== null);
  const timeoutValue = numericTimeouts.length > 0 ? Math.max(...numericTimeouts.map((e) => e.value)) : 0;
  const usesWaitForTimeout = signals.timeoutEvents.some((e) => e.isWaitForTimeout);

  return {
    test: {
      name: title,
      fullContext,
      line,
      endLine,
      numLines,
      type: cls.testType,
      isSkipped: effectiveSkipped,
      isOnly: cls.isOnly,
      hasAssertions: assertionCount > 0,
      assertionCount,
      hasConsoleLog: signals.consoleLine > 0,
      hasHardcodedTimeout: timeoutValue > MAX_TIMEOUT_MS || (isE2E && usesWaitForTimeout),
      timeoutValue,
      isEmpty,
      describeBlock,
    },
    blockText,
    signals,
    frameCleanup,
    callRange: { start: callNode.start, end: callNode.end },
    frameIds: frames.filter((f) => f.id !== null).map((f) => f.id),
    // Dynamic/unnamed identity is not statically comparable — keep it out of
    // DUPLICATE_NAME instead of colliding every dynamic title into one key.
    excludeFromDuplicates:
      title === '<dynamic-title>' ||
      title === '(unnamed test)' ||
      describeTitles.indexOf('<dynamic-title>') !== -1,
  };
}

/* ===================================================================== */
/* Issue assembly                                                        */
/* ===================================================================== */

function assembleTestIssues(record, isE2E, allowed) {
  const issues = [];
  const t = record.test;
  const sig = record.signals;
  const id = t.fullContext;

  if (GENERIC_TITLES.has(t.name.toLowerCase())) {
    issues.push({
      type: 'POOR_NAMING',
      message: "Generic test title: '" + t.name + "'",
      line: t.line,
      identifier: t.name,
      suggestion: "Use descriptive name: 'should <action> when <condition>'",
    });
  }

  const tokenMatch = t.name.match(FORBIDDEN_TOKEN_RE);
  if (tokenMatch) {
    issues.push({
      type: 'FORBIDDEN_TOKEN',
      message: 'Forbidden token "' + tokenMatch[1] + '" in test title',
      line: t.line,
      identifier: t.name,
    });
  }

  // Skipped tests do not run: their empty/assertion-less bodies are inert by
  // definition and must not fire (it.todo has no body by design).
  if (!t.isSkipped && t.isEmpty) {
    issues.push({
      type: 'EMPTY_TEST',
      message: 'Test body is empty',
      line: t.line,
      identifier: id,
      suggestion: 'Add meaningful test logic and assertions',
    });
  }
  if (!t.isSkipped && !t.isEmpty && !t.hasAssertions) {
    issues.push({
      type: 'NO_ASSERTIONS',
      message: 'Test has no assertions',
      line: t.line,
      identifier: id,
      suggestion: 'Add assertions that verify observable behavior',
    });
  }

  for (const pattern of USELESS_ASSERTION_PATTERNS) {
    if (pattern.test(record.blockText)) {
      issues.push({
        type: 'USELESS_ASSERTION',
        message: 'Test contains useless assertion',
        line: t.line,
        identifier: id,
        suggestion: 'Replace with behavior-focused assertions',
      });
      break;
    }
  }

  const assertionLimit = isE2E ? MAX_ASSERTIONS_E2E : MAX_ASSERTIONS_UNIT;
  if (t.assertionCount > assertionLimit && !allowed('tooManyAssertions')) {
    issues.push({
      type: 'TOO_MANY_ASSERTIONS',
      message: 'Too many assertions (' + t.assertionCount + ' > ' + assertionLimit + ')',
      line: t.line,
      identifier: id,
      suggestion: 'Split into smaller focused tests, or add quality: allow-too-many-assertions (reason)',
    });
  }

  const lineLimit = isE2E ? MAX_LINES_E2E : MAX_LINES_UNIT;
  if (t.numLines > lineLimit && !allowed('testTooLong')) {
    issues.push({
      type: 'TEST_TOO_LONG',
      message: 'Test too long (' + t.numLines + ' lines > ' + lineLimit + ')',
      line: t.line,
      identifier: id,
      suggestion: 'Extract helpers or split into focused tests, or add quality: allow-test-too-long (reason)',
    });
  }

  // Issue points at the offending statement, not the test header — a 120-line
  // test with one console.log should send the reader to the right line.
  if (sig.consoleLine > 0) {
    issues.push({
      type: 'CONSOLE_LOG',
      message: 'Test contains console.log/debug statements',
      line: sig.consoleLine,
      identifier: id,
      suggestion: 'Remove console statements from tests',
    });
  }

  const sleepEvents = sig.timeoutEvents.filter(
    (e) => !e.isWaitForTimeout && e.value !== null && e.value > MAX_TIMEOUT_MS,
  );
  const unitWaitEvents = sig.timeoutEvents.filter(
    (e) => e.isWaitForTimeout && e.value !== null && e.value > MAX_TIMEOUT_MS,
  );
  if (isE2E) {
    if (sleepEvents.length > 0) {
      const worst = sleepEvents.reduce((a, b) => (b.value > a.value ? b : a));
      issues.push({
        type: 'HARDCODED_TIMEOUT',
        message: 'Test uses hardcoded timeout (' + worst.value + 'ms)',
        line: worst.line,
        identifier: id,
        suggestion: 'Use condition-based waits instead of fixed delays',
      });
    }
    const wait = sig.timeoutEvents.find((e) => e.isWaitForTimeout);
    if (wait) {
      issues.push({
        type: 'WAIT_FOR_TIMEOUT',
        message: wait.value !== null
          ? 'waitForTimeout(' + wait.value + ') used - brittle wait strategy'
          : 'waitForTimeout used - brittle wait strategy',
        line: wait.line,
        identifier: id,
        suggestion: 'Use web-first assertions (expect) or explicit waitForURL/waitForResponse predicates',
      });
    }
  } else {
    const candidates = sleepEvents.concat(unitWaitEvents);
    if (candidates.length > 0) {
      const worst = candidates.reduce((a, b) => (b.value > a.value ? b : a));
      issues.push({
        type: 'HARDCODED_TIMEOUT',
        message: 'Test uses hardcoded timeout (' + worst.value + 'ms)',
        line: worst.line,
        identifier: id,
        suggestion: 'Use waitFor()/findBy* instead of fixed delays',
      });
    }
  }

  if (!isE2E) {
    if (sig.mountRenderCount > 1 && !allowed('multiRender')) {
      issues.push({
        type: 'MULTI_RENDER',
        message: 'Multiple mount/render calls in one test (' + sig.mountRenderCount + ')',
        line: t.line,
        identifier: id,
        suggestion: 'Split the test or document exception with quality: allow-multi-render (reason)',
      });
    }

    if (sig.couplingSignal && !allowed('implementationCoupling')) {
      issues.push({
        type: 'IMPLEMENTATION_COUPLING',
        message: 'Test asserts implementation internals (' + sig.couplingSignal + ') instead of observable behavior',
        line: t.line,
        identifier: id,
        suggestion: 'Prefer user-observable assertions, or add quality: allow-implementation-coupling (reason)',
      });
    }

    if (sig.fragileSelector && !allowed('fragileSelector')) {
      issues.push({
        type: 'FRAGILE_SELECTOR',
        message: 'Fragile unit selector detected (' + sig.fragileSelector + ')',
        line: t.line,
        identifier: id,
        suggestion: 'Prefer resilient selectors (role, label, testid), or add quality: allow-fragile-selector (reason)',
      });
    }

    // Two shapes of the same boundary problem: real HTTP from a unit test,
    // or a mocked HTTP boundary asserted ONLY through the call contract
    // (spy was called) with no observable outcome. The exact fragment
    // "without observable outcome" is load-bearing: the unit analyzer
    // downgrades severity on that literal string.
    const contractOnly =
      sig.httpMockCallContract && sig.hasCallContractAssertion && !sig.hasObservableAssertion;
    if (sig.directNetwork || contractOnly) {
      const signalText = Array.from(sig.networkSignals).join(', ') || 'network call';
      issues.push({
        type: 'NETWORK_DEPENDENCY',
        message: contractOnly
          ? 'HTTP mock assertion without observable outcome (' + signalText + ')'
          : 'Direct network dependency in unit test (' + signalText + ')',
        line: t.line,
        identifier: id,
        suggestion: contractOnly
          ? 'Add assertions for user-visible state/behavior, not only call contract'
          : 'Mock network boundary and assert observable outcomes',
      });
    }

    if (
      sig.nondetSignals.size > 0 &&
      !sig.hasDeterministicControl &&
      !record.frameCleanup.timerControl
    ) {
      issues.push({
        type: 'NONDETERMINISTIC',
        message:
          'Non-deterministic source without explicit control (' +
          Array.from(sig.nondetSignals).join(', ') + ')',
        line: t.line,
        identifier: id,
        suggestion: 'Use fake timers/setSystemTime or deterministic mocks/seeds',
      });
    }

    if (sig.storageMutation && !sig.storageCleanup && !record.frameCleanup.storageCleanup) {
      issues.push({
        type: 'GLOBAL_STATE_LEAK',
        message: 'localStorage/sessionStorage mutation without cleanup in test',
        line: t.line,
        identifier: id,
        suggestion: 'Cleanup storage state with removeItem/clear in the same test lifecycle',
      });
    }
    if (sig.fakeTimers && !sig.timerRestore && !record.frameCleanup.timerRestore) {
      issues.push({
        type: 'GLOBAL_STATE_LEAK',
        message: 'useFakeTimers() without corresponding useRealTimers()',
        line: t.line,
        identifier: id,
        suggestion: 'Restore timers to avoid leaking fake timer state across tests',
      });
    }
    if (sig.spyMutation && !sig.mockReset && !record.frameCleanup.mockReset) {
      issues.push({
        type: 'GLOBAL_STATE_LEAK',
        message: 'Global mock/spyOn mutation without reset/restore in test',
        line: t.line,
        identifier: id,
        suggestion: 'Call restoreAllMocks/resetAllMocks or mockRestore/mockReset after mutation',
      });
    }

    // Snapshot-only tests approve whatever the component currently renders;
    // giant inline snapshots do the same while bloating the file.
    if (sig.snapshotCount > 0 && sig.matcherTotal > 0 && sig.snapshotCount === sig.matcherTotal) {
      issues.push({
        type: 'SNAPSHOT_OVERRELIANCE',
        message: 'Snapshot-only assertions detected without complementary semantic assertions',
        line: t.line,
        identifier: id,
        suggestion: 'Add behavior-oriented assertions alongside snapshots',
      });
    } else if (sig.hasLargeInlineSnapshot) {
      issues.push({
        type: 'SNAPSHOT_OVERRELIANCE',
        message: 'Large inline snapshot detected; prefer focused semantic assertions',
        line: t.line,
        identifier: id,
        suggestion: 'Reduce snapshot size and complement with targeted expect(...) checks',
      });
    }
  } else {
    // Weak-only assertions in a browser test = the flow "passed" without
    // verifying any concrete user-visible state.
    if (sig.weakCount > 0 && sig.strongCount === 0) {
      issues.push({
        type: 'VAGUE_ASSERTION',
        message:
          'E2E test relies on weak assertions (' + sig.weakCount +
          ') without strict state verification',
        line: t.line,
        identifier: id,
        suggestion: 'Prefer strict assertions (toHaveURL/toHaveText/toHaveValue) over truthy/falsy checks',
      });
    }

    // Many actions with at most one strong assertion is a tour, not a test:
    // it can click through a broken flow and still pass.
    if (sig.actionCount > MAX_E2E_ACTIONS && sig.strongCount <= 1) {
      issues.push({
        type: 'EXCESSIVE_STEPS',
        message:
          'Long E2E sequence (' + sig.actionCount +
          ' actions) with low strong-assert density (' + sig.strongCount + ')',
        line: t.line,
        identifier: id,
        suggestion: 'Split flow or add stronger verification checkpoints',
      });
    }

    if (sig.fragileDataSignals.size > 0 && !allowed('fragileTestData')) {
      issues.push({
        type: 'FRAGILE_TEST_DATA',
        message:
          'Potentially fragile hardcoded test data detected (' +
          Array.from(sig.fragileDataSignals).slice(0, 2).join(', ') + ')',
        line: t.line,
        identifier: id,
        suggestion: 'Prefer generated fixtures or scenario builders for stable data',
      });
    }

    // Created data with no cleanup signal pollutes the environment the next
    // spec runs against.
    if (sig.dataCreation && !sig.dataCleanup) {
      issues.push({
        type: 'DATA_ISOLATION',
        message: 'E2E test appears to create data without explicit cleanup/reset signal',
        line: t.line,
        identifier: id,
        suggestion: 'Ensure data lifecycle cleanup/reset or isolated fixture strategy',
      });
    }
  }

  return issues;
}

/* ===================================================================== */
/* File walk                                                             */
/* ===================================================================== */

function walkProgram(ast, context) {
  const records = [];
  const serialDescribes = [];
  const describeRegions = []; // { id, start, end } for marker attribution
  let nextFrameId = 1;

  const visit = (node, frames) => {
    if (!isAstNode(node)) return;

    if (node.type === 'CallExpression') {
      const cls = classifyCall(node);

      if (cls && cls.kind === 'describe') {
        const args = node.arguments || [];
        const title = describeTitleOf(args[0]);
        const callback = args.find(isFnNode) || null;
        const frameId = nextFrameId++;
        if (node.start != null && node.end != null) {
          describeRegions.push({ id: frameId, start: node.start, end: node.end });
        }

        if (context.isE2E && cls.isSerial) {
          serialDescribes.push({
            line: startLine(node),
            title,
            // self + ancestors: an allow-serial marker scoped to any of these
            // describes documents this serial chain.
            scopeIds: frames.filter((f) => f.id !== null).map((f) => f.id).concat(frameId),
          });
        }

        if (callback) {
          const frame = buildDescribeFrame(
            frameId, title, callback, context.source, cls,
            frames.some((f) => f.isSkipped),
          );
          const nextFrames = frames.concat(frame);
          if (callback.body && callback.body.type === 'BlockStatement') {
            for (const statement of callback.body.body) visit(statement, nextFrames);
          } else {
            visit(callback.body || callback, nextFrames);
          }
        }
        for (const arg of node.arguments || []) {
          if (arg !== args[0] && arg !== callback) visit(arg, frames);
        }
        return;
      }

      if (cls && cls.kind === 'test') {
        // Test calls are leaves for DISCOVERY (a nested it() inside a test
        // body is a runtime error in every supported runner) but their body
        // IS walked — by analyzeBody inside buildTestRecord — so in-body
        // issues (console/timeouts/leaks/...) are AST-detected with lines.
        records.push(buildTestRecord(context, node, cls, frames));
        return;
      }
    }

    for (const child of collectChildren(node)) visit(child, frames);
  };

  const program = ast.program || ast;
  const rootFrame = {
    id: null,
    title: null,
    isSkipped: false,
    cleanup: scanHookStatements(program.body, context.source),
  };
  visit(program, [rootFrame]);

  return { records, serialDescribes, describeRegions };
}

/* ===================================================================== */
/* Allow-marker scope attribution                                        */
/* ===================================================================== */

// Resolve every `quality: allow-<rule> (reason)` marker to a scope by source
// position:
//   1. inside a test call            -> that test only
//   2. directly above a declaration
//      (only comments/whitespace in
//      between)                      -> that test / that describe subtree
//   3. inside a describe otherwise   -> that describe subtree
//   4. anywhere else                 -> whole file
// allow-serial attributed to a test is promoted to the test's innermost
// describe: serial is a describe-level property, and the natural placement
// ("first line inside the serial block") would otherwise land on a test.
function buildAllowResolution(source, records, describeRegions) {
  const decls = [];
  records.forEach((record, index) => {
    if (record.callRange.start != null && record.callRange.end != null) {
      decls.push({
        kind: 'test',
        key: index,
        start: record.callRange.start,
        end: record.callRange.end,
      });
    }
  });
  for (const region of describeRegions) {
    decls.push({ kind: 'describe', key: region.id, start: region.start, end: region.end });
  }

  const fileAllow = {};
  for (const key of ALLOW_KEYS) fileAllow[key] = false;
  const describeAllow = new Map(); // describe id -> Set(rule keys)
  const testAllow = new Map(); // record index -> Set(rule keys)

  const addDescribe = (id, key) => {
    if (!describeAllow.has(id)) describeAllow.set(id, new Set());
    describeAllow.get(id).add(key);
  };
  const addTest = (index, key) => {
    if (key === 'serial') {
      // promote (see header comment)
      const frameIds = records[index].frameIds;
      if (frameIds.length > 0) addDescribe(frameIds[frameIds.length - 1], key);
      else fileAllow[key] = true;
      return;
    }
    if (!testAllow.has(index)) testAllow.set(index, new Set());
    testAllow.get(index).add(key);
  };

  const gapIsInert = (from, to) => {
    if (to < from) return false;
    const gap = source.slice(from, to);
    return gap.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim() === '';
  };

  for (const key of ALLOW_KEYS) {
    const base = ALLOW_RE[key];
    const re = new RegExp(base.source, base.flags.includes('g') ? base.flags : base.flags + 'g');
    let match;
    while ((match = re.exec(source)) !== null) {
      const at = match.index;
      const end = re.lastIndex;

      let container = null;
      for (const decl of decls) {
        if (decl.start <= at && end <= decl.end) {
          if (!container || decl.end - decl.start < container.end - container.start) {
            container = decl;
          }
        }
      }
      if (container && container.kind === 'test') {
        addTest(container.key, key);
        continue;
      }

      let next = null;
      for (const decl of decls) {
        if (decl.start >= end && (!next || decl.start < next.start)) next = decl;
      }
      if (next && gapIsInert(end, next.start)) {
        if (next.kind === 'test') addTest(next.key, key);
        else addDescribe(next.key, key);
        continue;
      }

      if (container) {
        addDescribe(container.key, key);
        continue;
      }
      fileAllow[key] = true;
    }
  }

  return { fileAllow, describeAllow, testAllow };
}

function allowCheckerFor(resolution, record, index) {
  return (key) => {
    if (resolution.fileAllow[key]) return true;
    const own = resolution.testAllow.get(index);
    if (own && own.has(key)) return true;
    for (const frameId of record.frameIds) {
      const set = resolution.describeAllow.get(frameId);
      if (set && set.has(key)) return true;
    }
    return false;
  };
}

/* ===================================================================== */
/* Entry                                                                 */
/* ===================================================================== */

function parseTestFile(filePath, isE2E) {
  const absolutePath = path.resolve(filePath);
  const source = fs.readFileSync(absolutePath, 'utf8');

  let ast;
  try {
    ast = babelParser.parse(source, {
      sourceType: 'unambiguous',
      errorRecovery: false,
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'objectRestSpread',
        'dynamicImport',
        'decorators-legacy',
        'topLevelAwait',
      ],
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    return {
      file: absolutePath,
      tests: [],
      issues: [{
        type: 'PARSE_ERROR',
        message,
        line: (error && error.loc && error.loc.line) || 1,
      }],
      error: message,
      summary: { testCount: 0, issueCount: 1, hasParseError: true },
    };
  }

  const context = { source, isE2E, fileMocks: scanFileMocks(source) };
  const { records, serialDescribes, describeRegions } = walkProgram(ast, context);
  const allowResolution = buildAllowResolution(source, records, describeRegions);

  const issues = [];

  // Forbidden tokens in the FILE name — coverage-farming artifacts announce
  // themselves in the filename before any test title does.
  const baseName = path.basename(absolutePath);
  const fileNameMatch = baseName.match(FORBIDDEN_TOKEN_RE);
  if (fileNameMatch) {
    issues.push({
      type: 'FORBIDDEN_TOKEN',
      message: 'Forbidden token "' + fileNameMatch[1] + '" in file name',
      line: 1,
      identifier: baseName,
    });
  }

  // Serial mode chains specs so one failure cascades; it needs a documented
  // reason to exist.
  for (const d of serialDescribes) {
    const documented =
      allowResolution.fileAllow.serial ||
      d.scopeIds.some((id) => {
        const set = allowResolution.describeAllow.get(id);
        return set && set.has('serial');
      });
    if (!documented) {
      issues.push({
        type: 'SERIAL_WITHOUT_REASON',
        message: 'test.describe.serial used without documented reason',
        line: d.line,
        identifier: d.title || 'test.describe.serial',
        suggestion: 'Document reason with quality: allow-serial (reason)',
      });
    }
  }

  const tests = [];
  records.forEach((record, index) => {
    tests.push(record.test);
    issues.push(...assembleTestIssues(record, isE2E, allowCheckerFor(allowResolution, record, index)));
  });

  // Duplicate titles keyed on the FULL describe path — same leaf title under
  // different describes is legitimate; bare-title keying flagged it anyway.
  const seenTitles = new Map();
  for (const record of records) {
    if (record.excludeFromDuplicates) continue;
    const key = record.test.fullContext;
    if (!seenTitles.has(key)) seenTitles.set(key, []);
    seenTitles.get(key).push(record.test.line);
  }
  for (const [key, lines] of seenTitles.entries()) {
    if (lines.length > 1) {
      issues.push({
        type: 'DUPLICATE_NAME',
        message: "Duplicate test name: '" + key + "'",
        line: lines[0],
        identifier: key,
        suggestion: 'Appears on lines ' + lines.join(', '),
      });
    }
  }

  return {
    file: absolutePath,
    tests,
    issues,
    error: null,
    summary: {
      testCount: tests.length,
      issueCount: issues.length,
      hasParseError: false,
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => !arg.startsWith('-'));
  const isE2E = args.includes('--e2e');

  if (!fileArg) {
    printJson(errorPayload('', 'Missing file path argument'));
    return;
  }
  const displayPath = path.resolve(fileArg);
  if (!babelParser) {
    printJson(errorPayload(displayPath, dependencyError));
    return;
  }
  try {
    printJson(parseTestFile(fileArg, isE2E));
  } catch (error) {
    printJson(errorPayload(displayPath, String(error && error.message ? error.message : error)));
  }
}

main();
