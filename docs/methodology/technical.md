# Technical Documentation — G&M Internal Management Tool

## 1. Technology Stack

### Backend

| Category | Technology | Version |
|----------|-----------|---------|
| Language | Python | 3.12 |
| Framework | Django | 5.0.6 |
| REST API | Django REST Framework | 3.15.2 |
| Authentication | SimpleJWT | 5.3.1 |
| Task Queue | Huey | 2.5.2 |
| Queue Backend | Redis | 5.2.1 |
| Database (dev) | SQLite | built-in |
| Database (prod) | MySQL | mysqlclient 2.2.7 |
| Production Server | Gunicorn | 23.0.0 |
| PDF Generation | xhtml2pdf 0.2.17, PyMuPDF 1.25.3, reportlab 4.2.5 |
| Document Processing | python-docx 1.1.2, PyPDF2 3.0.1, pypdf 5.3.0, openpyxl 3.1.5, XlsxWriter 3.2.0, pandas 2.2.2 |
| Image Processing | Pillow 10.4.0, opencv-python-headless 4.11.0.86 |
| Digital Signatures | pyHanko 0.25.3 |
| QR Codes | qrcode 8.0 |
| OAuth | google-auth 2.48.0 |
| File Validation | python-magic 0.4.27 |
| Environment Config | python-decouple 3.8 |
| Backups | django-dbbackup 4.2.1 |
| Query Profiling | django-silk 5.3.2 |
| Test Data | Faker 25.9.1 |
| Linting | Ruff |
| Testing | pytest 8.3.5, pytest-django 4.11.1, pytest-cov 6.1.0, coverage 7.8.0 |

### Frontend

| Category | Technology | Version |
|----------|-----------|---------|
| Language | JavaScript (ES Modules) | — |
| Framework | Vue | 3.4 |
| Build Tool | Vite | 6.4.1 |
| State Management | Pinia | 2.1.7 |
| Routing | Vue Router | 4.3.2 |
| Styling | TailwindCSS | 3.4.3 |
| UI Components | Headless UI 1.7.23, Heroicons 2.1.5, Flowbite 2.3.0, Bootstrap Icons 1.11.3 |
| HTTP Client | Axios | 1.7.2 |
| Rich Text Editor | TinyMCE | 7.7.0 |
| Animations | GSAP | 3.12.7 |
| Alerts | SweetAlert2 | 11.14.0 |
| Carousel | Swiper | 11.2.6 |
| Document Export | docx 9.1.1, file-saver 2.0.5 |
| Auth | vue3-google-login 2.0.33, vue3-recaptcha2 1.8.0 |
| PWA | vite-plugin-pwa | 1.2.0 |
| Unit Testing | Jest 29.7.0, @vue/test-utils 2.4.6 |
| E2E Testing | Playwright | 1.41.2 |
| Linting | ESLint 9.39.2 (jest, jest-dom, playwright plugins) |
| Node.js | >= 22.13.0 (pinned in .nvmrc) |

### DevOps & Tooling

| Category | Technology |
|----------|-----------|
| Pre-commit | pre-commit hooks with custom test quality gate |
| CI | GitHub Actions (`.github/workflows/test-quality-gate.yml`) |
| Quality Gate | Custom Python analyzer (`scripts/test_quality_gate.py`) — backend, frontend-unit, frontend-e2e |
| CORS | django-cors-headers 4.4.0 |

---

## 2. Development Setup

### Prerequisites

```bash
# System dependencies (Linux)
sudo apt install python3-pip python3-virtualenv npm silversearcher-ag
sudo apt install libpangocairo-1.0-0 libpangoft2-1.0-0 libffi-dev libcairo2
```

