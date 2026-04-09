# Repository Guidelines
# GM Consultores Juridicos — Codex Configuration

## Project Identity

- **Name**: GM Consultores Juridicos
- **Domain**: `gmconsultoresjuridicos.com` / `www.gmconsultoresjuridicos.com`
- **Stack**: Django 5 + DRF (backend) / Vue 3 + Vite (frontend) / MySQL 8 / Redis / Huey
- **Server path**: `/home/ryzepeck/webapps/gym_project`
- **Staging path**: `/home/ryzepeck/webapps/gym_project_staging`
- **Services**: `gym_intranet` (Gunicorn), `gym-project-huey` (task queue)
- **Settings module**: `DJANGO_SETTINGS_MODULE=gym_project.settings_prod`

---

## General Rules

These should be respected ALWAYS:
1. Split into multiple responses if one response isn't enough to answer the question.
2. IMPROVEMENTS and FURTHER PROGRESSIONS:
   - S1: Suggest ways to improve code stability or scalability.
   - S2: Offer strategies to enhance performance or security.
   - S3: Recommend methods for improving readability or maintainability.
   - Recommend areas for further investigation

---

## Codex Workflow

- `AGENTS.md` is the canonical repository instruction file for Codex.
- Repository-managed Codex skills live in `.agents/skills/*/`.
- Codex auto-discovers skills from `.agents/skills/` in the repository root — no installation step required.
- User-level Codex configuration lives in `~/.codex/config.toml`.
- Validate skill structure with `scripts/check-codex-skills.sh`.
- Add project-level Codex configuration in `.codex/config.toml` when project defaults are needed.

## Mandatory Skill Usage

- Use `plan` before non-trivial architecture, workflow, or scope changes.
- Use `implement` for multi-file implementation work.
- Use `debugme` for diagnosis-first debugging tasks.
- Use manual-only operational skills only on explicit user request: `git-sync`, `git-commit`, `deploy-staging`, `deploy-and-check`, `server-diagnostic-report`.

---

## Security Rules — OWASP / Secrets / Input Validation

### Secrets and Environment Variables

NEVER hardcode secrets. Always use environment variables.

```python
# ✅ Django — use env vars
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DATABASE_URL = os.environ['DATABASE_URL']
STRIPE_API_KEY = os.environ['STRIPE_SECRET_KEY']

# ❌ NEVER do this
SECRET_KEY = 'django-insecure-abc123xyz'
DATABASE_URL = 'mysql://root:password123@localhost/mydb'
```

```javascript
// ✅ Vue — use env vars via import.meta.env
const apiUrl = import.meta.env.VITE_API_URL

// ❌ NEVER do this
const API_KEY = 'sk-live-abc123xyz'
```

### .env Rules

- `.env` files MUST be in `.gitignore`. Always verify before committing.
- Use `.env.example` with placeholder values for documentation.
- Separate env files per environment: `.env.local`, `.env.staging`, `.env.production`.
- Server secrets (API keys, DB passwords) NEVER go in client-side env vars.

### Input Validation

NEVER trust user input. Validate on both server AND client.

```python
# ✅ Serializer validates input
class OrderSerializer(serializers.Serializer):
    email = serializers.EmailField()
    quantity = serializers.IntegerField(min_value=1, max_value=100)
    product_id = serializers.IntegerField()

    def validate_product_id(self, value):
        if not Product.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError('Product not found')
        return value

# ❌ Using raw request data — no validation
def create_order(request):
    product_id = request.data['product_id']
    Order.objects.create(product_id=product_id)
```

### SQL Injection Prevention

```python
# ✅ Django ORM — always safe
users = User.objects.filter(email=user_input)

# ✅ Raw SQL — use parameterized queries
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT * FROM users WHERE email = %s", [user_input])

# ❌ NEVER interpolate user input into SQL
cursor.execute(f"SELECT * FROM users WHERE email = '{user_input}'")
```

### XSS Prevention

```javascript
// ✅ Vue auto-escapes with {{ }}
// <p>{{ userInput }}</p>

// ❌ NEVER use v-html with user input
// <div v-html="userInput" />

// If you MUST render HTML, sanitize first
import DOMPurify from 'dompurify'
const clean = DOMPurify.sanitize(userInput)
```

