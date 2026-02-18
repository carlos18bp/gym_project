#!/usr/bin/env node
/**
 * AST Parser for JavaScript/TypeScript test files.
 * 
 * Parses test files using @babel/parser and extracts structured information
 * about test blocks (describe, it, test) for quality analysis.
 * 
 * Usage:
 *   node ast-parser.cjs <file.test.js>
 *   node ast-parser.cjs <file.spec.js> --e2e
 * 
 * Output: JSON to stdout with test structure and quality indicators.
 */

const fs = require('fs');
const path = require('path');

let parser;
let traverse;

try {
  parser = require('@babel/parser');
  traverse = require('@babel/traverse').default;
} catch (e) {
  console.error(JSON.stringify({
    error: 'Missing dependencies. Run: npm install @babel/parser @babel/traverse',
    file: process.argv[2] || 'unknown',
  }));
  process.exit(1);
}

const ASSERTION_METHODS = new Set([
  // Jest/Vitest expect
  'toBe', 'toEqual', 'toStrictEqual', 'toBeTruthy', 'toBeFalsy',
  'toBeNull', 'toBeUndefined', 'toBeDefined', 'toBeNaN',
  'toContain', 'toContainEqual', 'toHaveLength', 'toHaveProperty',
  'toMatch', 'toMatchObject', 'toMatchSnapshot', 'toMatchInlineSnapshot',
  'toThrow', 'toThrowError', 'toThrowErrorMatchingSnapshot',
  'toHaveBeenCalled', 'toHaveBeenCalledTimes', 'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith', 'toHaveBeenNthCalledWith',
  'toHaveReturned', 'toHaveReturnedTimes', 'toHaveReturnedWith',
  'resolves', 'rejects',
  // Playwright expect
  'toHaveURL', 'toHaveTitle', 'toHaveText', 'toHaveValue',
  'toBeVisible', 'toBeHidden', 'toBeEnabled', 'toBeDisabled',
  'toBeChecked', 'toBeEmpty', 'toBeFocused', 'toHaveCount',
  'toHaveAttribute', 'toHaveClass', 'toHaveCSS', 'toHaveId',
  'toHaveScreenshot', 'toPass',
]);

const WEAK_ASSERTION_METHODS = new Set([
  'toBeTruthy',
  'toBeFalsy',
  'toBeDefined',
  'toBeUndefined',
  'toBeNull',
  'toBeNaN',
]);

const USELESS_ASSERTIONS = [
  'expect(true).toBe(true)',
  'expect(1).toBe(1)',
  'expect(true).toBeTruthy()',
  'expect(false).toBeFalsy()',
];

const BANNED_TOKENS = ['batch', 'coverage', 'cov', 'deep'];
const BANNED_TOKENS_REGEX = new RegExp(`\\b(${BANNED_TOKENS.join('|')})\\b`, 'i');
const GENERIC_TITLES = ['it works', 'should work', 'test', 'works', 'does something'];

const CALL_CONTRACT_ASSERTION_METHODS = new Set([
  'toHaveBeenCalled',
  'toHaveBeenCalledTimes',
  'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith',
  'toHaveBeenNthCalledWith',
]);

const MOUNT_RENDER_METHODS = new Set(['mount', 'shallowMount', 'render']);

const E2E_ACTION_METHODS = new Set([
  'click',
  'fill',
  'goto',
  'press',
  'check',
  'uncheck',
  'selectOption',
  'type',
  'hover',
  'dblclick',
  'dragTo',
  'setInputFiles',
  'tap',
]);

const FRAGILE_TEST_DATA_PATTERNS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b\d{8,}\b/,
];

function getPropertyName(propertyNode) {
  if (!propertyNode || typeof propertyNode !== 'object') return null;
  if (propertyNode.type === 'Identifier') return propertyNode.name;
  if (propertyNode.type === 'StringLiteral') return propertyNode.value;
  return null;
}

