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

const USELESS_ASSERTIONS = [
  'expect(true).toBe(true)',
  'expect(1).toBe(1)',
  'expect(true).toBeTruthy()',
  'expect(false).toBeFalsy()',
];

const BANNED_TOKENS = ['batch', 'coverage', 'cov', 'deep'];
const BANNED_TOKENS_REGEX = new RegExp(`\\b(${BANNED_TOKENS.join('|')})\\b`, 'i');
const GENERIC_TITLES = ['it works', 'should work', 'test', 'works', 'does something'];

function parseFile(filePath, isE2E = false) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  
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

        if (callee.type === 'Identifier') {
          if (['describe', 'it', 'test'].includes(callee.name)) {
            blockType = callee.name;
          }
        } else if (callee.type === 'MemberExpression') {
          const obj = callee.object;
          const prop = callee.property;

          if (obj.type === 'Identifier') {
            if (obj.name === 'describe' && prop.name === 'skip') {
              blockType = 'describe';
              isSkipped = true;
            } else if (obj.name === 'describe' && prop.name === 'only') {
              blockType = 'describe';
              isOnly = true;
            } else if (obj.name === 'it' && ['skip', 'only'].includes(prop.name)) {
              blockType = 'it';
              isSkipped = prop.name === 'skip';
              isOnly = prop.name === 'only';
            } else if (obj.name === 'test' && ['skip', 'only', 'describe'].includes(prop.name)) {
              blockType = prop.name === 'describe' ? 'describe' : 'test';
              isSkipped = prop.name === 'skip';
              isOnly = prop.name === 'only';
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
          let hasConsoleLog = false;
          let hasHardcodedTimeout = false;
          let timeoutValue = 0;
          let isEmpty = false;
          let uselessAssertions = [];

          if (callbackArg && (callbackArg.type === 'ArrowFunctionExpression' || callbackArg.type === 'FunctionExpression')) {
            const body = callbackArg.body;

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

              // Check for expect().toXxx() calls
              if (n.type === 'CallExpression') {
                const c = n.callee;
                if (c.type === 'MemberExpression' && c.property.type === 'Identifier') {
                  if (ASSERTION_METHODS.has(c.property.name)) {
                    hasAssertions = true;
                    assertionCount++;

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

                // Check for console.log/debug/etc
                if (c.type === 'MemberExpression' &&
                    c.object.type === 'Identifier' && c.object.name === 'console') {
                  hasConsoleLog = true;
                }

                // Check for hardcoded timeouts (but NOT test.setTimeout which is config)
                if (c.type === 'MemberExpression' && c.property.type === 'Identifier') {
                  const isTestSetTimeout = c.object.type === 'Identifier' && c.object.name === 'test' && c.property.name === 'setTimeout';
                  if (!isTestSetTimeout && (c.property.name === 'waitForTimeout' || c.property.name === 'setTimeout')) {
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