### CSRF Protection

```python
# ✅ Django — CSRF middleware is on by default, keep it
MIDDLEWARE = [
    'django.middleware.csrf.CsrfViewMiddleware',  # NEVER remove
    ...
]

# ✅ DRF — use JWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}
```

### Authentication and Authorization

```python
# ✅ Always check permissions
from rest_framework.permissions import IsAuthenticated

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)
```

### Sensitive Data Exposure

```python
# ✅ Exclude sensitive fields from serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name']
        # password, tokens, internal IDs excluded

# ❌ Exposing everything
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'  # leaks password hash, tokens, etc.
```

### HTTP Security Headers

```python
# settings.py
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_SSL_REDIRECT = True  # production only
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
```

### File Upload Security

```python
# ✅ Validate file type and size
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_upload(file):
    ext = Path(file.name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f'File type {ext} not allowed')
    if file.size > MAX_FILE_SIZE:
        raise ValidationError('File too large')
```

### Security Checklist — Before Every Deployment

- [ ] No secrets in code or git history
- [ ] `.env` is in `.gitignore`
- [ ] All user input is validated (server + client)
- [ ] No raw SQL with user input
- [ ] No `v-html` with user data
- [ ] CSRF protection enabled
- [ ] Authentication required on all sensitive endpoints
- [ ] Serializers exclude sensitive fields
- [ ] Security headers configured
- [ ] `pip audit` / `npm audit` clean
- [ ] File uploads validated
- [ ] DEBUG = False in production
- [ ] ALLOWED_HOSTS configured properly

---

## Memory Bank System

This project uses a Memory Bank to maintain context across sessions. Always read the relevant files before significant implementation or planning tasks.

### Core Files (Required)

| # | File | Purpose |
|---|------|---------|
| 1 | `docs/methodology/product_requirement_docs.md` | PRD: why this project exists, core requirements, scope |
| 2 | `docs/methodology/architecture.md` | System architecture, component relationships |
| 3 | `docs/methodology/technical.md` | Tech stack, dev setup, design patterns, constraints |
| 4 | `tasks/tasks_plan.md` | Task backlog, progress tracking, known issues |
| 5 | `tasks/active_context.md` | Current work focus, recent changes, next steps |
| 6 | `docs/methodology/error-documentation.md` | Known errors and resolutions |
| 7 | `docs/methodology/lessons-learned.md` | Project intelligence, patterns, preferences |

### When to Read Memory Files

- Before significant implementation tasks, read the relevant core files.
- Before planning tasks, read `docs/methodology/` and `tasks/`.
- When debugging, check `docs/methodology/error-documentation.md` for previously solved issues.

### When to Update Memory Files

1. After discovering new project patterns.
2. After implementing significant changes.
3. When the user requests **update memory files** (review ALL core files).
4. After a significant part of a plan is verified.

Focus on `tasks/active_context.md` and `tasks/tasks_plan.md` as they track current state. Use the `methodology-setup` skill to refresh all memory files when they need a full update.

---

## Project Structure & Module Organization

- `backend/` — Django API and domain logic.
  - `backend/gym_app/models/` — domain-split model sub-packages.
  - `backend/gym_app/serializers/`, `views/`, `services/` — standard DRF layers.
  - `backend/gym_app/tests/` — tests organized by domain (`views/`, `models/`, `serializers/`, `tasks/`, `utils/`).
- `frontend/src/` — Vue 3 app (`views/`, `components/`, `stores/`, `composables/`).
  - `frontend/test/**/*.test.js` — Jest unit/component tests.
  - `frontend/e2e/**/*.spec.js` — Playwright E2E specs organized by feature area.
- `scripts/` — shared automation.
- `docs/` — process and architecture references.
- `.agents/skills/` — repository-managed Codex skills.
- `.codex/config.toml` — project-level Codex configuration.

---

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

---

## Testing Rules

### Execution Constraints

- **Never run the full test suite** — always specify files.
- **Maximum per execution**: 20 tests per batch, 3 commands per cycle.
- **Backend**: Always activate venv first: `source backend/venv/bin/activate && pytest path/to/test_file.py -v`
- **Frontend unit**: `npm test -- path/to/file.test.js`
- **E2E**: max 2 files per `npx playwright test` invocation.
- Use `E2E_REUSE_SERVER=1` when the dev server is already running.

