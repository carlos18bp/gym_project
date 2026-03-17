---
trigger: model_decision
description: Project intelligence and lessons learned. Reference for project-specific patterns, preferences, and key insights discovered during development.
---

# Lessons Learned — GymProject

This file captures important patterns, preferences, and project intelligence that help work more effectively with this codebase. Updated as new insights are discovered.

---

## 1. Architecture Patterns

- **Domain-split models**: Models are organized by business domain in separate files under `backend/gym_app/models/` (user.py, process.py, dynamic_document.py, organization.py, etc.). All exported via `__init__.py` with explicit `__all__`.
- **Sub-packaged views**: Complex view domains use sub-packages (`views/dynamic_documents/` has 6 files: document_views, permissions, permission_views, relationship_views, signature_views, tag_folder_views). Simpler domains are single files.
- **Modular Pinia stores**: Complex stores use sub-module pattern (e.g., `stores/dynamic_document/` has state.js, getters.js, index.js, tags.js, permissions.js, relationships.js, filters.js, plus `folders/` sub-package with actions/getters/state/utilities/index).
- **Composables for cross-cutting concerns**: `useIdleLogout`, `usePWAInstall`, `useSearch`, `useRecentViews`, `useSendEmail`, `useBasicUserRestrictions`, `useDocumentRelationships`, `useDocumentPermissions`, `useDocumentTags`.
- **Centralized HTTP service**: All API calls go through `stores/services/request_http.js` (Axios instance with JWT interceptor).
- **SlideBar layout wrapper**: All authenticated routes use `SlideBar` component as parent, with the actual page as a child route.
- **Lazy route loading**: Every route uses dynamic `import()` with webpack chunk names for code splitting.
- **Two task files**: Business tasks in `gym_app/tasks.py` (subscription billing), infrastructure tasks in `gym_project/tasks.py` (backups, Silk GC, slow query reports).
- **Frontend build integration**: `npm run build` runs Vite build + `scripts/generate-django-template.cjs` to produce a Django-compatible template for serving the SPA.

---

## 2. Code Style & Conventions

- **Language**: UI text is in **Spanish** (route titles, button labels, email templates). Code comments and documentation are in **English**.
- **Python**: Ruff for linting. No type hints enforced globally. Snake_case for everything.
- **JavaScript**: ES Modules (`"type": "module"` in package.json). No TypeScript. `.js` extensions for all source and test files, `.vue` for components. `.cjs` for config files (jest.config.cjs, babel.config.cjs).
- **Vue components**: Options API not used — all components use Composition API or `<script setup>` style.
- **Route naming**: Snake_case for route names (e.g., `sign_in`, `process_list`, `legal_request_detail`).
- **Store naming**: Domain-based directory structure. Store files use snake_case (e.g., `legal_request.js`, `activity_feed.js`).
- **API URL patterns**: Mixed conventions — older auth endpoints use underscores (`sign_on/`, `update_password/`), newer feature endpoints use kebab-case (`dynamic-documents/`, `legal-requests/`, `corporate-requests/`). Named URL patterns mostly use kebab-case (e.g., `name='create-legal-request'`), with some older ones using underscores.
- **Test file naming**: Backend: `test_<feature>.py`. Frontend unit: `<store/component>.test.js`. E2E: `<flow-name>.spec.js`.
- **Email templates**: Dual format — `.mjml` source + `.html` compiled output in `templates/emails/<type>/`.
- **User roles**: 4 roles as string choices: `client`, `lawyer`, `basic`, `corporate_client`.

---

## 3. Development Workflow

