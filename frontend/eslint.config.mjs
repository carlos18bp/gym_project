import jestPlugin from "eslint-plugin-jest";
import jestDomPlugin from "eslint-plugin-jest-dom";
import playwrightPlugin from "eslint-plugin-playwright";

const jestGlobals = {
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  afterAll: "readonly",
  afterEach: "readonly",
  jest: "readonly",
};

export default [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "coverage-e2e/**", "playwright-report/**"],
  },
  {
    files: ["test/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      jest: jestPlugin,
      "jest-dom": jestDomPlugin,
    },
    languageOptions: {
      globals: {
        ...jestGlobals,
      },
    },
    rules: {
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
      "jest/valid-expect": "error",
      "jest/expect-expect": "warn",
      "jest/consistent-test-it": ["warn", { fn: "test", withinDescribe: "test" }],
      "jest-dom/prefer-to-be-in-the-document": "warn",
      "jest-dom/prefer-enabled-disabled": "warn",
      "jest-dom/prefer-required": "warn",
    },
  },
  {
    files: ["e2e/**/*.{js,ts}"],
    plugins: {
      playwright: playwrightPlugin,
    },
    languageOptions: {
      globals: {
        ...jestGlobals,
      },
    },
    rules: {
      "playwright/no-focused-test": "error",
      "playwright/no-wait-for-timeout": "warn",
      "playwright/missing-playwright-await": "error",
      "playwright/prefer-web-first-assertions": "warn",
    },
  },
];