### Quality Standards

Full reference: `docs/TESTING_QUALITY_STANDARDS.md`

- Each test verifies **ONE specific behavior**.
- **No conjunctions** in test names — split into separate tests.
- Assert **observable outcomes** (status codes, DB state, rendered UI).
- **No conditionals** in test body — use parameterization.
- Follow **AAA pattern**: Arrange → Act → Assert.
- Mock only at **system boundaries** (external APIs, clock, email).

---

## Coding Style & Naming Conventions

- Follow existing local patterns before introducing new abstractions.
- Python: `snake_case` for modules/functions, `PascalCase` for Django model classes.
- Vue components: `PascalCase.vue`; JS module names match surrounding conventions.
- **No TypeScript** — the frontend uses plain JavaScript with ES Modules (`.js` extensions).
- Vue components use **Composition API with `<script setup>`** syntax.
- Keep changes focused and reviewable: one concern per PR.
- Frontend linting: ESLint. Test quality checks: pre-commit hooks.

---

## Commit & Pull Request Guidelines

- Commit prefixes: `FEAT:`, `FIX:`, `REFACTOR:`, `TEST:`, `DOCS:`, `CHORE:`.
- PR descriptions must include: **What**, **Why**, **How**, and **Testing**.
- Explicitly flag breaking changes, migrations, environment variable changes, and post-deploy manual steps.

---

## Lessons Learned

### Language & UI Conventions

- **Spanish UI, English code**: All user-facing text in the frontend is in Spanish. All code comments, documentation, and commit messages are in English.

### User Roles

- The system defines four user roles: `client`, `lawyer`, `basic`, `corporate_client`.
- Permissions and views are scoped based on these roles.

### Architecture Patterns

- **Domain-split models**: Models are split into sub-packages under `backend/gym_app/models/`. Each domain area has its own model file.
- **Pinia sub-module pattern**: Pinia stores use a sub-module pattern for complex state. Related store logic is grouped into sub-modules.
- **SlideBar layout wrapper**: Authenticated routes use a `SlideBar` layout wrapper that provides the consistent navigation sidebar.
- **Two task files**:
  - `gym_app/tasks.py` — business logic tasks (notifications, SECOP sync).
  - `gym_project/tasks.py` — infrastructure tasks (cleanup, maintenance).
- **Frontend build**: Vite + a Django template generation script that bridges Vite output into Django templates.

### Known Patterns & Gotchas

- **SweetAlert2 selector**: Use `[class~="swal2-popup"]` to target SweetAlert2 popups in tests and styles.
- **SECOP alert evaluations**: Require careful null checks for budget ranges. Always guard against missing or incomplete budget data.
- **`prefetch_related` and `.all()`**: When filtering prefetched querysets in Python, always call `.all()` on the cached relation before filtering. Direct filtering bypasses the prefetch cache and hits the database.

---

## Error Documentation

### Known Issues

#### [ISSUE-004] Prefetch_related cached filtering requires `.all()`
- **Context**: Filtering a prefetched relation without `.all()` bypasses the cache.
- **Workaround**: Always call `.all()` on the prefetched relation before filtering in Python.

#### [ISSUE-009] SECOP sync stale "Abierto" records from 2023
- **Context**: SECOP synchronization was retaining stale records with status "Abierto" from 2023.
- **Workaround**: Added date filtering and post-sync cleanup for outdated records.

#### Debug.log Growth
- **Context**: `debug.log` grows unbounded in production, consuming disk space.
- **Workaround**: Implement log rotation for `debug.log`.

### Resolved Issues

#### [RESOLVED-001] E2E bypassCaptcha relies on `window.__e2eCaptchaVerified`
- **Context**: E2E tests needed to bypass Google reCAPTCHA during automated testing.
- **Resolution**: The `bypassCaptcha` helper sets `window.__e2eCaptchaVerified` via a `grecaptcha` stub. Relying on Vue internals for captcha state was unreliable across versions.

---

## Security & Environment Setup

- Initialize config from templates: `cp backend/.env.example backend/.env` and review `frontend/.env.example`.
- Never commit secrets, credentials, or production keys.
- Run `pip audit` (Python) and `npm audit` (Node) before deployments.
