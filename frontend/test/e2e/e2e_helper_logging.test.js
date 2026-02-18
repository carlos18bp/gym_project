const mockPlaywright = {
  test: {
    extend: jest.fn((fixtures) => ({ _fixtures: fixtures })),
  },
  expect: jest.fn(),
};

jest.mock("@playwright/test", () => ({
  __esModule: true,
  test: mockPlaywright.test,
  expect: mockPlaywright.expect,
}));

const originalEnv = process.env;

async function loadTestHelper() {
  jest.resetModules();
  return import("../../e2e/helpers/test.js");
}

function buildPage() {
  return {
    on: jest.fn(),
    waitForLoadState: jest.fn().mockResolvedValue(),
    waitForTimeout: jest.fn().mockResolvedValue(),
    evaluate: jest.fn(),
  };
}

describe("e2e helper logging", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.E2E_LOG_ERRORS;
    delete process.env.E2E_COVERAGE;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("does not register error listeners when E2E_LOG_ERRORS is unset", async () => {
    const { test } = await loadTestHelper();
    const page = buildPage();
    const use = jest.fn();

    await test._fixtures.page({ page }, use);

    expect(page.on).not.toHaveBeenCalled();
  });

  test("registers listeners and logs when E2E_LOG_ERRORS=1", async () => {
    process.env.E2E_LOG_ERRORS = "1";

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { test } = await loadTestHelper();
    const page = buildPage();
    const use = jest.fn();

    await test._fixtures.page({ page }, use);

    expect(page.on).toHaveBeenCalledTimes(2);

    const pageErrorCall = page.on.mock.calls.find(([event]) => event === "pageerror");
    const consoleCall = page.on.mock.calls.find(([event]) => event === "console");

    expect(pageErrorCall).toBeTruthy();
    expect(consoleCall).toBeTruthy();

    const pageErrorHandler = pageErrorCall[1];
    const consoleHandler = consoleCall[1];

    const error = new Error("boom");
    pageErrorHandler(error);

    consoleHandler({
      type: () => "error",
      text: () => "Console failed",
    });

    expect(consoleSpy).toHaveBeenCalledWith("[e2e:pageerror]", error);
    expect(consoleSpy).toHaveBeenCalledWith("[e2e:console:error]", "Console failed");
  });
});
