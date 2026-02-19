# Frontend Security Exceptions (dev-only)

Last updated: 2026-02-19

## Context

After remediation of all production vulnerabilities (`npm audit --omit=dev` = **0 vulnerabilities**), the following dev-only advisories remain without upstream fix. They are documented here with risk assessment and follow-up plan.

---

## Exception 1 — minimatch ReDoS (GHSA-3ppc-4f35-3m26)

- **Severity:** high
- **Advisory:** https://github.com/advisories/GHSA-3ppc-4f35-3m26
- **Affected versions:** minimatch < 10.2.1
- **Affected chains:** eslint, jest, nyc, babel-plugin-istanbul, @vue/test-utils (all devDependencies)
- **Risk in this project:** **none** — minimatch processes glob patterns from developer-controlled config files (jest.config, eslint.config, .nycrc). No user/external input reaches these patterns. ReDoS requires attacker-controlled input.
- **Why no fix:** upgrading minimatch to 10.x requires breaking major upgrades across jest (29→25 downgrade suggested by npm, which is destructive), eslint internals, and nyc. No compatible upstream patch exists.
- **Follow-up:** review quarterly. When jest 30+ or equivalent ships with safe minimatch, upgrade.

---

## Exception 2 — ajv ReDoS (GHSA-2g4f-4pwh-qvx6)

- **Severity:** moderate
- **Advisory:** https://github.com/advisories/GHSA-2g4f-4pwh-qvx6
- **Affected versions:** ajv < 8.18.0
- **Affected chains:** eslint → @eslint/eslintrc → ajv (devDependency)
- **Risk in this project:** **none** — ajv validates JSON schemas in ESLint config parsing. The `$data` option triggering the ReDoS is not used in this project's ESLint configuration, and input is developer-controlled.
- **Why no fix:** eslint's internal dependency on ajv has not been updated upstream.
- **Follow-up:** review quarterly with eslint updates.

---

## Operational Controls

### Release gate (blocking)
```bash
npm audit --omit=dev
# Must exit 0 (zero vulnerabilities) before any production deployment.
```

### Periodic monitoring (informational)
```bash
npm audit
# Review quarterly. Dev-only findings are tracked here.
```
