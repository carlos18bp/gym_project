const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const usage = `Usage:
  npm run e2e:coverage:module -- <module> [--clean] [playwright args...]

Examples:
  npm run e2e:coverage:module -- auth
  npm run e2e:coverage:module -- --module auth --clean
  npm run e2e:coverage:module -- auth --project="Desktop Chrome"`;

const definitionsPath = path.resolve(__dirname, '..', 'e2e', 'flow-definitions.json');

function normalizeModuleName(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('@module:') ? trimmed.slice('@module:'.length) : trimmed;
}

function parseArgs(argv) {
  const options = {
    moduleName: null,
    clean: false,
    extraArgs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--clean') {
      options.clean = true;
      continue;
    }

    if (arg === '--module') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Module name is required after --module.');
      }
      options.moduleName = normalizeModuleName(nextValue);
      index += 1;
      continue;
    }

    if (!options.moduleName) {
      options.moduleName = normalizeModuleName(arg);
      continue;
    }

    options.extraArgs.push(arg);
  }

  return options;
}

function resolveOptions(argv) {
  const options = parseArgs(argv);
  if (!options.moduleName) {
    throw new Error('Module name is required.');
  }
  return options;
}

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

function validateModuleName(moduleName, definitionsFile = definitionsPath) {
  const modules = loadModules(definitionsFile);
  if (!modules.includes(moduleName)) {
    const available = modules.length > 0 ? modules.join(', ') : 'none';
    throw new Error(`Unknown module "${moduleName}". Available modules: ${available}.`);
  }
  return modules;
}

function buildCoverageArgs(moduleName, extraArgs) {
  return ['run', 'e2e:coverage', '--', '--grep', `@module:${moduleName}`, ...extraArgs];
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function run() {
  let options;
  try {
    options = resolveOptions(process.argv.slice(2));
    validateModuleName(options.moduleName);
  } catch (error) {
    console.error(`[e2e:coverage:module] ${error.message}`);
    console.error(usage);
    process.exit(1);
  }

  if (options.clean) {
    runCommand(npmCommand, ['run', 'e2e:clean']);
  }

  runCommand(npmCommand, buildCoverageArgs(options.moduleName, options.extraArgs));
}

if (require.main === module) {
  run();
}

module.exports = {
  buildCoverageArgs,
  loadModules,
  parseArgs,
  resolveOptions,
  validateModuleName,
};