function getStaticString(argumentNode) {
  if (!argumentNode || typeof argumentNode !== 'object') return '';
  if (argumentNode.type === 'StringLiteral') return argumentNode.value || '';
  if (argumentNode.type === 'TemplateLiteral' && argumentNode.expressions.length === 0) {
    return argumentNode.quasis?.[0]?.value?.cooked || argumentNode.quasis?.[0]?.value?.raw || '';
  }
  return '';
}

function isWeakAssertion(propertyName, assertionCallNode) {
  if (!propertyName || !assertionCallNode || assertionCallNode.type !== 'CallExpression') {
    return false;
  }

  if (WEAK_ASSERTION_METHODS.has(propertyName)) {
    return true;
  }

  if (!['toBe', 'toEqual', 'toStrictEqual'].includes(propertyName)) {
    return false;
  }

  const arg = assertionCallNode.arguments?.[0];
  if (!arg) return false;

  return (
    arg.type === 'BooleanLiteral' ||
    arg.type === 'NullLiteral' ||
    (arg.type === 'Identifier' && arg.name === 'undefined')
  );
}

function getCallPath(calleeNode) {
  if (!calleeNode || typeof calleeNode !== 'object') return '';
  if (calleeNode.type === 'Identifier') return calleeNode.name;

  if (calleeNode.type === 'MemberExpression') {
    const objectPath = getCallPath(calleeNode.object);
    const propertyName = getPropertyName(calleeNode.property);
    if (objectPath && propertyName) {
      return `${objectPath}.${propertyName}`;
    }
    return propertyName || objectPath || '';
  }

  return '';
}

