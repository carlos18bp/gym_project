# Unified Architecture
## Backend Django REST + Frontend Vue 3

**Development Standards and Patterns Guide**

This document consolidates and standardizes architecture best practices for fullstack projects, unifying three reference templates into a single corporate standard.

**Version 1.1 - February 2026**

---

## Table of Contents

0. [Current Implementation Snapshot (gym_project)](#0-current-implementation-snapshot-gym_project)
1. [Architecture Overview](#1-architecture-overview)
2. [Backend - Django REST Framework](#2-backend---django-rest-framework)
   - 2.1 [Standard Folder Structure](#21-standard-folder-structure)
   - 2.2 [Configuration (settings.py)](#22-configuration-settingspy)
   - 2.3 [Domain Models](#23-domain-models)
   - 2.4 [Serializers](#24-serializers)
   - 2.5 [API Views (@api_view)](#25-api-views-api_view)
   - 2.6 [URLs by Module](#26-urls-by-module)
   - 2.7 [Custom Django Admin](#27-custom-django-admin)
   - 2.8 [Management Commands (Fake Data)](#28-management-commands-fake-data)
   - 2.9 [Services and Integrations](#29-services-and-integrations)
   - 2.10 [Documentation Conventions](#210-documentation-conventions)
   - 2.11 [Media and File Handling](#211-media-and-file-handling)
   - 2.12 [Testing (Backend)](#212-testing-backend)
3. [Frontend - Vue 3 + Vite + Pinia](#3-frontend---vue-3--vite--pinia)
   - 3.1 [Folder Structure](#31-folder-structure)
   - 3.2 [Configuration (main.js)](#32-configuration-mainjs)
   - 3.3 [HTTP Service (Axios + JWT)](#33-http-service-axios--jwt)
   - 3.4 [Pinia Stores (CRUD)](#34-pinia-stores-crud)
   - 3.5 [Router and Guards](#35-router-and-guards)
   - 3.6 [Localization Strategy (Current State)](#36-localization-strategy-current-state)
   - 3.7 [Testing (Frontend)](#37-testing-frontend)
4. [Standard Dependencies](#4-standard-dependencies)
5. [Execution Commands](#5-execution-commands)
6. [New Project Checklist](#6-new-project-checklist)

---

## 0. Current Implementation Snapshot (gym_project)

This section reflects the architecture currently implemented in this repository (`gym_project`).

### 0.1 Backend snapshot

- Django project package: `backend/gym_project/`
- Main app package: `backend/gym_app/`
- Root API wiring: `backend/gym_project/urls.py` mounts `path('api/', include('gym_app.urls'))`
- SPA fallback routing is served by Django (`SPAView`) for non-API routes.
- Domain code is organized by package:
  - `gym_app/models/`
  - `gym_app/serializers/`
  - `gym_app/views/` (including `views/dynamic_documents/`)
  - `gym_app/management/commands/`
  - `gym_app/utils/`
- Async/scheduled infrastructure is configured through Celery (`backend/gym_project/celery.py`) and app tasks (`backend/gym_app/tasks.py`).

### 0.2 Frontend snapshot

- SPA stack: Vue 3 + Vite (`frontend/src/`)
- Router and guards: `frontend/src/router/index.js`
- Domain stores: `frontend/src/stores/` (`auth/`, `legal/`, `organizations/`, `dynamic_document/`, `subscriptions/`, etc.)
- Shared HTTP client wrapper: `frontend/src/stores/services/request_http.js`
- PWA integration via Vite plugin (`frontend/vite.config.js` + `virtual:pwa-register` in `main.js`).

### 0.3 Testing and quality snapshot

- Backend tests: `backend/gym_app/tests/**` with pytest config in `backend/pytest.ini`
- Segmented backend execution: `backend/scripts/run-tests-blocks.py`
- Frontend unit tests: Jest (`frontend/jest.config.cjs`, `frontend/test/**`)
- Frontend E2E: Playwright (`frontend/playwright.config.mjs`, `frontend/e2e/**`)
- Test quality gate orchestrator: `scripts/test_quality_gate.py`
- Modular analyzers: `scripts/quality/` + JS AST parser bridge at `frontend/scripts/ast-parser.cjs`.

## 1. Architecture Overview

This architecture defines the standard for fullstack projects that combine a robust backend with Django REST Framework and a modern frontend with Vue 3. The goal is to maximize code reuse, maintain consistency across projects, and facilitate onboarding of new developers.

### 1.1 Technology Stack

| Layer | Technology | Purpose |
|------|------------|-----------|
| Backend | Django 5.x + DRF | API REST, ORM, Admin |
| Authentication | SimpleJWT + Google token verification | API auth and federated sign-in |
| Database | SQLite (default local) | Local persistence (external DB optional per environment) |
| Async / Jobs | Celery + Redis (+ django-celery-beat when enabled) | Background and scheduled tasks |
| Frontend | Vue 3 + Vite | SPA with Composition API |
| State | Pinia (domain stores) | Reactive state management |
| Routing | Vue Router 4 | SPA navigation + role/auth guards |
| HTTP Client | Axios | API requests via shared request service |
| Styles | TailwindCSS | CSS utilities |
| PWA | vite-plugin-pwa | Installability + service worker updates |
| Testing | Pytest + Jest + Playwright | Unit, integration, and E2E validation |
| Quality Gate | `scripts/test_quality_gate.py` + `scripts/quality` | Static quality analysis for tests |

### 1.2 Design Principles

- **Separation of concerns:** Models, Serializers, Views, URLs clearly separated.
- **Modularity:** Each domain in its own module (separate files).
- **Reusability:** HTTP services, stores, and generic components.
- **Consistency:** Same API response patterns and store structure.
- **Security:** JWT by default, CORS configured, credentials in environment variables.
- **English documentation:** All code comments must be in English and use DocStrings.

---

## 2. Backend - Django REST Framework

### 2.1 Standard Folder Structure

```
backend/
├── manage.py
├── gym_project/                  # Django project package
│   ├── settings.py
│   ├── urls.py
│   ├── celery.py
│   ├── wsgi.py
│   └── asgi.py
├── gym_app/                      # Main domain app
│   ├── apps.py
│   ├── admin.py
│   ├── models/
│   ├── serializers/
│   ├── views/
│   │   └── dynamic_documents/
│   ├── urls.py                   # Grouped URL lists merged into urlpatterns
│   ├── management/commands/
│   ├── tests/
│   │   ├── models/
│   │   ├── serializers/
│   │   ├── views/
│   │   ├── tasks/
│   │   └── utils/
│   └── utils/
├── scripts/
│   └── run-tests-blocks.py
├── pytest.ini
└── requirements*.txt
```

> **Note:** The current implementation combines domain-based modular files (`models/`, `serializers/`, `views/`) with grouped URL lists in a central `gym_app/urls.py`.

---

### 2.2 Configuration (settings.py)

#### 2.2.1 Installed Apps

```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    # 'django_celery_beat',  # enable when scheduler app is installed/migrated
    'gym_app',
]
```

#### 2.2.2 REST Framework Configuration

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}
```

#### 2.2.3 JWT Configuration

```python
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
}
```

#### 2.2.4 CORS and Security

```python
CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
]

CSRF_TRUSTED_ORIGINS = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
]

# Custom user model (REQUIRED from the start)
AUTH_USER_MODEL = 'gym_app.User'
```

> **Important:** Credentials (SECRET_KEY, email keys, payment keys, OAuth keys) should be managed via environment variables and not hardcoded for production.

---

### 2.3 Domain Models

Domain entities are organized by business capability in `backend/gym_app/models/` and exported through `backend/gym_app/models/__init__.py`.

| Model module | Main entities |
| --- | --- |
| `user.py` | `User`, `ActivityFeed`, `UserSignature` |
| `process.py` | `Case`, `Stage`, `CaseFile`, `Process`, `RecentProcess` |
| `legal_request.py` | `LegalRequest`, `LegalRequestType`, `LegalDiscipline`, `LegalRequestFiles`, `LegalRequestResponse` |
| `corporate_request.py` | `CorporateRequest`, `CorporateRequestType`, `CorporateRequestFiles`, `CorporateRequestResponse` |
| `organization.py` | `Organization`, `OrganizationInvitation`, `OrganizationMembership`, `OrganizationPost` |
| `dynamic_document.py` | `DynamicDocument`, `DocumentVariable`, `DocumentSignature`, `Tag`, folder/permission/relationship models, `RecentDocument` |
| `intranet_gym.py` | `LegalDocument`, `IntranetProfile` |
| `subscription.py` | `Subscription`, `PaymentHistory` |
| `legal_update.py` | `LegalUpdate` |
| `email_verification_code.py`, `password_code.py` | Verification/recovery code models |

Implementation notes:

- `AUTH_USER_MODEL` is `gym_app.User`.
- Process and dynamic document modules model most of the domain complexity.
- File-backed entities (for example case files and legal request files) include cleanup and validation paths in model/view logic.

---

### 2.4 Serializers

Serializers mirror the domain split and live in `backend/gym_app/serializers/`.

| Serializer module | Main purpose |
| --- | --- |
| `user.py` | User and activity feed payloads |
| `process.py` | Process/case/stage serialization |
| `legal_request.py` | Detailed and list serializers, nested responses/files |
| `corporate_request.py` | Corporate request workflows |
| `organization.py` | Organizations, memberships, posts, invitations |
| `dynamic_document.py` | Dynamic document, variables, recent docs |
| `subscription.py` | Subscription and payment history |
| `intranet_gym.py`, `legal_update.py` | Intranet docs and legal updates |

Current serializer patterns used in the codebase:

- split serializers for detail vs listing where payload size matters (`LegalRequestSerializer` vs `LegalRequestListSerializer`),
- nested read-only relationships for rich detail views,
- computed fields through `SerializerMethodField` and `source=` mappings.

---

### 2.5 API Views (@api_view)

The backend uses function-based DRF views with `@api_view` across domain modules.

| View module | Responsibility |
| --- | --- |
| `userAuth.py` | Registration, login, password reset, token validation, Google auth |
| `user.py` | Profiles, signatures, user activities |
| `process.py` / `case_type.py` | Case/process CRUD and recent processes |
| `legal_request.py` / `corporate_request.py` | Legal and corporate request workflows |
| `organization.py` / `organization_posts.py` | Organization lifecycle, members, invitations, posts |
| `dynamic_documents/*` | Dynamic doc CRUD, signatures, permissions, tags/folders, relationships |
| `subscription.py` | Wompi config/signature/subscription/webhook endpoints |
| `captcha.py`, `reports.py`, `legal_update.py`, `intranet_gym.py` | Cross-domain support endpoints |

Current conventions:

- explicit `@permission_classes(...)` declarations,
- request-level validation and structured error responses,
- integration-heavy flows delegate to utility modules (captcha/email/notifications),
- URL names are stable and consumed by backend tests through `reverse()`.

---

### 2.6 URLs by Module

In the current implementation, URLs are grouped by functional lists inside a single app-level file (`backend/gym_app/urls.py`) and mounted from the project root.

```python
# backend/gym_project/urls.py
from django.urls import path, include
from django.urls import re_path
from gym_app.admin import admin_site
from gym_app.views.spa import SPAView

urlpatterns = [
    path('admin/', admin_site.urls),
    path('api/', include('gym_app.urls')),
]

urlpatterns += [
    re_path(r'^.*$', SPAView.as_view(), name='spa'),
]
```

```python
# backend/gym_app/urls.py (excerpt)
sign_in_sign_on_urls = [...]
user_urls = [...]
process_urls = [...]
legal_request_urls = [...]
dynamic_document_urls = [...]

urlpatterns = (
    sign_in_sign_on_urls
    + user_urls
    + process_urls
    + legal_request_urls
    + dynamic_document_urls
    # ... additional grouped URL lists
)
```

#### Endpoint Convention

| Action | Method | URL | Name |
|--------|--------|-----|------|
| List | GET | /api/entities/ | list-entities |
| Detail | GET | /api/entities/{id}/ | retrieve-entity |
| Create | POST | /api/entities/create/ | create-entity |
| Update | PUT/PATCH | /api/entities/{id}/update/ | update-entity |
| Delete | DELETE | /api/entities/{id}/delete/ | delete-entity |

---

### 2.7 Custom Django Admin

The project uses a custom admin site (`GyMAdminSite`) defined in `backend/gym_app/admin.py` and exposed through `backend/gym_project/urls.py` via:

```python
path('admin/', admin_site.urls)
```

Admin architecture highlights:

- custom dashboard grouping through `GyMAdminSite.get_app_list`,
- dedicated `ModelAdmin` classes per domain model,
- registration occurs against `admin_site` (not the default `admin.site`),
- grouped sections include User, Process, Legal Request, Corporate Request, Organization, Dynamic Documents, and dashboard-related models.

---

### 2.8 Management Commands (Fake Data)

Fake data and maintenance commands are located at `backend/gym_app/management/commands/`.

#### 2.8.1 Command Inventory

```
gym_app/management/commands/
├── create_fake_data.py          # Orchestrator command
├── delete_fake_data.py          # Cleanup command
├── create_clients_lawyers.py
├── create_organizations.py
├── create_legal_requests.py
├── create_processes.py
├── create_dynamic_documents.py
└── create_activity_logs.py
```

#### 2.8.2 Orchestration Flow (`create_fake_data`)

`create_fake_data.py` coordinates command execution in this sequence:

1. `create_clients_lawyers`
2. `create_organizations`
3. `create_legal_requests`
4. `create_processes`
5. `create_dynamic_documents`
6. `create_activity_logs`

It accepts:

- positional `number_of_records` (default `50`),
- `--activities_per_user` (default `40`),
- `--num_documents` (default `60`),
- `--num_legal_requests` (default `40`).

#### 2.8.3 Cleanup Command Notes (`delete_fake_data`)

- Current implementation deletes seeded data directly (no `--confirm` flag).
- Use only in development/test environments.
- Keep command behavior aligned with test fixtures and fake-data expectations.

---

### 2.9 Services and Integrations

Although there is no dedicated `services/` package yet, the backend uses focused integration modules and helpers.

Current integration points:

- **Google reCAPTCHA:** validated from auth endpoints through `gym_app.utils.captcha.verify_captcha`.
- **Google OAuth sign-in:** handled in `views/userAuth.py` with token verification.
- **Wompi billing:** subscription/payment flows in `views/subscription.py`, with periodic billing in `gym_app/tasks.py`.
- **Email notifications:** template-based emails (`views/layouts/sendEmail.py`) and legal request notifications (`utils/email_notifications.py`).
- **Secure file validation:** legal request uploads validate extension, MIME type, and size using `python-magic`.

---

### 2.10 Documentation Conventions

Current code includes both English and Spanish user-facing messages. For maintainability in this project:

- keep developer-facing comments/docstrings in English,
- keep product copy in the required user language,
- document non-trivial backend functions with Python docstrings,
- document non-trivial frontend helpers with concise JSDoc,
- avoid verbose comments for self-explanatory code.

---

### 2.11 Media and File Handling

The project currently handles file/media concerns through native Django storage and model/file validations (no vendored `django_attachments` module in this repository).

Current media architecture:

- `MEDIA_URL` and `MEDIA_ROOT` are configured in `gym_project/settings.py`.
- `gym_project/urls.py` serves media through `static(...)` routing.
- Upload-heavy areas include:
  - process case files,
  - legal request attachments,
  - dynamic document assets (letterheads/templates/signature resources).

Security and validation highlights:

- legal request uploads validate extension, MIME type, and max size,
- server-side MIME detection uses `python-magic`,
- frontend file uploads use `upload_file_request` with FormData and auth headers.

---

### 2.12 Testing (Backend)

#### 2.12.1 Test Types in the Project

In the backend, tests are organized as a `pytest` package inside the Django app:

```
backend/
└── gym_app/
    └── tests/
        ├── commands/      # Command-level tests/utilities when present
        ├── models/        # Unit tests for models (validations, managers, constraints)
        ├── serializers/   # Unit tests for DRF serializers
        ├── views/         # Endpoint tests (lightweight integration with DRF APIClient)
        ├── tasks/         # Task tests (Celery / jobs)
        └── utils/         # Unit tests for utilities
```

Practical classification:

- **Unit tests**
  - Models (`gym_app/tests/models/*`)
  - Serializers (`gym_app/tests/serializers/*`)
  - Tasks (`gym_app/tests/tasks/*`)
  - Utils (`gym_app/tests/utils/*`)
  - Commands (`gym_app/tests/commands/*`, when used)
- **Flow / lightweight integration (API)**
  - Views (`gym_app/tests/views/*`) using `rest_framework.test.APIClient`, `reverse()` and asserts on status/response.

> **Quality gate alignment note:** keep test folder conventions synchronized with `scripts/quality/base.py` (`Config.py_allowed_folders`) so location checks match the documented architecture.

#### 2.12.2 Libraries Used

- **pytest**
- **pytest-django**
- **pytest-cov / coverage** (for coverage)
- **Django REST Framework test utilities** (`APIClient`)
- **unittest.mock** (`patch`, `MagicMock`) for mocks on external integrations (email, requests, etc.)

#### 2.12.3 Conventions and Patterns

- Use `@pytest.mark.django_db` on tests that touch the database.
- Prefer `@pytest.fixture` fixtures for reusable data.
- In endpoint tests:
  - Authenticate with `api_client.force_authenticate(user=...)`.
  - Resolve URLs with `reverse('<url_name>')`.
  - Validate `status_code` and payload shape.

#### 2.12.4 Real Example (Endpoint Test)

Representative example (taken from the project):

```python
@pytest.mark.django_db
def test_sign_in_with_password_success(api_client, existing_user, mock_requests_post):
    url = reverse('sign_in')
    response = api_client.post(url, {
        'email': existing_user.email,
        'password': 'existingpassword',
        'captcha_token': 'valid_captcha_token',
    }, format='json')
    assert response.status_code == status.HTTP_200_OK
```

#### 2.12.5 How to Run Tests

The repository includes `backend/pytest.ini` with:

- `DJANGO_SETTINGS_MODULE = gym_project.settings`
- marker taxonomy (`edge`, `contract`, `integration`)

Recommended commands (from `backend/`) for local development:

```bash
# Targeted file
pytest gym_app/tests/models/test_<entity>.py -v

# Targeted + related regression file
pytest gym_app/tests/views/test_<endpoint>.py gym_app/tests/serializers/test_<serializer>.py -v

# Optional segmented backend run (broader regression without one huge run)
python scripts/run-tests-blocks.py --markers edge,contract --groups models,serializers
```

---

## 3. Frontend - Vue 3 + Vite + Pinia

### 3.1 Folder Structure

```
frontend/
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── style.css
│   ├── router/
│   │   └── index.js
│   ├── stores/
│   │   ├── auth/
│   │   ├── legal/
│   │   ├── organizations/
│   │   ├── organization_posts/
│   │   ├── dynamic_document/
│   │   ├── dashboard/
│   │   ├── subscriptions/
│   │   ├── services/
│   │   │   └── request_http.js
│   │   ├── process.js
│   │   ├── user_guide.js
│   │   └── user_guide_updates.js
│   ├── views/               # auth, process, legal_request, organizations, etc.
│   ├── components/          # dynamic_document, organizations, legal-requests, layouts, etc.
│   ├── composables/
│   ├── shared/
│   └── assets/
├── test/                    # Jest unit/component tests
├── e2e/                     # Playwright tests
├── scripts/                 # AST parser + coverage helpers
├── vite.config.js
├── tailwind.config.js
├── jest.config.cjs
├── playwright.config.mjs
└── package.json
```

---

### 3.2 Configuration (main.js)

```javascript
// src/main.js
import './style.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router, { installRouterGuards } from './router';
import axios from 'axios';
import { useAuthStore } from './stores/auth/auth';
import vue3GoogleLogin from 'vue3-google-login';
import { registerSW } from 'virtual:pwa-register';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

const authStore = useAuthStore();
installRouterGuards(authStore);

if (authStore.token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`;
}

app.use(vue3GoogleLogin, {
  clientId: '<GOOGLE_CLIENT_ID>',
  prompt: 'select_account',
  redirect_uri: '<APP_DOMAIN>/auth/google/callback',
});

registerSW({
  onNeedRefresh() { /* trigger refresh UX */ },
  onOfflineReady() { /* optional offline-ready toast */ },
});

app.mount('#app');
```

---

### 3.3 HTTP Service (Axios + JWT)

The HTTP service centralizes API calls under `/api/`, injects CSRF + Bearer token headers, and exposes method-specific wrappers used across domain stores.

```javascript
// src/stores/services/request_http.js
import axios from 'axios';

function getCookie(name) {
  // Extract CSRF token from browser cookies
}

async function makeRequest(method, url, params = {}, config = {}) {
  const csrfToken = getCookie('csrftoken');
  const token = localStorage.getItem('token');
  const headers = {
    'X-CSRFToken': csrfToken,
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  switch (method) {
    case 'GET':
      return axios.get(`/api/${url}`, { headers, ...config });
    case 'POST':
      return axios.post(`/api/${url}`, params, { headers, ...config });
    case 'PUT':
      return axios.put(`/api/${url}`, params, { headers, ...config });
    case 'PATCH':
      return axios.patch(`/api/${url}`, params, { headers, ...config });
    case 'DELETE':
      return axios.delete(`/api/${url}`, { headers, ...config });
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

export const get_request = (url, responseType = 'json') =>
  makeRequest('GET', url, {}, { responseType });
export const create_request = (url, params) => makeRequest('POST', url, params);
export const update_request = (url, params) => makeRequest('PUT', url, params);
export const patch_request = (url, params) => makeRequest('PATCH', url, params);
export const delete_request = (url) => makeRequest('DELETE', url);
export const upload_file_request = (url, formData) =>
  axios.post(`/api/${url}`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
```

---

### 3.4 Pinia Stores (CRUD)

Each store follows the same pattern: reactive state, computed getters, and CRUD actions.

> In the current repository, stores are grouped by business domain (`auth`, `legal`, `organizations`, `dynamic_document`, etc.). The snippet below illustrates a reusable CRUD pattern.

```javascript
// src/stores/modules/productStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    get_request, create_request, update_request, delete_request
} from '@/stores/services/request_http'

export const useProductStore = defineStore('product', () => {
    // State
    const items = ref([])
    const currentItem = ref(null)
    const isLoading = ref(false)
    const isUpdating = ref(false)
    const error = ref(null)
    
    // Getters
    const totalItems = computed(() => items.value.length)
    const hasItems = computed(() => items.value.length > 0)
    const getById = computed(() => (id) => 
        items.value.find(item => item.id === id)
    )
    
    // Actions
    async function fetchItems() {
        isLoading.value = true
        error.value = null
        try {
            const response = await get_request('products/')
            items.value = response.data.products || []
            return { success: true, data: items.value }
        } catch (err) {
            error.value = err.response?.data?.error || 'Failed to load'
            return { success: false, error: error.value }
        } finally {
            isLoading.value = false
        }
    }
    
    async function fetchItem(id) {
        isLoading.value = true
        error.value = null
        try {
            const response = await get_request(`products/${id}/`)
            currentItem.value = response.data.product
            return { success: true, data: currentItem.value }
        } catch (err) {
            error.value = err.response?.data?.error || 'Product not found'
            currentItem.value = null
            return { success: false, error: error.value }
        } finally {
            isLoading.value = false
        }
    }
    
    async function createItem(payload) {
        isUpdating.value = true
        error.value = null
        try {
            const response = await create_request('products/create/', payload)
            const newItem = response.data.product
            items.value.unshift(newItem)
            return { success: true, message: response.data.message, data: newItem }
        } catch (err) {
            error.value = err.response?.data?.details || 'Failed to create'
            return { success: false, error: error.value }
        } finally {
            isUpdating.value = false
        }
    }
    
    async function updateItem(id, payload) {
        isUpdating.value = true
        error.value = null
        try {
            const response = await update_request(`products/${id}/update/`, payload)
            const updated = response.data.product
            const index = items.value.findIndex(item => item.id === id)
            if (index !== -1) items.value[index] = updated
            if (currentItem.value?.id === id) currentItem.value = updated
            return { success: true, message: response.data.message, data: updated }
        } catch (err) {
            error.value = err.response?.data?.details || 'Failed to update'
            return { success: false, error: error.value }
        } finally {
            isUpdating.value = false
        }
    }
    
    async function deleteItem(id) {
        isUpdating.value = true
        error.value = null
        try {
            const response = await delete_request(`products/${id}/delete/`)
            items.value = items.value.filter(item => item.id !== id)
            if (currentItem.value?.id === id) currentItem.value = null
            return { success: true, message: response.data.message }
        } catch (err) {
            error.value = err.response?.data?.error || 'Failed to delete'
            return { success: false, error: error.value }
        } finally {
            isUpdating.value = false
        }
    }
    
    function clearError() {
        error.value = null
    }
    
    return {
        // State
        items, currentItem, isLoading, isUpdating, error,
        // Getters
        totalItems, hasItems, getById,
        // Actions
        fetchItems, fetchItem, createItem, updateItem, deleteItem, clearError
    }
})
```

---

### 3.5 Router and Guards

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sign_in', name: 'sign_in', component: () => import('@/views/auth/SignIn.vue') },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/dashboard/dashboard.vue'), meta: { requiresAuth: true } },
    { path: '/process_list/:user_id?/:display?', name: 'process_list', component: () => import('@/views/process/ProcessList.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: { name: 'sign_in' } },
  ],
});

export function installRouterGuards(authStore) {
  router.beforeEach(async (to, from, next) => {
    const isAuthenticated = await authStore.isAuthenticated();
    if (to.meta.requiresAuth && !isAuthenticated) {
      return next({ name: 'sign_in' });
    }
    if (to.meta.requiresLawyer && isAuthenticated) {
      // Role-based restrictions are validated before navigation
    }
    return next();
  });
}

export default router;
```

---

### 3.6 Localization Strategy (Current State)

Current frontend implementation does not use `vue-i18n` as a dedicated translation runtime.

- Most UI copy is currently authored in Spanish directly in views/components.
- Date/number formatting commonly uses locale-specific formatters (for example `toLocaleDateString('es-ES')`).
- If full runtime i18n is required in future iterations, it should be introduced as an explicit architectural decision (message catalog + key-based rendering).

---

### 3.7 Testing (Frontend)

#### 3.7.1 Unit Testing (Jest + Vue Test Utils)

Configuration and conventions detected in the project:

- **Runner:** Jest (`frontend/package.json` script `test`).
- **Config:** `frontend/jest.config.cjs`
  - `testMatch`: `test/**/*.test.js`
  - Ignores E2E: `testPathIgnorePatterns: ['<rootDir>/e2e/']`
  - Transformers:
    - Vue: `@vue/vue3-jest`
    - JS: `babel-jest`
    - Assets/CSS: `jest-transform-stub` + `identity-obj-proxy`
- **Setup:** `frontend/jest.setup.js` loads `@testing-library/jest-dom`.

Unit test structure:

```
frontend/
└── test/
    ├── animations/   # Animation behavior tests
    ├── views/        # View-level tests
    ├── stores/       # Pinia unit tests (actions/getters)
    ├── router/       # Guards and navigation
    ├── composables/  # Hooks/composables
    ├── shared/       # Shared helpers
    ├── utils/        # Utility tests
    └── components/   # Component tests with Vue Test Utils
```

Common patterns:

- **Stores (Pinia):**
  - `setActivePinia(createPinia())`
  - HTTP mock with `axios-mock-adapter` on `axios`.
- **Components:**
  - `mount()` from Vue Test Utils.
  - `jest.mock()` for external dependencies (`gsap`, `vue-router`, `vue3-google-login`, etc.).
  - `stubs` for complex child components.

Real example (store test with API mock):

```js
setActivePinia(createPinia());
mock.onGet('/api/users/').reply(200, usersData);
await store.fetchUsersData();
expect(store.users).toEqual(usersData);
```

#### 3.7.2 Flow Testing (E2E) with Playwright

- **Runner:** `@playwright/test`
- **Config:** `frontend/playwright.config.mjs`
  - `testDir: './e2e'`
  - Automatically starts the dev server via `webServer.command: npm run dev ...`
  - HTML report enabled (`playwright show-report`).

API mocking strategy for E2E:

- Requests to `**/api/**` are intercepted with `page.route(...)`.
- Helpers like `e2e/helpers/api.js` and `e2e/helpers/authSignInMocks.js` return deterministic responses.

Real example (E2E):

```js
await page.goto('/sign_in');
await page.getByTestId('email-input').fill('client@example.com');
await page.getByRole('button', { name: 'Sign In' }).click();
await expect(page).toHaveURL(/\/dashboard/);
```

#### 3.7.3 Commands to Run Tests

```bash
# Unit/component tests (targeted)
npm run test -- test/stores/<store>.test.js
npm run test -- test/components/<component>.test.js test/composables/<composable>.test.js

# E2E tests (targeted)
npm run e2e -- e2e/auth/<flow>.spec.js
npm run e2e -- e2e/organizations/<flow>.spec.js e2e/profile/<flow>.spec.js

# Optional interactive/reports for scoped E2E runs
npm run e2e:ui -- e2e/auth/<flow>.spec.js
npm run e2e:headed
npm run e2e:report
```

---

## 4. Standard Dependencies

### 4.1 Backend (requirements.txt)

| Category | Package | Purpose |
|----------|---------|----------|
| Core | Django>=5.0 | Web framework |
| Core | djangorestframework | REST API |
| Auth | djangorestframework-simplejwt | JWT authentication |
| CORS | django-cors-headers | CORS handling |
| Async | celery | Background jobs |
| Async | django-celery-beat | Scheduled jobs (optional enablement) |
| Cache | django-redis | Redis cache |
| Images | Pillow | Image processing |
| Images | easy-thumbnails | Automatic thumbnails |
| Cleanup | django-cleanup | File cleanup |
| Testing | Faker | Test data |
| Testing | pytest | Test runner (backend) |
| Testing | pytest-django | pytest + Django integration |
| Testing | pytest-cov | Test coverage |
| Testing | coverage | Coverage measurement |
| HTTP | requests | External integrations |

### 4.2 Frontend (package.json)

| Category | Package | Purpose |
|----------|---------|----------|
| Core | vue@^3.x | Reactive framework |
| Build | vite + @vitejs/plugin-vue | Fast bundler |
| State | pinia | Store management |
| Routing | vue-router@^4.x | SPA navigation |
| HTTP | axios | HTTP client |
| Auth | vue3-google-login | Google OAuth UI integration |
| PWA | vite-plugin-pwa | Progressive Web App support |
| Styles | tailwindcss | CSS utilities |
| UI | @headlessui/vue | Accessible components |
| Icons | @heroicons/vue | SVG icons |
| Testing | jest | Unit test runner |
| Testing | @vue/test-utils | Vue component testing utilities |
| Testing | @vue/vue3-jest | Vue SFC transform for Jest |
| Testing | babel-jest | JavaScript transform for Jest |
| Testing | @testing-library/jest-dom | DOM matchers for Jest |
| Testing | axios-mock-adapter | Axios mock for unit tests |
| Testing | @playwright/test | E2E / flow tests |

---

## 5. Execution Commands

### 5.1 Backend (Django)

```bash
# 1. Create and activate virtual environment
cd backend
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate        # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Environment variables (create .env)
# DJANGO_SECRET_KEY=...
# DATABASE_URL=...
# EMAIL_HOST_PASSWORD=...

# 4. Migrations
python manage.py makemigrations
python manage.py migrate

# 5. Create superuser
python manage.py createsuperuser

# 6. Create fake data
python manage.py create_fake_data 60 --num_legal_requests 40 --num_documents 80 --activities_per_user 30

# 7. Delete fake data
python manage.py delete_fake_data

# 8. Tests (targeted)
pytest gym_app/tests/models/test_<entity>.py -v
pytest gym_app/tests/views/test_<endpoint>.py gym_app/tests/views/test_<endpoint>_regression.py -v

# 8.1 Optional: segmented backend run for broader regression
python scripts/run-tests-blocks.py --markers edge,contract,integration,rest --chunk-size 22 --sleep 2

# 9. Development server
python manage.py runserver        # http://localhost:8000

# 10. Production server (with gunicorn)
gunicorn gym_project.wsgi:application --bind 0.0.0.0:8000
```

### 5.2 Frontend (Vue + Vite)

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Development server
npm run dev                       # http://localhost:5173

# 3. Production build
npm run build

# 4. Preview build
npm run preview

# 5. Linting
npm run lint

# 6. Unit/component tests (targeted)
npm run test -- test/stores/<store>.test.js
npm run test -- test/components/<component>.test.js

# 7. E2E tests (targeted)
npm run e2e -- e2e/auth/<flow>.spec.js
npm run e2e -- e2e/subscriptions/<flow>.spec.js
```

### 5.3 Development Access URLs

| Resource | URL | Description |
|----------|-----|-------------|
| Frontend | http://localhost:5173 | Vue application |
| API | http://localhost:8000/api/ | REST endpoints |
| Admin | http://localhost:8000/admin/ | Django Admin panel |
| API Docs | http://localhost:8000/api/docs/ | Documentation (if enabled) |

---

## 6. New Project Checklist

Use this list when starting a new project to ensure all standards are followed.

### 6.1 Initial Configuration

- [ ] Create repository with backend/ and frontend/ structure
- [ ] Configure .gitignore (venv, node_modules, .env, db.sqlite3, media/)
- [ ] Edit `README.md` at project start to include a summary of:
  - Environment setup (backend and frontend)
  - Migrations
  - Fake data creation/deletion
  - How to run tests (unit and e2e)
  - How to run servers (backend and frontend)
- [ ] Create .env.example file with required variables
- [ ] Create `guidelines.md` at the root with the standard **Change Implementation Guidelines** content
- [ ] Define custom AUTH_USER_MODEL from the start
- [ ] Configure CORS for local frontend (localhost:5173)
- [ ] Configure JWT with appropriate expiration times

### 6.2 Backend

- [ ] Create folder structure: models/, serializers/, views/, urls/
- [ ] Implement User model with required fields
- [ ] Create separate serializers: List, Detail, CreateUpdate
- [ ] Implement views with @api_view and explicit permissions
- [ ] Organize URLs by functional module
- [ ] Configure Django Admin with detailed ModelAdmins
- [ ] Create create_fake_data and delete_fake_data commands
- [ ] Define media/file handling strategy (validation, storage backend, cleanup)
- [ ] Implement services for complex business logic

### 6.3 Frontend

- [ ] Configure Vite with proxy to backend (/api → localhost:8000)
- [ ] Implement HTTP service with JWT handling and refresh
- [ ] Create Pinia stores with standard CRUD pattern
- [ ] Configure router with auth guards
- [ ] Define localization strategy (direct locale copy vs runtime i18n)
- [ ] Configure TailwindCSS
- [ ] Create reusable base components
- [ ] Implement global error handling

### 6.4 Before Production

- [ ] Migrate to MySQL database
- [ ] Configure Redis for cache and sessions
- [ ] Move ALL credentials to environment variables
- [ ] Configure HTTPS and update CORS/CSRF
- [ ] Configure collectstatic for static files
- [ ] Configure media file server (S3, etc.)
- [ ] Implement appropriate logging
- [ ] Run delete_fake_data only in controlled non-production environments when data reset is required
- [ ] Review permissions on sensitive endpoints
- [ ] Production build for frontend

---

> **This document should be updated when new technologies, patterns, or best practices are adopted by the team. The current version reflects the consolidation of three existing reference templates.**

---

## Appendix A: Change Implementation Guide

This appendix describes the standard steps to follow every time a change is made to the project (backend or frontend). The goal is to preserve existing behavior, avoid regressions, and keep the system well-documented and testable.

### A.1 Mandatory Checklist

#### 1. Validate the business logic around the change

- Confirm that the new behavior is consistent with existing business rules.
- Verify implicit contracts (API responses, error formats, background jobs, emails, etc.).
- If a test requires changing existing behavior, explicitly decide whether the behavior or the test is the source of truth.

#### 2. Keep the code documented with English docstrings

- Public functions, classes, and complex methods must have clear English docstrings.
- Docstrings must explain:
  - Purpose and intent ("what" and "why").
  - Parameters and return values.
  - Important side effects, invariants, or assumptions.
- When modifying existing behavior, update the docstring to remain accurate.

#### 3. Add or update automated tests

- For any new behavior, add tests that cover:
  - Happy path.
  - Relevant edge cases and error conditions.
- When changing existing behavior:
  - Update tests to describe the **new** intended behavior.
  - Avoid weakening assertions unless it is a deliberate design decision.
- Run targeted tests for changed files plus related regression tests (small batches) and ensure they pass before merging.

#### 4. Verify and maintain test data

- Review existing fixtures and fake data used by affected areas.
- Update or extend backend fixtures, management commands, or fake data generators when:
  - New fields are introduced.
  - Business rules change (e.g., new required relationships, new roles, new states).
- Ensure test data is realistic enough to facilitate debugging and issue reproduction.

#### 5. Verify and update the User Manual module

- If any user-facing behavior changes (API, UI flows, emails, reports, roles/permissions, etc.), review the user manual or help content.
- Update or add entries in the user manual to reflect current behavior.
- When in doubt, document:
  - New features or flows.
  - Changes to existing flows (including error messages and edge cases users might encounter).

### A.2 Optional / Recommended Considerations

These items are not always required, but should be considered for any non-trivial change.

#### Database migrations and data integrity

- Check if model changes require Django migrations.
- Consider data migration scripts if existing records need to be adapted.
- Verify that constraints and defaults remain correct for production data.

#### Backward compatibility

- For public APIs, avoid breaking changes in request/response shape unless explicitly planned.
- Where possible, deprecate behavior gradually (e.g., support both old and new fields for a period).

#### Performance and scalability

- Evaluate if the change introduces heavier queries, N+1 issues, or expensive computations.
- For critical paths, consider adding tests or instrumentation to detect regressions.

#### Security and permissions

- Re-verify permission checks, access control, and visibility rules affected by the change.
- Ensure error messages do not leak sensitive information.
- Review user input handling, file uploads, and external integrations.

#### Logging and observability

- Add or adjust logging for important flows (success and failure paths) when useful for debugging.
- Avoid logging sensitive data (passwords, tokens, personally identifiable information).

#### Configuration and environment

- If new settings or environment variables are added, document them and provide safe defaults.
- Ensure local, staging, and production environments can be configured consistently.

#### Code style and consistency

- Follow the existing project style (formatting, naming, folder structure).
- Prefer small, focused changes over large, mixed refactors.

#### Review and communication

- When submitting changes, include a concise description of:
  - What was changed.
  - Why it was changed.
  - How it was tested.
- Highlight any breaking changes, data migrations, or manual steps required after deployment.
- Propose a very short commit message consistent with the type of change:
  - For a **FEAT** (feature/intent/adjustment), use a brief phrase that captures the intended behavior or feature in English.
  - For a **FIX** (bug fix), use a brief phrase that explicitly mentions the applied fix in English.

### A.3 Visual Process Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE IMPLEMENTING                          │
├─────────────────────────────────────────────────────────────────┤
│  □ Understand the requirement and its impact                     │
│  □ Identify affected areas (models, views, frontend, etc.)      │
│  □ Review existing tests in those areas                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DURING IMPLEMENTATION                        │
├─────────────────────────────────────────────────────────────────┤
│  □ Write/update English docstrings                               │
│  □ Follow established project patterns                          │
│  □ Create migrations if model changes exist                     │
│  □ Update fake data if new fields/relationships exist           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AFTER IMPLEMENTING                           │
├─────────────────────────────────────────────────────────────────┤
│  □ Write/update tests (happy path + edge cases)                  │
│  □ Run targeted tests + related regression tests                 │
│  □ Update user manual if applicable                              │
│  □ Review security and permissions                               │
│  □ Prepare descriptive commit message                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE MERGE/DEPLOY                          │
├─────────────────────────────────────────────────────────────────┤
│  □ Code review completed                                        │
│  □ All tests pass                                               │
│  □ Documentation updated                                        │
│  □ Breaking changes communicated to the team                    │
└─────────────────────────────────────────────────────────────────┘
```

---

> **Note:** This appendix complements the technical architecture with process practices. Following these guidelines helps maintain code quality and reduces the risk of introducing bugs in production.