- **Virtual environment**: Always activate before backend commands: `source backend/venv/bin/activate`.
- **Fake data**: `python backend/manage.py create_fake_data` seeds realistic test data. `delete_fake_data --confirm` cleans up. Individual commands exist for specific domains (create_clients_lawyers, create_processes, create_dynamic_documents, create_legal_requests, create_organizations, create_activity_logs).
- **Test execution**: Never run entire suite. Target specific files. Max 20 tests or 3 commands per cycle. Use block runner for full backend coverage in low-RAM environments.
- **Block runner**: `python backend/scripts/run-tests-blocks.py` splits tests by marker (edge, contract, integration, rest) × group (models, serializers, views, etc.) with configurable chunk sizes and resume capability.
- **All-suites runner**: `python scripts/run-tests-all-suites.py` runs backend blocks + frontend unit + frontend E2E in parallel with live progress and coverage report.
- **Quality gate**: `python3 scripts/test_quality_gate.py --repo-root .` runs before commit (pre-commit hook) and in CI (GitHub Actions).
- **E2E modules**: Tests are organized by flow and tagged with `@module:<name>`. Run by module: `npm run e2e:module -- auth`.
- **Git workflow**: Pre-commit hooks enforce quality gate on staged test files. CI runs on PR to main/master.
- **Silk profiling**: Opt-in via `ENABLE_SILK=true` in `.env`. Dashboard at `/silk/` (staff only). GC runs daily, weekly slow-query report generated automatically.

---

## 4. Testing Insights

- **Backend test markers**: `edge`, `contract`, `integration` (custom markers). Tests without markers are `rest`.
- **Backend test groups**: models, serializers, tasks, utils, views, commands, root.
- **pytest configuration**: `backend/pytest.ini` with Django settings, test discovery, and marker definitions.
- **Frontend test config**: `frontend/jest.config.cjs` with jsdom environment, Vue 3 transform, module aliases, coverage thresholds.
- **E2E flow definitions**: `frontend/e2e/flow-definitions.json` maps all user flows. E2E specs must tag `@flow:<flow-id>`.
- **E2E coverage**: Istanbul instrumentation via Vite plugin (`babel-plugin-istanbul`). Run with `npm run e2e:coverage`.
- **E2E helpers**: Custom scripts in `frontend/scripts/` for modules listing, coverage per module, AST parsing.
- **E2E viewports**: Desktop Chrome (default), Mobile Chrome (Pixel 5), Tablet (iPad Mini) — configurable in `playwright.config.mjs`.
- **Test data samples**: `frontend/test/data_sample/` contains mock data for unit tests.
- **Coverage reporting**: Backend uses pytest-cov with branch coverage. Frontend uses Jest coverage with JSON summary. E2E uses flow-coverage.json.

---

## 5. Deployment Knowledge

- **Production server**: Gunicorn serving Django. Frontend built as static files and served through Django.
- **Database**: MySQL in production (mysqlclient). SQLite in development.
- **Task queue**: Redis required in production for Huey. Immediate mode (synchronous) in development.
- **Backups**: Automated daily at 3AM via Huey. 20-backup retention. Storage path configurable via `BACKUP_STORAGE_PATH`.
- **CORS**: django-cors-headers. Production origins configured via `CORS_ALLOWED_ORIGINS` env var.
- **CSRF**: Django CSRF middleware active. Production trusted origins via `CSRF_TRUSTED_ORIGINS` env var.
- **Static files**: `STATIC_ROOT` at `backend/staticfiles/`. Collected via `collectstatic`.
- **Media files**: Local filesystem at `backend/media/`. No cloud storage integration yet.

---

## 6. System-Specific Gotchas

- **Huey immediate mode**: In development, tasks run synchronously. No need for Redis or `run_huey`. But behavior may differ from production where tasks are async.
- **User model**: Custom user model at `gym_app.User` extending `AbstractUser`. Must always reference via `AUTH_USER_MODEL` or `get_user_model()`.
- **Large files**: `user_guide.js` (143KB) and `reports.py` (74KB) are maintenance risks — consider modularization before adding features to them.
- **Backup file**: `useDocumentPermissions_backup.js` exists in composables — leftover from a refactor, should be cleaned up.
- **Empty file**: `check_tags.py` in backend root is 0 bytes — can be safely removed.
- **Debug log**: `backend/debug.log` grows unbounded (6.7MB) — needs rotation or size limit in production.
- **Settings split**: `settings.py` imports `settings_dev.py` or `settings_prod.py` based on `DJANGO_ENV`. Environment-specific overrides go in those files.
