const fs = require('node:fs');
const path = require('node:path');

const definitionsPath = path.resolve(__dirname, '..', 'e2e', 'flow-definitions.json');

function loadModules(definitionsFile = definitionsPath) {
  let raw;
  try {
    raw = fs.readFileSync(definitionsFile, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read flow definitions at ${definitionsFile}.`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${definitionsFile}.`);
  }

  const flows = data && typeof data.flows === 'object' ? Object.values(data.flows) : [];
  const modules = new Set();

  for (const flow of flows) {
    if (flow && typeof flow.module === 'string') {
      const mod = flow.module.trim();
      if (mod) {
        modules.add(mod);
      }
    }
  }

  return Array.from(modules).sort((a, b) => a.localeCompare(b));
}

function printModules(modules, logger = console) {
  if (!modules || modules.length === 0) {
    logger.warn('[e2e:modules] No modules found in flow-definitions.json.');
    return;
  }

  for (const mod of modules) {
    logger.log(mod);
  }
}

function run() {
  let modules;
  try {
    modules = loadModules();
  } catch (error) {
    console.error(`[e2e:modules] ${error.message}`);
    console.error('[e2e:modules] Ensure flow-definitions.json exists and contains valid JSON.');
    process.exit(1);
  }

  printModules(modules);
}

if (require.main === module) {
  run();
}

module.exports = {
  loadModules,
  printModules,
};
