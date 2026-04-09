# Repository Guidelines

## Project Identity

- **Name**: GM Consultores Juridicos
- **Domain**: `gmconsultoresjuridicos.com` / `www.gmconsultoresjuridicos.com`
- **Stack**: Django 5 + DRF (backend) / Vue 3 + Vite (frontend) / MySQL 8 / Redis / Huey
- **Server path**: `/home/ryzepeck/webapps/gym_project`
- **Staging path**: `/home/ryzepeck/webapps/gym_project_staging`
- **Services**: `gym_intranet` (Gunicorn), `gym-project-huey` (task queue)
- **Settings module**: `DJANGO_SETTINGS_MODULE=gym_project.settings_prod`

## Codex Workflow
- `AGENTS.md` is the canonical repository instruction file for Codex.
- Repository-managed Codex skills live in `.agents/skills/gym-*/`.
- Install/update repo-managed skills with `scripts/install-codex-skills.sh --force --remove-stale`; the default global install target is `~/.agents/skills`.
- User-level Codex configuration lives in `~/.codex/config.toml`; user-level skills belong in `~/.agents/skills`.
- Validate skill structure with `scripts/check-codex-skills.sh`.
- Add project-level Codex configuration in `.codex/config.toml` when project defaults are needed.
- Legacy `.claude/` assets are reference-only and must not be treated as the active Codex standard.

## Mandatory Skill Usage
- Use `gym-plan` before non-trivial architecture, workflow, or scope changes.
- Use `gym-implement` for multi-file implementation work.
- Use `gym-debugme` for diagnosis-first debugging tasks.
- Use manual-only operational skills only on explicit user request: `gym-git-sync`, `gym-git-commit`, `gym-deploy-staging`, `gym-deploy-and-check`, `gym-server-diagnostic-report`.

## General Rules

Always apply these:
1. Split into multiple responses if one response isn't enough.
2. Suggest improvements after completing tasks:
   - S1: Code stability or scalability
   - S2: Performance or security
   - S3: Readability or maintainability

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
