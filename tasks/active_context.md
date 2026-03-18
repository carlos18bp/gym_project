# Active Context — G&M Internal Management Tool

## 1. Current State

The application is **feature-complete** for its core functionality. All 16 major features are implemented and operational:

- User management with JWT + Google OAuth + reCAPTCHA
- Process management with stages, case files, and recent tracking
- Dynamic documents with full editor, variables, permissions, tags, folders, relationships, letterhead, PDF/Word export
- Electronic signatures with draw/upload, request/sign/reject/archive workflow
- Organizations with invitations, memberships, posts, and corporate requests
- Legal requests with file attachments, responses, and email notifications
- Subscription billing via Wompi with automated Huey tasks
- Dashboard with activity feed, recent items, and Excel reports
- Intranet, legal updates, PWA support, and interactive user guide
- Automated backups, query profiling (django-silk), and test quality gate

### Codebase Metrics (verified 2026-03-18)

| Metric | Count |
|--------|-------|
| Backend model classes | 37 (+ 1 UserManager) |
| Backend view files | 22 |
| Backend serializer files | 9 |
| Backend URL patterns | 147 |
| Backend test files | 63 |
| Backend migrations | 52 |
| Backend management commands | 9 |
| Frontend Vue components | 103 |
| Frontend view pages | 34 |
| Frontend Pinia store files | 34 |
| Frontend composables | 10 |
| Frontend route definitions | 48 |
| Frontend unit test files | 150 |
| Frontend E2E spec files | 158 |

---

## 2. Recent Focus Areas

- **E2E coverage audit (2026-03-18)**: Full 4-phase audit completed:
  - Phase 1: Fixed failing `profile-complete` E2E test + 4 quality gate lint errors (import sort, docstring, 2 unused vars)
  - Phase 2: Deepened 5 P1 known gaps (`sign-client-flow`, `sign-reject`, `sign-reopen`, `docs-use-template`, `docs-permissions`) with real UI interaction tests
  - Phase 3: Verified and ran 6 previously-missing P2 flow specs (`subscriptions-cancel`, `subscriptions-update-payment`, `process-request-info`, `docs-folder-crud`, `docs-form-field-types`, `intranet-facturation-form`)
  - Phase 4: Split `router_guards` test (8→2×4 assertions), verified P2/P3 gaps already covered, removed all 9 `knownGaps` from `flow-definitions.json`
  - **Quality Gate: 100/100 PASSED** — 0 errors, 0 warnings, 1 info suggestion
- **Memory Bank Windsurf adaptation**: Adapted methodology rules from Cursor format to Windsurf-compatible paths
- **Test quality gate**: Custom analyzer integrated with pre-commit and GitHub Actions CI
- **Block-based test runner**: RAM-safe backend test execution via `scripts/run-tests-blocks.py`
- **E2E flow coverage**: Playwright E2E tests with flow definitions and coverage reporting

---

## 3. Active Decisions & Considerations

| Decision | Status | Context |
|----------|--------|---------|
| 12 planned features in `docs/next_requirements/` | Awaiting prioritization | Reassignment, minutas, preview, guided tour, notifications, alerts, Outlook auth, marketplace, optional signature, contract execution, in-place formalize |
| Memory Bank methodology | ✅ Complete | Persistent documentation for AI context fully set up and adapted for Windsurf |
| Large file modularization | Under consideration | `user_guide.js` (143KB), `reports.py` (74KB) could be split |

---

## 4. Development Environment Summary

| Component | Detail |
|-----------|--------|
| Backend | Django 5.0.6 + DRF 3.15.2, SQLite (dev), Python 3.12 |
| Frontend | Vue 3.4 + Vite 6 + Pinia + TailwindCSS 3, Node 22.13.0 |
| Task Queue | Huey 2.5.2 (immediate mode in dev, Redis in prod) |
| Testing | pytest, Jest 29, Playwright |
| CI | GitHub Actions (test quality gate on PR/push) |
| Pre-commit | Ruff lint + test quality gate |

---

## 5. Next Steps

1. **Review and prioritize** the 12 planned features in `docs/next_requirements/`
2. **Address tech debt** — Clean up backup files, modularize large files
3. **Continue test coverage** — Maintain and expand backend/frontend/E2E test suites
4. **Production hardening** — Log rotation, secret key enforcement, backup verification