function parseFile(filePath, isE2E = false) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const fileLevelHttpMockTargets = [];

  for (const match of source.matchAll(/jest\.mock\(\s*['"]([^'"]+)['"]/g)) {
    const mockedTarget = (match[1] || '').toLowerCase();
    if (mockedTarget === 'axios' || mockedTarget.includes('/api/') || mockedTarget.includes('api/')) {
      fileLevelHttpMockTargets.push(mockedTarget);
    }
  }
  
  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    });
  } catch (e) {
    return {
      file: filePath,
      error: `Parse error: ${e.message}`,
      tests: [],
      issues: [{
        type: 'PARSE_ERROR',
        message: e.message,
        line: e.loc?.line || 1,
      }],
    };
  }

  const tests = [];
  const issues = [];
  const describeStack = [];
  const describeNodes = new WeakSet();
  const titlesSeen = new Map(); // title -> [lines]

  // Check file name for banned tokens (word boundary match)
  const fileNameMatch = fileName.match(BANNED_TOKENS_REGEX);
  if (fileNameMatch) {
    issues.push({
      type: 'FORBIDDEN_TOKEN',
      message: `Forbidden token "${fileNameMatch[1]}" in file name`,
      line: 1,
      identifier: fileName,
    });
  }

  traverse(ast, {
    CallExpression: {
      enter(nodePath) {
        const { node } = nodePath;
        const callee = node.callee;

        // Detect test blocks: describe, it, test, test.describe, test.only, etc.
        let blockType = null;
        let isSkipped = false;
        let isOnly = false;
        let isSerialDescribe = false;

        if (callee.type === 'Identifier') {
          if (['describe', 'it', 'test'].includes(callee.name)) {
            blockType = callee.name;
          }
        } else if (callee.type === 'MemberExpression') {
          const obj = callee.object;
          const prop = callee.property;
          const propName = getPropertyName(prop);

          if (obj.type === 'Identifier') {
            if (obj.name === 'describe' && propName === 'skip') {
              blockType = 'describe';
              isSkipped = true;
            } else if (obj.name === 'describe' && propName === 'only') {
              blockType = 'describe';
              isOnly = true;
            } else if (obj.name === 'it' && ['skip', 'only'].includes(propName)) {
              blockType = 'it';
              isSkipped = propName === 'skip';
              isOnly = propName === 'only';
            } else if (obj.name === 'test' && ['skip', 'only', 'describe'].includes(propName)) {
              blockType = propName === 'describe' ? 'describe' : 'test';
              isSkipped = propName === 'skip';
              isOnly = propName === 'only';
            }
          } else if (obj.type === 'MemberExpression') {
            const nestedObject = obj.object;
            const nestedPropName = getPropertyName(obj.property);
            if (
              nestedObject &&
              nestedObject.type === 'Identifier' &&
              nestedObject.name === 'test' &&
              nestedPropName === 'describe' &&
              propName === 'serial'
            ) {
              blockType = 'describe';
              isSerialDescribe = true;
            }
          }
        }

        if (!blockType) return;

        // Get title from first argument
        const titleArg = node.arguments[0];
        let title = '';

        if (titleArg) {
          if (titleArg.type === 'StringLiteral') {
            title = titleArg.value;
          } else if (titleArg.type === 'TemplateLiteral' && titleArg.quasis.length === 1) {
            title = titleArg.quasis[0].value.cooked || titleArg.quasis[0].value.raw;
          }
        }

        const line = node.loc?.start?.line || 0;
        const endLine = node.loc?.end?.line || line;
        const numLines = endLine - line + 1;

        // Track describe blocks for context
        if (blockType === 'describe') {
          describeStack.push(title);
          describeNodes.add(node);

          if (isE2E && isSerialDescribe) {
            let serialSnippet = '';
            try {
              serialSnippet = source.slice(node.start, node.end);
            } catch (e) {
              serialSnippet = '';
            }

            if (!/quality:\s*allow-serial\s*\(.+\)/i.test(serialSnippet)) {
              issues.push({
                type: 'SERIAL_WITHOUT_REASON',
                message: 'test.describe.serial used without documented reason',
                line,
                identifier: title || 'test.describe.serial',
                suggestion: 'Document reason with quality: allow-serial (reason)',
              });
            }
          }
        }

        // For actual test cases (it/test)
        if (blockType === 'it' || blockType === 'test') {
          const fullContext = describeStack.length > 0
            ? `${describeStack.join(' > ')} > ${title}`
            : title;

          // Get callback function
          const callbackArg = node.arguments[1];
          let hasAssertions = false;
          let assertionCount = 0;
          let weakAssertionCount = 0;
          let strongAssertionCount = 0;
          let hasConsoleLog = false;
          let hasHardcodedTimeout = false;
          let timeoutValue = 0;
          let isEmpty = false;
          let uselessAssertions = [];
          let hasImplementationCoupling = false;
          let fragileUnitSelector = null;
          let mountRenderCount = 0;
          let hasDirectNetworkDependency = false;
          let hasHttpMockCallContractOnly = false;
          let hasCallContractAssertion = false;
          let hasObservableAssertion = false;
          let hasNondeterministicUsage = false;
          let hasDeterministicControl = false;
          const nondeterministicSignals = new Set();
          const networkSignals = new Set();
          let allowMultiRender = false;
          let hasStorageMutation = false;
          let hasStorageCleanup = false;
          let hasFakeTimers = false;
          let hasTimerRestore = false;
          let hasGlobalMockMutation = false;
          let hasGlobalMockReset = false;
          let snapshotAssertionCount = 0;
          let hasLargeInlineSnapshot = false;
          let hasWaitForTimeout = false;
          let waitForTimeoutValue = 0;
          let e2eActionCount = 0;
          let hasDataCreation = false;
          let hasDataCleanup = false;
          const fragileDataSignals = new Set();

          if (callbackArg && (callbackArg.type === 'ArrowFunctionExpression' || callbackArg.type === 'FunctionExpression')) {
            const body = callbackArg.body;

            try {
              const callbackSource = source.slice(callbackArg.start, callbackArg.end);
              allowMultiRender = /quality:\s*allow-multi-render\s*\(.+\)/i.test(callbackSource);
            } catch (e) {
              allowMultiRender = false;
            }

            // Check if body is empty or just has pass-like statements
            if (body.type === 'BlockStatement') {
              const meaningfulStatements = body.body.filter(stmt => {
                if (stmt.type === 'EmptyStatement') return false;
                if (stmt.type === 'ExpressionStatement' &&
                    stmt.expression.type === 'Literal' &&
                    stmt.expression.value === undefined) return false;
                return true;
              });
              isEmpty = meaningfulStatements.length === 0;
            }

            // Walk the callback body for patterns
            const walkNode = (n) => {
              if (!n || typeof n !== 'object') return;

              if (!isE2E && n.type === 'MemberExpression') {
                if (
                  n.object &&
                  n.object.type === 'MemberExpression' &&
                  n.object.object &&
                  n.object.object.type === 'Identifier' &&
                  n.object.object.name === 'wrapper' &&
                  getPropertyName(n.object.property) === 'vm'
                ) {
                  hasImplementationCoupling = true;
                }
              }

              // Check for expect().toXxx() calls
              if (n.type === 'CallExpression') {
                const c = n.callee;
                const propertyName = c.type === 'MemberExpression' ? getPropertyName(c.property) : null;
                const callPath = getCallPath(c).toLowerCase();

                if (isE2E && propertyName && E2E_ACTION_METHODS.has(propertyName)) {
                  e2eActionCount += 1;
                }

                if (isE2E && callPath) {
                  if (
                    callPath.endsWith('.post') ||
                    callPath.endsWith('.create') ||
                    callPath.endsWith('.insert') ||
                    callPath.endsWith('.seed')
                  ) {
                    hasDataCreation = true;
                  }

                  if (
                    callPath.endsWith('.delete') ||
                    callPath.endsWith('.cleanup') ||
                    callPath.endsWith('.reset') ||
                    callPath.endsWith('.truncate') ||
                    callPath.endsWith('.clear')
                  ) {
                    hasDataCleanup = true;
                  }
                }

                if (c.type === 'Identifier' && MOUNT_RENDER_METHODS.has(c.name)) {
                  mountRenderCount += 1;
                }
                if (c.type === 'MemberExpression' && propertyName && MOUNT_RENDER_METHODS.has(propertyName)) {
                  mountRenderCount += 1;
                }

                if (c.type === 'MemberExpression' && propertyName) {
                  if (ASSERTION_METHODS.has(propertyName)) {
                    hasAssertions = true;
                    assertionCount++;
                    if (isE2E) {
                      if (isWeakAssertion(propertyName, n)) {
                        weakAssertionCount++;
                      } else {
                        strongAssertionCount++;
                      }
                    }
                    if (propertyName === 'toMatchSnapshot' || propertyName === 'toMatchInlineSnapshot') {
                      snapshotAssertionCount++;
                    }
                    if (CALL_CONTRACT_ASSERTION_METHODS.has(propertyName)) {
                      hasCallContractAssertion = true;
                    } else {
                      hasObservableAssertion = true;
                    }

                    if (
                      propertyName === 'toMatchInlineSnapshot' &&
                      n.arguments &&
                      n.arguments[0] &&
                      n.arguments[0].type === 'StringLiteral' &&
                      n.arguments[0].value &&
                      n.arguments[0].value.length > 300
                    ) {
                      hasLargeInlineSnapshot = true;
                    }

                    // Check for useless assertions
                    try {
                      const assertionText = source.slice(n.start, n.end);
                      for (const useless of USELESS_ASSERTIONS) {
                        if (assertionText.includes(useless)) {
                          uselessAssertions.push(assertionText.slice(0, 50));
                        }
                      }
                    } catch (e) { /* ignore */ }
                  }
                }

                if (!isE2E && c.type === 'MemberExpression' && propertyName === 'find') {
                  const selector = getStaticString(n.arguments[0]);
                  if (selector.startsWith('.') || selector.startsWith('#')) {
                    fragileUnitSelector = `.find(${selector})`;
                  }
                }

                if (!isE2E && c.type === 'MemberExpression' && propertyName === 'querySelector') {
                  fragileUnitSelector = 'querySelector';
                }

                if (!isE2E) {
                  if (c.type === 'Identifier' && c.name === 'fetch') {
                    hasDirectNetworkDependency = true;
                    networkSignals.add('fetch');
                  }

                  if (c.type === 'MemberExpression') {
                    if (c.object.type === 'Identifier' && c.object.name === 'axios') {
                      hasDirectNetworkDependency = true;
                      networkSignals.add('axios');
                    }

                    if (
                      c.object.type === 'Identifier' &&
                      ['localStorage', 'sessionStorage'].includes(c.object.name)
                    ) {
                      if (propertyName === 'setItem') {
                        hasStorageMutation = true;
                      }
                      if (propertyName === 'removeItem' || propertyName === 'clear') {
                        hasStorageCleanup = true;
                      }
                    }

                    if (c.object.type === 'Identifier' && c.object.name === 'Date' && propertyName === 'now') {
                      hasNondeterministicUsage = true;
                      nondeterministicSignals.add('Date.now');
                    }

                    if (c.object.type === 'Identifier' && c.object.name === 'Math' && propertyName === 'random') {
                      hasNondeterministicUsage = true;
                      nondeterministicSignals.add('Math.random');
                    }

                    if (c.object.type === 'Identifier' && c.object.name === 'jest') {
                      if (propertyName === 'useFakeTimers') {
                        hasFakeTimers = true;
                        hasDeterministicControl = true;
                      }
                      if (propertyName === 'useRealTimers') {
                        hasTimerRestore = true;
                      }
                      if (['setSystemTime', 'spyOn'].includes(propertyName)) {
                        hasDeterministicControl = true;
                      }
                      if (propertyName === 'spyOn') {
                        hasGlobalMockMutation = true;
                      }
                      if (['restoreAllMocks', 'resetAllMocks', 'clearAllMocks'].includes(propertyName)) {
                        hasGlobalMockReset = true;
                      }

                      if (propertyName === 'mock') {
                        const mockedTarget = getStaticString(n.arguments[0]).toLowerCase();
                        if (mockedTarget === 'axios' || mockedTarget.includes('/api/') || mockedTarget.includes('api/')) {
                          hasHttpMockCallContractOnly = true;
                          networkSignals.add(`jest.mock(${mockedTarget})`);
                        }
                      }
                    }

                    if (['mockRestore', 'mockReset'].includes(propertyName)) {
                      hasGlobalMockReset = true;
                    }
                  }
                }

                // Check for console.log/debug/etc
                if (c.type === 'MemberExpression' &&
                    c.object.type === 'Identifier' && c.object.name === 'console') {
                  hasConsoleLog = true;
                }

                // Check for hardcoded timeouts (but NOT test.setTimeout which is config)
                if (c.type === 'MemberExpression' && propertyName) {
                  const isTestSetTimeout = c.object.type === 'Identifier' && c.object.name === 'test' && propertyName === 'setTimeout';
                  if (isE2E && propertyName === 'waitForTimeout') {
                    const timeArg = n.arguments[0];
                    if (timeArg && timeArg.type === 'NumericLiteral') {
                      waitForTimeoutValue = timeArg.value;
                    }
                    hasWaitForTimeout = true;
                  } else if (!isTestSetTimeout && (propertyName === 'setTimeout' || (!isE2E && propertyName === 'waitForTimeout'))) {
                    const timeArg = n.arguments[0];
                    if (timeArg && timeArg.type === 'NumericLiteral') {
                      timeoutValue = timeArg.value;
                      if (timeoutValue > 100) {
                        hasHardcodedTimeout = true;
                      }
                    }
                  }
                }
              }

              if (!isE2E && n.type === 'NewExpression' && n.callee.type === 'Identifier' && n.callee.name === 'Date') {
                hasNondeterministicUsage = true;
                nondeterministicSignals.add('new Date');
              }

              if (isE2E && n.type === 'StringLiteral') {
                const value = (n.value || '').toString();
                if (!value.toLowerCase().startsWith('http')) {
                  for (const pattern of FRAGILE_TEST_DATA_PATTERNS) {
                    if (pattern.test(value)) {
                      fragileDataSignals.add(value.length > 40 ? `${value.slice(0, 37)}...` : value);
                      break;
                    }
                  }
                }
              }

              if (isE2E && n.type === 'TemplateLiteral' && n.expressions.length === 0) {
                const templateValue = n.quasis?.[0]?.value?.cooked || '';
                if (!templateValue.toLowerCase().startsWith('http')) {
                  for (const pattern of FRAGILE_TEST_DATA_PATTERNS) {
                    if (pattern.test(templateValue)) {
                      fragileDataSignals.add(templateValue.length > 40 ? `${templateValue.slice(0, 37)}...` : templateValue);
                      break;
                    }
                  }
                }
              }

              // Recurse into child nodes
              for (const key of Object.keys(n)) {
                if (key === 'loc' || key === 'start' || key === 'end') continue;
                const child = n[key];
                if (Array.isArray(child)) {
                  child.forEach(walkNode);
                } else if (child && typeof child === 'object') {
                  walkNode(child);
                }
              }
            };

            walkNode(callbackArg.body);

            if (fileLevelHttpMockTargets.length > 0) {
              hasHttpMockCallContractOnly = true;
              for (const target of fileLevelHttpMockTargets) {
                networkSignals.add(`jest.mock(${target})`);
              }
            }

            if (hasHttpMockCallContractOnly && hasCallContractAssertion && !hasObservableAssertion) {
              hasDirectNetworkDependency = true;
            }

            if (hasStorageMutation && !hasStorageCleanup) {
              issues.push({
                type: 'GLOBAL_STATE_LEAK',
                message: 'localStorage/sessionStorage mutation without cleanup in test',
                line,
                identifier: title,
                suggestion: 'Cleanup storage state with removeItem/clear in the same test lifecycle',
              });
            }

            if (hasFakeTimers && !hasTimerRestore) {
              issues.push({
                type: 'GLOBAL_STATE_LEAK',
                message: 'jest.useFakeTimers() without corresponding jest.useRealTimers()',
                line,
                identifier: title,
                suggestion: 'Restore timers to avoid leaking fake timer state across tests',
              });
            }

            if (hasGlobalMockMutation && !hasGlobalMockReset) {
              issues.push({
                type: 'GLOBAL_STATE_LEAK',
                message: 'Global mock/spyon mutation without reset/restore in test',
                line,
                identifier: title,
                suggestion: 'Call restoreAllMocks/resetAllMocks or mockRestore/mockReset after mutation',
              });
            }
          }

          // Track duplicates
          if (!titlesSeen.has(title)) {
            titlesSeen.set(title, []);
          }
          titlesSeen.get(title).push(line);

          const testInfo = {
            name: title,
            fullContext,
            line,
            endLine,
            numLines,
            type: blockType,
            isSkipped,
            isOnly,
            hasAssertions,
            assertionCount,
            hasConsoleLog,
            hasHardcodedTimeout,
            timeoutValue,
            isEmpty,
            describeBlock: describeStack.length > 0 ? describeStack[describeStack.length - 1] : null,
          };

          tests.push(testInfo);

          // Generate issues
          if (isEmpty) {
            issues.push({
              type: 'EMPTY_TEST',
              message: 'Empty test (no meaningful statements)',
              line,
              identifier: title,
            });
          } else if (!hasAssertions) {
            issues.push({
              type: 'NO_ASSERTIONS',
              message: 'Test has no assertions (expect/assert)',
              line,
              identifier: title,
            });
          }

          for (const useless of uselessAssertions) {
            issues.push({
              type: 'USELESS_ASSERTION',
              message: `Useless assertion: ${useless}`,
              line,
              identifier: title,
            });
          }

          // Check title for banned tokens (word boundary match)
          const bannedMatch = title.match(BANNED_TOKENS_REGEX);
          if (bannedMatch) {
            issues.push({
              type: 'FORBIDDEN_TOKEN',
              message: `Forbidden token "${bannedMatch[1]}" in test title`,
              line,
              identifier: title,
            });
          }

          // Check for generic titles
          if (GENERIC_TITLES.some(g => title.toLowerCase() === g)) {
            issues.push({
              type: 'POOR_NAMING',
              message: `Generic test title: "${title}"`,
              line,
              identifier: title,
            });
          }

          // Console.log warning
          if (hasConsoleLog) {
            issues.push({
              type: 'CONSOLE_LOG',
              message: 'Test contains console.log - forgotten debug?',
              line,
              identifier: title,
            });
          }

          // Hardcoded timeout warning
          if (hasHardcodedTimeout) {
            issues.push({
              type: 'HARDCODED_TIMEOUT',
              message: `Hardcoded timeout (${timeoutValue}ms) - likely flaky`,
              line,
              identifier: title,
            });
          }

          if (isE2E && hasWaitForTimeout) {
            const timeoutMessage = waitForTimeoutValue > 0
              ? `waitForTimeout(${waitForTimeoutValue}) used - brittle wait strategy`
              : 'waitForTimeout used - brittle wait strategy';
            issues.push({
              type: 'WAIT_FOR_TIMEOUT',
              message: timeoutMessage,
              line,
              identifier: title,
              suggestion: 'Use web-first assertions (expect) or explicit waitForURL/waitForResponse predicates',
            });
          }

          if (isE2E && e2eActionCount > 12 && strongAssertionCount <= 1) {
            issues.push({
              type: 'EXCESSIVE_STEPS',
              message: `Long E2E sequence (${e2eActionCount} actions) with low strong-assert density (${strongAssertionCount})`,
              line,
              identifier: title,
              suggestion: 'Split flow or add stronger verification checkpoints',
            });
          }

          if (isE2E && assertionCount > 0 && strongAssertionCount === 0) {
            issues.push({
              type: 'VAGUE_ASSERTION',
              message: `E2E test relies on weak assertions (${weakAssertionCount}) without strict state verification`,
              line,
              identifier: title,
              suggestion: 'Prefer strict assertions (toHaveURL/toBeVisible/toHaveText/toHaveValue) over truthy/falsy checks',
            });
          }

          if (isE2E && fragileDataSignals.size > 0) {
            const examples = Array.from(fragileDataSignals).slice(0, 2).join(', ');
            issues.push({
              type: 'FRAGILE_TEST_DATA',
              message: `Potentially fragile hardcoded test data detected (${examples})`,
              line,
              identifier: title,
              suggestion: 'Prefer generated fixtures or scenario builders for stable data',
            });
          }

          if (isE2E && hasDataCreation && !hasDataCleanup) {
            issues.push({
              type: 'DATA_ISOLATION',
              message: 'E2E test appears to create data without explicit cleanup/reset signal',
              line,
              identifier: title,
              suggestion: 'Ensure data lifecycle cleanup/reset or isolated fixture strategy',
            });
          }

          if (!isE2E && hasImplementationCoupling) {
            issues.push({
              type: 'IMPLEMENTATION_COUPLING',
              message: 'Test is coupled to implementation details via wrapper.vm.* access',
              line,
              identifier: title,
              suggestion: 'Assert observable UI/state outcomes instead of internals when possible',
            });
          }

          if (!isE2E && fragileUnitSelector) {
            issues.push({
              type: 'FRAGILE_SELECTOR',
              message: `Fragile unit selector detected (${fragileUnitSelector})`,
              line,
              identifier: title,
              suggestion: 'Prefer stable selectors and behavior-oriented assertions',
            });
          }

          if (!isE2E && mountRenderCount > 1 && !allowMultiRender) {
            issues.push({
              type: 'MULTI_RENDER',
              message: `Multiple mount/render calls in one test (${mountRenderCount})`,
              line,
              identifier: title,
              suggestion: 'Split the test or document exception with quality: allow-multi-render (reason)',
            });
          }

          if (!isE2E && hasDirectNetworkDependency) {
            const signal = Array.from(networkSignals).join(', ') || 'network call';
            const contextual = hasHttpMockCallContractOnly && hasCallContractAssertion && !hasObservableAssertion;
            issues.push({
              type: 'NETWORK_DEPENDENCY',
              message: contextual
                ? `HTTP mock assertion without observable outcome (${signal})`
                : `Direct network dependency in unit test (${signal})`,
              line,
              identifier: title,
              suggestion: contextual
                ? 'Add assertions for user-visible state/behavior, not only call contract'
                : 'Mock network boundary and assert observable outcomes',
            });
          }

          if (!isE2E && hasNondeterministicUsage && !hasDeterministicControl) {
            const signal = Array.from(nondeterministicSignals).join(', ') || 'non-deterministic source';
            issues.push({
              type: 'NONDETERMINISTIC',
              message: `Non-deterministic source without explicit control (${signal})`,
              line,
              identifier: title,
              suggestion: 'Use fake timers/setSystemTime or deterministic mocks/seeds',
            });
          }

          if (!isE2E && snapshotAssertionCount > 0 && snapshotAssertionCount === assertionCount) {
            issues.push({
              type: 'SNAPSHOT_OVERRELIANCE',
              message: 'Snapshot-only assertions detected without complementary semantic assertions',
              line,
              identifier: title,
              suggestion: 'Add behavior-oriented assertions alongside snapshots',
            });
          } else if (!isE2E && hasLargeInlineSnapshot) {
            issues.push({
              type: 'SNAPSHOT_OVERRELIANCE',
              message: 'Large inline snapshot detected; prefer focused semantic assertions',
              line,
              identifier: title,
              suggestion: 'Reduce snapshot size and complement with targeted expect(...) checks',
            });
          }

          // Too many assertions
          if (assertionCount > 7) {
            issues.push({
              type: 'TOO_MANY_ASSERTIONS',
              message: `Too many assertions (${assertionCount} > 7)`,
              line,
              identifier: title,
            });
          }

          // Test too long
          if (numLines > 50) {
            issues.push({
              type: 'TEST_TOO_LONG',
              message: `Test too long (${numLines} lines > 50)`,
              line,
              identifier: title,
            });
          }
        }
      },
      exit(nodePath) {
        if (describeNodes.has(nodePath.node)) {
          describeStack.pop();
        }
      },
    },
  });
  
  // Check for duplicates
  for (const [title, lines] of titlesSeen.entries()) {
    if (lines.length > 1) {
      issues.push({
        type: 'DUPLICATE_NAME',
        message: `Duplicate test title: "${title}"`,
        line: lines[0],
        identifier: title,
        suggestion: `Appears on lines ${lines.join(', ')}`,
      });
    }
  }
  
  return {
    file: filePath,
    tests,
    issues,
    summary: {
      testCount: tests.length,
      issueCount: issues.length,
      hasParseError: issues.some(i => i.type === 'PARSE_ERROR'),
    },
  };
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node ast-parser.cjs <file.test.js> [--e2e]');
  process.exit(1);
}

const filePath = args[0];
const isE2E = args.includes('--e2e');

if (!fs.existsSync(filePath)) {
  console.error(JSON.stringify({ error: `File not found: ${filePath}`, file: filePath }));
  process.exit(1);
}

const result = parseFile(filePath, isE2E);
console.log(JSON.stringify(result, null, 2));
