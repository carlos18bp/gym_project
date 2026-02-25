const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const e2eModules = require("../../scripts/e2e-modules.cjs");
const e2eModule = require("../../scripts/e2e-module.cjs");
const e2eModuleReport = require("../../scripts/e2e-coverage-module.cjs");

const tempDirs = [];

function createDefinitionsFile(data) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-modules-"));
  const filePath = path.join(tempDir, "flow-definitions.json");
  fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
  tempDirs.push(tempDir);
  return filePath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("e2e module helpers", () => {
  test("loadModules returns sorted unique modules", () => {
    const filePath = createDefinitionsFile({
      version: "1.0.0",
      lastUpdated: "2026-02-24",
      flows: {
        "auth-login": { module: "auth" },
        "docs-create": { module: " documents " },
        "auth-logout": { module: "auth" },
      },
    });

    expect(e2eModule.loadModules(filePath)).toEqual(["auth", "documents"]);
  });

  test("validateModuleName accepts known module", () => {
    const filePath = createDefinitionsFile({
      version: "1.0.0",
      lastUpdated: "2026-02-24",
      flows: {
        "auth-login": { module: "auth" },
        "docs-create": { module: "documents" },
      },
    });

    const modules = e2eModule.validateModuleName("auth", filePath);
    expect(modules).toEqual(["auth", "documents"]);
  });
});

describe("e2e modules list helpers", () => {
  test("loadModules returns empty list when flows are missing", () => {
    const filePath = createDefinitionsFile({
      version: "1.0.0",
      lastUpdated: "2026-02-24",
      flows: {},
    });

    expect(e2eModules.loadModules(filePath)).toEqual([]);
  });

  test("printModules warns when no modules are available", () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    e2eModules.printModules([], logger);

    expect(logger.warn).toHaveBeenCalledWith(
      "[e2e:modules] No modules found in flow-definitions.json."
    );
    expect(logger.log).not.toHaveBeenCalled();
  });
});

describe("e2e module report helpers", () => {
  test("validateModuleName throws for unknown module", () => {
    const filePath = createDefinitionsFile({
      version: "1.0.0",
      lastUpdated: "2026-02-24",
      flows: {
        "auth-login": { module: "auth" },
      },
    });

    expect(() => e2eModuleReport.validateModuleName("unknown", filePath)).toThrow(
      'Unknown module "unknown".'
    );
  });

  test("loadModules throws for invalid JSON", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-modules-"));
    const filePath = path.join(tempDir, "flow-definitions.json");
    fs.writeFileSync(filePath, "{ invalid", "utf8");
    tempDirs.push(tempDir);

    expect(() => e2eModuleReport.loadModules(filePath)).toThrow("Invalid JSON");
  });
});