### Backend Setup

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py createsuperuser
python backend/manage.py create_fake_data   # seed test data
python backend/manage.py runserver           # http://localhost:8000
```

### Frontend Setup

```bash
cd frontend
nvm use          # uses .nvmrc → Node 22.13.0
npm install
npm run dev      # http://localhost:5173
```

### Task Queue (optional)

```bash
source backend/venv/bin/activate
python backend/manage.py run_huey
```

> In development, Huey runs in `immediate` mode (tasks execute synchronously without Redis).

---

## 3. Environment Configuration

All configuration via `python-decouple` reading from `backend/.env`. See `backend/.env.example` for all variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_ENV` | `development` | Environment: `development` or `production` |
| `DJANGO_SECRET_KEY` | insecure default | Django secret key |
| `DJANGO_ALLOWED_HOSTS` | empty | Comma-separated allowed hosts |
| `DB_ENGINE` | `sqlite3` | Database engine |
| `DB_NAME` | `db.sqlite3` | Database name |
| `EMAIL_HOST_USER` | empty | SMTP username |
| `EMAIL_HOST_PASSWORD` | empty | SMTP password |
| `RECAPTCHA_SITE_KEY` | empty | Google reCAPTCHA site key |
| `RECAPTCHA_SECRET_KEY` | empty | Google reCAPTCHA secret key |
| `GOOGLE_CLIENT_ID` | empty | Google OAuth client ID |
| `WOMPI_ENVIRONMENT` | `test` | Wompi: `test` or `production` |
| `WOMPI_PUBLIC_KEY` | empty | Wompi public key |
| `WOMPI_PRIVATE_KEY` | empty | Wompi private key |
| `WOMPI_EVENTS_KEY` | empty | Wompi events webhook key |
| `WOMPI_INTEGRITY_KEY` | empty | Wompi integrity signature key |
| `REDIS_URL` | `redis://localhost:6379/1` | Redis URL for Huey |
| `BACKUP_STORAGE_PATH` | `/var/backups/gym_project` | Backup storage path |
| `ENABLE_SILK` | `false` | Enable django-silk profiling |
| `SECOP_DATASET_ID` | `bt96-ncis` | Socrata dataset ID for SECOP II |
| `SECOP_APP_TOKEN` | (empty) | Optional Socrata app token for higher rate limits |

Frontend environment: `frontend/.env` with `VITE_*` prefixed variables for client-side access.

---

## 4. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite (dev) / MySQL (prod)** | Simplicity for development; MySQL for production reliability |
| **SimpleJWT (not sessions)** | Stateless auth for SPA; 1-day access token lifetime |
| **Huey over Celery** | Lightweight; sufficient for subscription billing and backups; Redis as broker |
| **TinyMCE for rich text** | Full-featured editor for dynamic documents with variable injection |
| **django-silk (opt-in)** | Query profiling without production overhead; staff-only dashboard |
| **Vite over Webpack** | Faster HMR and build times; native ES module support |
| **Pinia over Vuex** | Official Vue 3 recommendation; simpler API; better TypeScript support potential |
| **TailwindCSS + Flowbite** | Utility-first styling with pre-built component library |
| **PWA via vite-plugin-pwa** | Offline-ready with minimal configuration; service worker auto-generation |
| **Pre-commit + CI quality gate** | Automated test quality enforcement on every commit and PR |
| **Socrata API (datos.gov.co)** | SECOP II public procurement data via `requests`; daily incremental sync; no SDK needed |

---

## 5. Design Patterns

| Pattern | Where Used |
|---------|-----------|
| **Custom User Model** | `gym_app.User` with `AbstractUser` + custom `UserManager` |
| **Domain-split Models** | Models organized by domain in separate files under `models/` |
| **Modular Views** | Views split into sub-packages (`dynamic_documents/`, `layouts/`) |
| **Pinia Modular Stores** | Stores organized by domain with sub-modules (e.g., `dynamic_document/` has state, getters, actions, index) |
| **Composables** | Vue composables for cross-cutting concerns (idle logout, PWA install, search, recent views, email) |
| **Route Guards** | Auth check + role-based access control in Vue Router `beforeEach` |
| **Lazy Route Loading** | All routes use dynamic `import()` with webpack chunk names |
| **Huey Periodic Tasks** | Scheduled backups (daily 3AM), Silk GC (daily 4AM), slow query reports (weekly Monday 8AM), SECOP sync (daily 6AM), alert summaries (daily 7AM / weekly Monday 7AM), purge closed processes (daily 3:30AM) |
| **Serializer Validation** | DRF serializers handle all input validation |
| **Email Templates** | MJML/HTML templates for transactional emails |

---

## 6. Testing Strategy

| Layer | Tool | File Count | Location |
|-------|------|------------|----------|
| Backend (models, serializers, views, tasks, utils, commands) | pytest + pytest-django | 63 test files | `backend/gym_app/tests/` |
| Frontend Stores | Jest + Vue Test Utils | 150 test files (total unit) | `frontend/test/stores/` |
| Frontend Components | Jest + Vue Test Utils | (included in 150) | `frontend/test/components/` |
| Frontend Composables | Jest + Vue Test Utils | (included in 150) | `frontend/test/composables/` |
| Frontend Views | Jest + Vue Test Utils | (included in 150) | `frontend/test/views/` |
| E2E User Flows | Playwright | 158 spec files | `frontend/e2e/` |

### Test Execution Rules

