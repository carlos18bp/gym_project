# Active Context — G&M Internal Management Tool

## 1. Current State

The application is **feature-complete** with all 17 major features implemented, tested, and operational:

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
- **SECOP Public Procurement** ✅: Socrata API integration, process listing/detail, classifications, alerts, saved views, Excel export, professional UI/UX

### Codebase Metrics (verified 2026-03-18)

| Metric | Count |
|--------|-------|
| Backend model classes | 43 (+ 1 UserManager) — 6 new SECOP models |
| Backend view files | 23 — 1 new SECOP views file |
| Backend serializer files | 10 — 1 new SECOP serializers file |
| Backend URL patterns | 162 — 15 new SECOP endpoints |
| Backend test files | 63 |
| Backend migrations | 53 — 1 new SECOP migration |
| Backend management commands | 10 — 1 new sync_secop command |
| Frontend Vue components | 109 — 6 new SECOP components |
| Frontend view pages | 36 — 2 new SECOP views |
| Frontend Pinia store files | 35 — 1 new SECOP store |
| Frontend composables | 10 |
| Frontend route definitions | 48 |
| Frontend unit test files | 150 |
| Frontend E2E spec files | 158 |

---

## 2. Recent Focus Areas

- **SECOP Module — Stale data fix (2026-03-20)**:
  - **Root cause**: SECOP API (datos.gov.co) returns 26 records marked "Abierto" with publication dates from Jan 2023 and closing dates from Jan–Feb 2023 — all expired. The SECOPClient `_build_query` had no publication date floor, and the sync service had no post-sync stale cleanup.
  - **Fix 1 — API filter**: Added `DEFAULT_PUBLICATION_LOOKBACK_DAYS = 730` (~2 years) to `SECOPClient`. `_build_query` now always appends `fecha_de_publicacion_del >= '<floor>'` to exclude old records at the API level.
  - **Fix 2 — Post-sync cleanup**: Added `close_stale_processes()` static method to `SECOPSyncService` that marks "Abierto" processes with past `closing_date` as "Cerrado". Called automatically at the end of every `synchronize()`.
  - **DB cleanup**: Ran `close_stale_processes()` on staging DB → 24 stale processes closed, 2 remain "Abierto" (null `closing_date`).
  - **Tests**: 6 new tests added (3 client query + 1 sync integration + 4 close_stale_processes edge cases). All 51 SECOP service tests passing.
- **SECOP Module — Deep code review, bug fixes & UI/UX overhaul**:
  - **Backend bug fixes**: Fixed `is_open` filter logic (BUG-1), `page_size` crash on invalid input (BUG-2), normalized role check (BUG-3), `SavedViewSerializer` duplicate name 500→400 (BUG-4), datetime parsing regex (EDGE-1), shared filter helper to eliminate duplication (EDGE-2), `prefetch_related` for N+1 query (EDGE-3), `bulk_update` for alert notifications (EDGE-4)
  - **Second review bug fixes (2026-03-19)**: Fixed serializer N+1 query using Python iteration over prefetch cache (ISSUE-004), alert `evaluate_process` false positives for None `base_price` (ISSUE-005), `_parse_date` returning string instead of `datetime.date` (ISSUE-006), `secop_my_classified` missing `prefetch_related` and `page_size` (ISSUE-007), `exportExcel` blob URL memory leak (ISSUE-008)
  - **UI/UX redesign**: All 8 SECOP components + 2 views redesigned with gradient headers, rounded-xl cards, ring borders, skeleton loading, terciary bg chips, improved empty states, consistent design system, and `data-testid` attributes throughout
  - **Store fix**: Added `ordering` param to `exportExcel` action (EDGE-8), debounced filter watcher, `URL.revokeObjectURL` in export, `page_size` from API response
  - **Backend tests**: 120/120 passing (33 models + 27 services + 7 alert service + 15 serializers + 30 views + 8 tasks)
  - **Frontend unit tests**: 53/53 passing (27 store + 26 components) — fixed 13 failures from UI text/class changes
  - **E2E improvements**: Eliminated all `waitForLoadState("networkidle")` from 8 spec files, replaced with `data-testid` waits
  - **Fake data**: Validated idempotency (`update_or_create`, `random.seed(42)`) and business rule compliance
  - **SECOP Saved Views**: Added ability to edit existing saved views (rename and update filters) — requested by user (2026-03-22)
- **E2E coverage audit — 100% flow coverage achieved (2026-03-19)**:
  - **Flow coverage: 107/107 covered**, 0 failing, 0 missing, 0 unmapped
  - **Quality Gate: 100/100** — 0 errors, 0 warnings, 0 infos
- **Previous E2E audit (2026-03-18)**: 4-phase audit that deepened P1 gaps, added missing P2 specs, split `router_guards` test, removed all 9 `knownGaps`
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

1. **SECOP Module** ✅ — Fully complete: implementation, bug fixes, UI/UX redesign, backend tests (120), frontend tests (53), E2E (22 tests across 8 specs), fake data validated, 12/12 flows registered in `flow-definitions.json` and `USER_FLOW_MAP.md` (all ✅)
   - **Remaining**: Live data sync verification (`python manage.py sync_secop`) — requires SECOP API access
   - **Fixed (2026-03-19)**: E2E `secop-alert-create-flow.spec.js` — 2 `data-testid` mismatches (`alert-form` → `alert-form-modal`, `alert-name-input` → `alert-name`)
2. **Review and prioritize** the 12 planned features in `docs/next_requirements/`
3. **Address tech debt** — Clean up backup files, modularize large files
4. **Continue test coverage** — Maintain and expand backend/frontend/E2E test suites
5. **Production hardening** — Log rotation, secret key enforcement, backup verification
