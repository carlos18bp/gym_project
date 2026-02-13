const fs = require('node:fs');
const path = require('node:path');

const targets = ['playwright-report', 'test-results', 'coverage-e2e', '.nyc_output'];

for (const target of targets) {
  const fullPath = path.join(process.cwd(), target);
  fs.rmSync(fullPath, { recursive: true, force: true });
}