- **Never run entire test suite** — always target specific files
- **Max 20 tests per execution** or 3 commands per cycle
- Backend: `pytest backend/gym_app/tests/<domain>/test_<feature>.py -v`
- Frontend unit: `npm run test -- test/stores/<store>.test.js`
- Frontend E2E: `npm run e2e -- e2e/<flow>.spec.js`
- Block runner for RAM-constrained environments: `python backend/scripts/run-tests-blocks.py`

### Quality Gate

- Custom Python analyzer: `scripts/test_quality_gate.py`
- Modular analyzers: `scripts/quality/` (backend, frontend-unit, frontend-e2e)
- CI workflow: `.github/workflows/test-quality-gate.yml`
- Pre-commit hook integration
- Standards doc: `docs/TESTING_QUALITY_STANDARDS.md`

---

## 7. CI/CD

| Component | Configuration |
|-----------|---------------|
| CI Platform | GitHub Actions |
| Workflow | `.github/workflows/test-quality-gate.yml` |
| Triggers | PR paths (`tests/**`, `scripts/**`, `e2e/**`), push to `main`/`master` |
| Steps | Checkout → Python 3.12 → Node 22 → `npm ci` → quality gate → upload report |
| Pre-commit | `.pre-commit-config.yaml` with test quality gate hook |

---

## 8. Project Structure (Verified Counts)

```
gym_project/
├── backend/
│   ├── gym_project/          # Django project config (settings, urls, tasks, wsgi/asgi)
│   ├── gym_app/
│   │   ├── models/           # 13 files → 43 model classes (+ 1 UserManager) — incl. 6 SECOP models
│   │   ├── views/            # 23 files (incl. dynamic_documents/, layouts/, secop)
│   │   ├── serializers/      # 10 files — incl. secop.py
│   │   ├── services/         # 3 files (secop_client, secop_sync_service, secop_alert_service)
│   │   ├── utils/            # 3 files (auth_utils, captcha, email_notifications)
│   │   ├── management/commands/ # 10 commands (fake data CRUD, silk GC, sync_secop)
│   │   ├── templates/        # 19 email/PDF templates — incl. 2 SECOP alert templates
│   │   ├── tests/            # 63 test files (models, serializers, tasks, utils, views, commands)
│   │   ├── tasks.py          # Huey tasks (subscription billing)
│   │   ├── secop_tasks.py    # Huey tasks (SECOP sync, alerts, purge)
│   │   ├── urls.py           # 162 URL patterns (15 SECOP endpoints)
│   │   └── admin.py          # Django admin configuration
│   ├── scripts/              # run-tests-blocks.py (block-based test runner)
│   ├── requirements.txt      # 99 lines, production dependencies
│   └── requirements-dev.txt  # Dev dependencies (pre-commit, ruff)
│
├── frontend/
│   ├── src/
│   │   ├── components/       # 109 Vue components (12 subdirectories) — incl. secop/
│   │   ├── views/            # 36 page-level components (14 subdirectories) — incl. secop/
│   │   ├── stores/           # 35 store files (10 domain directories + 3 root files) — incl. secop/
│   │   ├── composables/      # 10 composable files (incl. document-variables/)
│   │   ├── router/           # 1 file, 48 route definitions
│   │   ├── shared/           # Utilities (alerts, color palette, submit handler)
│   │   └── animations/       # GSAP animation helpers
│   ├── test/                 # 150 unit test files (11 subdirectories)
│   ├── e2e/                  # 158 E2E spec files
│   ├── scripts/              # E2E helper scripts (modules, coverage, AST parser)
│   └── package.json          # 78 lines
│
├── scripts/                  # Repository-level scripts
│   ├── test_quality_gate.py  # Test quality gate analyzer
│   ├── run-tests-all-suites.py # Parallel test suite runner
│   └── quality/              # Quality gate analyzers per suite
│
├── docs/                     # Project documentation
├── .github/workflows/        # CI workflows
└── .pre-commit-config.yaml   # Pre-commit hook configuration
```

---

## 9. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| Node.js version | >= 22.13.0 (pinned via `.nvmrc`) |
| Python version | 3.12 (CI uses `python-version: '3.12'`) |
| Database (dev) | SQLite — single-file, no concurrent writes under load |
| Database (prod) | MySQL via `mysqlclient` |
| Task queue | Huey in `immediate` mode for dev (no Redis needed); Redis required for production |
| File storage | Local filesystem (`media/`); no S3/cloud storage |
| Email | SMTP via Gmail; requires app password |
| Payments | Wompi gateway (Colombia-specific); test/production environments |
