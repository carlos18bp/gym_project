# Repository Guidelines

## Project Structure & Module Organization
- `backend/` contains the Django API and domain logic. Core app code lives in `backend/gym_app/` (`models/`, `serializers/`, `views/`, `services/`).
- Backend tests are organized by domain under `backend/gym_app/tests/` (for example `views/`, `models/`, `serializers/`, `tasks/`, `utils/`).
- `frontend/src/` contains the Vue 3 app (`views/`, `components/`, `stores/`, `composables/`).
- Frontend unit/component tests live in `frontend/test/**/*.test.js`; Playwright E2E specs live in `frontend/e2e/**/*.spec.js`.
- Shared automation is in `scripts/`; process and architecture references are in `docs/`.

## Build, Test, and Development Commands
Run from repo root unless noted:
```bash
python backend/manage.py migrate
python backend/manage.py runserver
cd frontend && npm install && npm run dev
cd frontend && npm run build
cd backend && pytest gym_app/tests/views/test_health.py -v
python backend/scripts/run-tests-blocks.py
cd frontend && npm run test
cd frontend && npm run e2e -- e2e/policies/policies-navigation.spec.js
python scripts/run-tests-all-suites.py
pre-commit run test-quality-gate --all-files
```

## Coding Style & Naming Conventions
- Follow existing local patterns before introducing new abstractions.
- Python uses `snake_case` for modules/functions and `PascalCase` for Django model classes.
- Vue components use `PascalCase.vue`; JS module names should match surrounding conventions.
- Keep changes focused and reviewable: one concern per PR.
- Frontend linting uses ESLint; test-quality checks run through pre-commit hooks.

## Testing Guidelines
- Backend uses `pytest` with markers `edge`, `contract`, and `integration` (see `backend/pytest.ini`).
- Frontend unit/component testing uses Jest + Vue Test Utils (`npm run test`, `npm run test:coverage`).
- Frontend E2E testing uses Playwright (`npm run e2e`), with specs organized by feature area.
- Name tests by behavior and add regression tests for modified logic.

## Commit & Pull Request Guidelines
- Commit prefixes: `FEAT:`, `FIX:`, `REFACTOR:`, `TEST:`, `DOCS:`, `CHORE:`.
- PR descriptions should include: **What**, **Why**, **How**, and **Testing**.
- Explicitly flag breaking changes, migrations, environment variable changes, and post-deploy manual steps.

## Security & Configuration Tips
- Initialize config from templates: `cp backend/.env.example backend/.env` and review `frontend/.env.example`.
- Never commit secrets, credentials, or production keys; keep sensitive values in environment variables.
