# Guided Tour / Interactive Onboarding — Implementation Plan

Step-by-step product tour for the Legal Files module using Driver.js. Guides users through core features on first login and every 30 days, with role-based content (lawyer/client) and a persistent help button.

---

## Confirmed Decisions

| Question | Answer |
|---|---|
| Library | **Driver.js** (`driver.js` npm package, ~5KB, zero dependencies) |
| First module | **Legal Files only** (`/dynamic_document_dashboard`) |
| Progress persistence | **Backend** — `TourProgress` model, one record per user + module |
| Repeat frequency | Every **30 days** since `completed_at` |
| On repeat | Show a **confirmation modal** before restarting (not forced) |
| Skip/Omit | Counts as completed — backend record is saved either way |
| Help button | Persistent **"?" button** in the Dashboard header bar |
| Tooltips | `InfoTooltip.vue` component — permanent info icons alongside key elements |
| DOM selectors | `data-tour` attributes — stable across style changes |
| Tab switching during tour | Driver.js `onHighlightStarted` callback programmatically calls `selectLawyerTab()` / `selectClientTab()` before highlighting tab-specific elements |

---

## Current Architecture State

### Backend
- **User model** (`models/user.py`): roles `lawyer`, `client`, `corporate_client`, `basic`. No `TourProgress` model exists.
- **View pattern**: `@api_view(['GET', 'POST'])` + `@permission_classes([IsAuthenticated])` (see `views/user.py`).
- **URL pattern**: grouped lists (e.g. `user_urls`) concatenated into `urlpatterns` in `urls.py`.
- **Admin**: `admin.py` registers models with `ModelAdmin`; imports at the top.
- **`models/__init__.py`**: explicit imports + `__all__`.

### Frontend
- **Router** (`router/index.js`): `beforeEach` guard checks `requiresAuth` and `requiresLawyer`. Pattern for new meta guards is established.
- **SlideBar** (`components/layouts/SlideBar.vue`): `navigation` ref array, `onMounted` calls `updateActiveNavItem()`. Logout via `logOut()` in user menu.
- **Dashboard** (`views/dynamic_document/Dashboard.vue`):
  - `activeLawyerTab = ref('legal-documents')` — controls which lawyer tab is visible.
  - `activeTab = ref('folders')` — controls which client tab is visible.
  - `lawyerNavigationTabs` array rendered with `v-for` — tabs: `legal-documents`, `folders`, `my-documents`, `pending-signatures`, `signed-documents`, `archived-documents`, `finished-documents`.
  - Action buttons are conditionally rendered: `Nueva Minuta` only when `activeLawyerTab === 'legal-documents'`, `Nuevo Documento` only when `activeLawyerTab === 'my-documents'`.
  - `onMounted` already initializes `userStore.init()` and `folderStore.init()`.
- **Composables** (`composables/`): simple exported functions pattern (see `useRecentViews.js`).
- **Auth store** (`stores/auth/auth.js`): `logout()` clears localStorage and resets process/user stores.

### ⚠️ Key Constraint
`Nueva Minuta` and `Nuevo Documento` buttons are conditionally rendered with `v-if`. They are **not in the DOM** unless the corresponding tab is active. The tour **must** programmatically switch the tab before Driver.js highlights these elements, using the `onHighlightStarted` callback of the preceding step.

---

## Implementation

### Phase 1: Backend — TourProgress Model

**New file: `backend/gym_app/models/tour.py`**

```python
from django.db import models
from django.conf import settings

class TourProgress(models.Model):
    MODULE_CHOICES = [
        ('legal_files', 'Legal Files'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tour_progress'
    )
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    completed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'module')
        ordering = ['-completed_at']
        verbose_name = 'Tour Progress'
        verbose_name_plural = 'Tour Progress'

    def __str__(self):
        return f"{self.user.email} — {self.module} ({self.completed_at.strftime('%Y-%m-%d')})"
```

`auto_now=True` on `completed_at` means every `save()` updates the timestamp — both "complete" and "skip" call the same endpoint, unifying the logic.

**Modify `backend/gym_app/models/__init__.py`**:
- Add `from .tour import TourProgress`
- Add `'TourProgress'` to `__all__`

**Run migrations**:
```bash
source venv/bin/activate && python manage.py makemigrations && python manage.py migrate
```

---

### Phase 2: Backend — Serializer + API Views + URLs

**New file: `backend/gym_app/serializers/tour.py`**

```python
from rest_framework import serializers
from gym_app.models.tour import TourProgress

class TourProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = TourProgress
        fields = ['module', 'completed_at']
        read_only_fields = ['completed_at']
```

**New file: `backend/gym_app/views/tour.py`**

```python
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from gym_app.models.tour import TourProgress
from gym_app.serializers.tour import TourProgressSerializer

VALID_MODULES = {'legal_files'}

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tour_progress(request):
    """Returns all completed tour modules for the authenticated user."""
    tours = TourProgress.objects.filter(user=request.user)
    serializer = TourProgressSerializer(tours, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_tour(request):
    """Marks a tour module as completed (or updates the timestamp if already exists)."""
    module = request.data.get('module', '').strip()
    if not module:
        return Response({'error': 'module is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if module not in VALID_MODULES:
        return Response({'error': f'Invalid module: {module}.'}, status=status.HTTP_400_BAD_REQUEST)

    tour, _ = TourProgress.objects.get_or_create(user=request.user, module=module)
    tour.save()  # triggers auto_now=True, updating completed_at
    serializer = TourProgressSerializer(tour)
    return Response(serializer.data, status=status.HTTP_200_OK)
```

**Modify `backend/gym_app/urls.py`**:

Add new URL group and import:
```python
from .views import tour  # add to existing import line

# Tour Progress URLs
tour_urls = [
    path('tour-progress/', tour.get_tour_progress, name='tour-progress'),
    path('tour-progress/complete/', tour.complete_tour, name='tour-complete'),
]
```

Add `tour_urls` to the `urlpatterns` concatenation at the bottom.

---

### Phase 3: Backend — Django Admin

**Modify `backend/gym_app/admin.py`**:

```python
from gym_app.models.tour import TourProgress

@admin.register(TourProgress)
class TourProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'module', 'completed_at')
    list_filter = ('module',)
    search_fields = ('user__email',)
    readonly_fields = ('completed_at',)
```

---

### Phase 4: Frontend — Install Driver.js

```bash
npm install driver.js
```

Driver.js is imported on-demand inside the composable (dynamic import) to avoid bundling it on every page.

---

### Phase 5: Frontend — Tour Steps Config (`tourSteps.js`)

**New file: `frontend/src/config/tourSteps.js`**

Centralizes all step definitions. Each step references a `data-tour` attribute as the element selector. Steps for the lawyer and client tour are defined separately.

```javascript
export const LAWYER_TOUR_STEPS = [
  {
    element: '[data-tour="lawyer-tabs-nav"]',
    popover: {
      title: 'Secciones de Archivos Jurídicos',
      description: 'Navega entre las diferentes secciones: Minutas, Mis Documentos, Documentos por Firmar y más.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="minutas-tab"]',
    popover: {
      title: 'Minutas (Plantillas)',
      description: 'Crea y gestiona tus plantillas de documentos jurídicos reutilizables.',
      side: 'bottom',
    },
  },
  {
    // activeLawyerTab must be 'legal-documents' before this step
    element: '[data-tour="new-minuta-btn"]',
    popover: {
      title: 'Nueva Minuta',
      description: 'Haz clic aquí para crear una nueva plantilla desde cero con el editor de documentos.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="my-documents-tab"]',
    popover: {
      title: 'Mis Documentos',
      description: 'Documentos creados a partir de minutas y asignados a tus clientes.',
      side: 'bottom',
    },
  },
  {
    // activeLawyerTab must be 'my-documents' before this step
    element: '[data-tour="new-document-btn"]',
    popover: {
      title: 'Nuevo Documento',
      description: 'Selecciona una minuta publicada para crear un documento personalizado para un cliente.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="pending-signatures-tab"]',
    popover: {
      title: 'Documentos Por Firmar',
      description: 'Documentos que están pendientes de firma electrónica por ti u otros firmantes.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="folders-tab"]',
    popover: {
      title: 'Carpetas',
      description: 'Organiza tus documentos en carpetas para una gestión más eficiente.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="finished-documents-tab"]',
    popover: {
      title: 'Documentos de Clientes',
      description: 'Documentos completamente diligenciados y finalizados por tus clientes.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="electronic-signature-btn"]',
    popover: {
      title: 'Firma Electrónica',
      description: 'Configura tu firma electrónica para poder firmar y enviar documentos para firma.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="global-letterhead-btn"]',
    popover: {
      title: 'Membrete Global',
      description: 'Sube tu imagen de membrete para que aparezca automáticamente en todos tus documentos.',
      side: 'bottom',
    },
  },
];

export const CLIENT_TOUR_STEPS = [
  {
    element: '[data-tour="client-tabs-nav"]',
    popover: {
      title: 'Secciones de Archivos Jurídicos',
      description: 'Navega entre las diferentes secciones disponibles para gestionar tus documentos.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="client-folders-tab"]',
    popover: {
      title: 'Carpetas',
      description: 'Tus documentos están organizados en carpetas para un acceso rápido.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="client-my-documents-tab"]',
    popover: {
      title: 'Mis Documentos',
      description: 'Aquí encuentras todos los documentos que te han asignado para completar.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="client-pending-signatures-tab"]',
    popover: {
      title: 'Documentos Por Firmar',
      description: 'Documentos que requieren tu firma electrónica. Revísalos y fírmalos aquí.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="client-signed-documents-tab"]',
    popover: {
      title: 'Documentos Firmados',
      description: 'Historial de todos los documentos que ya has firmado.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="client-new-document-btn"]',
    popover: {
      title: 'Nuevo Documento',
      description: 'Crea un documento propio a partir de las plantillas disponibles.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="client-signature-btn"]',
    popover: {
      title: 'Firma Electrónica',
      description: 'Configura tu firma electrónica para poder firmar documentos digitalmente.',
      side: 'bottom',
    },
  },
];
```

---

### Phase 6: Frontend — `useGuidedTour` Composable

**New file: `frontend/src/composables/useGuidedTour.js`**

Encapsulates all tour logic: API calls, 30-day check, Driver.js initialization, and step execution.

```javascript
import { ref } from 'vue';
import { get_request, create_request } from '@/stores/services/request_http';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function useGuidedTour() {
  const isTourActive = ref(false);
  let driverInstance = null;

  /**
   * Fetches tour progress from the backend.
   * Returns null if no record exists for this module.
   * @param {string} module
   * @returns {Promise<{module: string, completed_at: string}|null>}
   */
  const fetchTourProgress = async (module) => {
    try {
      const data = await get_request('tour-progress/');
      return data.find(t => t.module === module) || null;
    } catch (error) {
      console.error('[useGuidedTour] Error fetching tour progress:', error);
      return null;
    }
  };

  /**
   * Marks the tour as completed in the backend.
   * @param {string} module
   */
  const completeTour = async (module) => {
    try {
      await create_request('tour-progress/complete/', 'POST', { module });
    } catch (error) {
      console.error('[useGuidedTour] Error completing tour:', error);
    }
  };

  /**
   * Starts the Driver.js tour with the given steps.
   * @param {Array} steps - Array of Driver.js step objects
   * @param {string} module - Module name for backend persistence
   * @param {Function} [onStepChange] - Optional callback(stepIndex) for tab switching side-effects
   */
  const startTour = async (steps, module, onStepChange) => {
    // Lazy-load driver.js to avoid bundling cost on every page
    const { driver } = await import('driver.js');
    await import('driver.js/dist/driver.css');

    isTourActive.value = true;

    driverInstance = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgb(17, 24, 39)',
      overlayOpacity: 0.7,
      smoothScroll: true,
      allowClose: true,
      popoverClass: 'guided-tour-popover',
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Finalizar',
      steps: steps,
      onHighlightStarted: (element, step, opts) => {
        const stepIndex = opts.state.activeIndex;
        if (onStepChange) {
          onStepChange(stepIndex);
        }
      },
      onDestroyStarted: async () => {
        isTourActive.value = false;
        await completeTour(module);
        driverInstance.destroy();
      },
    });

    driverInstance.drive();
  };

  /**
   * Checks tour status and either starts automatically (first time) or asks the user (30-day repeat).
   * @param {string} module - Module key (e.g. 'legal_files')
   * @param {Array} steps - Tour step definitions
   * @param {Function} [onStepChange] - Callback for tab switching side-effects
   */
  const checkAndStartTour = async (module, steps, onStepChange) => {
    const progress = await fetchTourProgress(module);

    if (!progress) {
      // First visit: start tour automatically after a short delay
      setTimeout(() => startTour(steps, module, onStepChange), 800);
      return;
    }

    const elapsed = Date.now() - new Date(progress.completed_at).getTime();
    if (elapsed >= THIRTY_DAYS_MS) {
      // 30-day repeat: show confirmation
      const confirmed = window.confirm(
        '¿Deseas ver la guía del módulo de Archivos Jurídicos nuevamente?'
      );
      if (confirmed) {
        await startTour(steps, module, onStepChange);
      }
    }
    // If < 30 days: do nothing
  };

  /**
   * Manually starts the tour (triggered by "?" button).
   */
  const startTourManually = async (module, steps, onStepChange) => {
    await startTour(steps, module, onStepChange);
  };

  return {
    isTourActive,
    checkAndStartTour,
    startTourManually,
  };
}
```

---

### Phase 7: Frontend — InfoTooltip Component

**New file: `frontend/src/components/tour/InfoTooltip.vue`**

Lightweight, reusable tooltip that uses the native `title` attribute for accessibility and a CSS-based hover tooltip for visual polish.

```html
<template>
  <span
    class="inline-flex items-center justify-center ml-1 cursor-help"
    :title="text"
    :aria-label="text"
  >
    <InformationCircleIcon
      class="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors duration-150"
    />
  </span>
</template>

<script setup>
import { InformationCircleIcon } from '@heroicons/vue/24/outline';
defineProps({ text: { type: String, required: true } });
</script>
```

Usage example in `Dashboard.vue`:
```html
<span>Minutas</span>
<InfoTooltip text="Plantillas de documentos reutilizables para tu despacho." />
```

---

### Phase 8: Frontend — Modify `Dashboard.vue`

**File: `frontend/src/views/dynamic_document/Dashboard.vue`**

#### 8.1 Add `data-tour` attributes to DOM elements

**`lawyerNavigationTabs` array** — add `dataTour` property to each tab:

```javascript
const lawyerNavigationTabs = [
  { name: 'legal-documents', label: 'Minutas',                        dataTour: 'minutas-tab' },
  { name: 'folders',         label: 'Carpetas',                       dataTour: 'folders-tab' },
  { name: 'my-documents',    label: 'Mis Documentos',                 dataTour: 'my-documents-tab' },
  { name: 'pending-signatures', label: 'Dcs. Por Firmar',             dataTour: 'pending-signatures-tab' },
  { name: 'signed-documents',   label: 'Dcs. Firmados',              dataTour: null },
  { name: 'archived-documents', label: 'Dcs. Archivados',            dataTour: null },
  { name: 'finished-documents', label: 'Dcs. Clientes',              dataTour: 'finished-documents-tab' },
  { name: 'in-progress-documents', label: 'Dcs. Clientes en Progreso', dataTour: null },
];
```

Bind in the `v-for` template:
```html
<button
  v-for="tab in lawyerNavigationTabs"
  :key="tab.name"
  :data-tour="tab.dataTour || undefined"
  @click.stop="selectLawyerTab(tab.name)"
  ...
>
```

Add `data-tour` to the nav container and action buttons:
```html
<!-- Nav container -->
<nav data-tour="lawyer-tabs-nav" ...>

<!-- Firma Electrónica button -->
<button data-tour="electronic-signature-btn" ...>

<!-- Membrete Global button -->
<button data-tour="global-letterhead-btn" ...>

<!-- Nueva Minuta button -->
<button data-tour="new-minuta-btn" v-if="activeLawyerTab === 'legal-documents'" ...>

<!-- Nuevo Documento button -->
<button data-tour="new-document-btn" v-if="activeLawyerTab === 'my-documents'" ...>
```

For the **client** tabs section, apply equivalent `data-tour` attributes to the client nav container and tabs:
```html
<nav data-tour="client-tabs-nav" ...>
<!-- Each client tab: data-tour="client-folders-tab", "client-my-documents-tab", etc. -->
<!-- Client Firma Electrónica button: data-tour="client-signature-btn" -->
<!-- Client Nuevo Documento button: data-tour="client-new-document-btn" -->
```

#### 8.2 Import composable and tour steps

```javascript
import { useGuidedTour } from '@/composables/useGuidedTour';
import { LAWYER_TOUR_STEPS, CLIENT_TOUR_STEPS } from '@/config/tourSteps';
```

#### 8.3 Wire up the tour in `<script setup>`

```javascript
const { isTourActive, checkAndStartTour, startTourManually } = useGuidedTour();

/**
 * Tab-switching callback for the lawyer tour.
 * Ensures the correct tab is active before Driver.js highlights a tab-specific element.
 * Step indices correspond to LAWYER_TOUR_STEPS array order (0-indexed).
 */
const onLawyerTourStepChange = (stepIndex) => {
  // Step 2 = new-minuta-btn → requires legal-documents tab
  if (stepIndex === 2) selectLawyerTab('legal-documents');
  // Step 4 = new-document-btn → requires my-documents tab
  if (stepIndex === 4) selectLawyerTab('my-documents');
  // Step 5 = pending-signatures-tab → switch back to legal-documents (tabs always visible)
  // No action needed for tabs — they're always rendered. Only action buttons need tab switching.
};
```

#### 8.4 Extend `onMounted` to trigger tour check

Add after existing initialization (after `userStore.init()` and `folderStore.init()`):

```javascript
onMounted(async () => {
  // ... existing code ...

  // Guided tour: check after data is ready
  const steps = userRole.value === 'lawyer' ? LAWYER_TOUR_STEPS : CLIENT_TOUR_STEPS;
  const callback = userRole.value === 'lawyer' ? onLawyerTourStepChange : null;
  await checkAndStartTour('legal_files', steps, callback);
});
```

#### 8.5 Add "?" help button to the Dashboard header

In the sticky header div (line 3–6 of Dashboard.vue template), add alongside the `<slot>`:

```html
<div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
  <slot></slot>
  <!-- Guided Tour Help Button -->
  <div class="ml-auto flex items-center">
    <button
      @click="startTourManually('legal_files', userRole === 'lawyer' ? LAWYER_TOUR_STEPS : CLIENT_TOUR_STEPS, userRole === 'lawyer' ? onLawyerTourStepChange : null)"
      class="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-600 hover:bg-primary hover:text-white transition-all duration-200 text-sm font-bold"
      title="Ver guía del módulo"
      aria-label="Iniciar tour guiado"
    >
      ?
    </button>
  </div>
</div>
```

---

### Phase 9: Backend — Tests

**New file: `backend/gym_app/tests/views/test_tour_progress.py`**

```python
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.tour import TourProgress

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def lawyer(db):
    return User.objects.create_user(
        email='tour_lawyer@test.com', password='testpass', role='lawyer'
    )


@pytest.fixture
@pytest.mark.django_db
def client_user(db):
    return User.objects.create_user(
        email='tour_client@test.com', password='testpass', role='client'
    )


@pytest.mark.django_db
class TestGetTourProgress:
    def test_unauthenticated_returns_401(self, api_client):
        response = api_client.get('/api/tour-progress/')
        assert response.status_code == 401

    def test_empty_list_for_new_user(self, api_client, lawyer):
        api_client.force_authenticate(user=lawyer)
        response = api_client.get('/api/tour-progress/')
        assert response.status_code == 200
        assert response.data == []

    def test_returns_completed_module_for_user(self, api_client, lawyer):
        TourProgress.objects.create(user=lawyer, module='legal_files')
        api_client.force_authenticate(user=lawyer)
        response = api_client.get('/api/tour-progress/')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['module'] == 'legal_files'

    def test_user_cannot_see_other_users_tours(self, api_client, lawyer, client_user):
        TourProgress.objects.create(user=client_user, module='legal_files')
        api_client.force_authenticate(user=lawyer)
        response = api_client.get('/api/tour-progress/')
        assert response.status_code == 200
        assert response.data == []


@pytest.mark.django_db
class TestCompleteTour:
    def test_unauthenticated_returns_401(self, api_client):
        response = api_client.post('/api/tour-progress/complete/', {'module': 'legal_files'})
        assert response.status_code == 401

    def test_creates_tour_record(self, api_client, lawyer):
        api_client.force_authenticate(user=lawyer)
        response = api_client.post('/api/tour-progress/complete/', {'module': 'legal_files'})
        assert response.status_code == 200
        assert TourProgress.objects.filter(user=lawyer, module='legal_files').exists()

    def test_idempotent_updates_completed_at(self, api_client, lawyer):
        api_client.force_authenticate(user=lawyer)
        api_client.post('/api/tour-progress/complete/', {'module': 'legal_files'})
        first_ts = TourProgress.objects.get(user=lawyer, module='legal_files').completed_at
        import time; time.sleep(0.05)
        api_client.post('/api/tour-progress/complete/', {'module': 'legal_files'})
        second_ts = TourProgress.objects.get(user=lawyer, module='legal_files').completed_at
        assert second_ts >= first_ts
        assert TourProgress.objects.filter(user=lawyer, module='legal_files').count() == 1

    def test_missing_module_returns_400(self, api_client, lawyer):
        api_client.force_authenticate(user=lawyer)
        response = api_client.post('/api/tour-progress/complete/', {})
        assert response.status_code == 400

    def test_invalid_module_returns_400(self, api_client, lawyer):
        api_client.force_authenticate(user=lawyer)
        response = api_client.post('/api/tour-progress/complete/', {'module': 'nonexistent_module'})
        assert response.status_code == 400
```

---

## New Files (~6)

| File | Purpose |
|------|---------|
| `backend/gym_app/models/tour.py` | `TourProgress` model |
| `backend/gym_app/serializers/tour.py` | `TourProgressSerializer` |
| `backend/gym_app/views/tour.py` | API views: get progress + complete |
| `backend/gym_app/tests/views/test_tour_progress.py` | Backend tests |
| `frontend/src/composables/useGuidedTour.js` | Driver.js logic, API calls, 30-day check |
| `frontend/src/config/tourSteps.js` | Step definitions per role |
| `frontend/src/components/tour/InfoTooltip.vue` | Reusable info tooltip component |

## Modified Files (~5)

| File | Change |
|------|--------|
| `backend/gym_app/models/__init__.py` | Import + export `TourProgress` |
| `backend/gym_app/urls.py` | Add `tour_urls` import and concatenation |
| `backend/gym_app/admin.py` | Register `TourProgressAdmin` |
| `frontend/src/views/dynamic_document/Dashboard.vue` | `data-tour` attrs, `onMounted` hook, "?" button, import composable |
| `frontend/package.json` | Add `driver.js` dependency |

---

## Dependencies with Other Plans

| Plan | Relationship |
|------|-------------|
| **Alertas Archivos Jurídicos (Plan 06)** | Complementary. The tour guides users to the "Documentos Por Firmar" tab; the alerts system then highlights pending documents with a pulse effect. The optional conditional step mentioned in `Requirement_04` (adding a tour step when the user has pending signatures) depends on Plan 06's `usePendingSignatures` composable — implement as a later enhancement after Plan 06 is merged. |
| **Notification Center (Plan 05)** | Independent. The tour does not depend on the notification model. |

---

## Edge Cases Considered

- **Conditional buttons (`v-if`) not in DOM**: Handled via `onHighlightStarted` callback that calls `selectLawyerTab()` before Driver.js attempts to highlight the element. Step order in `LAWYER_TOUR_STEPS` is deliberate: the tab-switch step always precedes its conditional button step.

- **Element not found by Driver.js**: If a `data-tour` selector yields no element (e.g., on a screen size where a button is hidden), Driver.js renders the popover centered on the viewport. The tour continues without crashing.

- **User navigates away mid-tour**: Driver.js `onDestroyStarted` fires on any close action (overlay click, ESC, Omitir). This triggers `completeTour()` so the user is not shown the tour again unexpectedly.

- **Multiple calls to `checkAndStartTour`**: The composable uses a single `driverInstance` ref. If a tour is already active (`isTourActive.value === true`), a second call should be guarded:
  ```javascript
  if (isTourActive.value) return;
  ```
  Add this check at the top of `checkAndStartTour`.

- **`completed_at` auto_now vs get_or_create**: `get_or_create` only calls `save()` on creation. The explicit `tour.save()` after `get_or_create` ensures `auto_now` updates the timestamp even on subsequent completions.

- **`window.confirm` for 30-day repeat**: Using native `confirm()` is intentional to minimize dependencies. If the project later adopts a modal library, this can be swapped out without changing the composable's API.

---

## Implementation Order

| Step | Description | Est. Time |
|------|-------------|-----------|
| 1 | Backend: Model + migration | ~20 min |
| 2 | Backend: Serializer + views + URLs | ~30 min |
| 3 | Backend: Admin registration | ~10 min |
| 4 | Backend: Tests | ~45 min |
| 5 | Frontend: `npm install driver.js` | ~5 min |
| 6 | Frontend: `tourSteps.js` config | ~30 min |
| 7 | Frontend: `useGuidedTour.js` composable | ~45 min |
| 8 | Frontend: `InfoTooltip.vue` component | ~15 min |
| 9 | Frontend: `Dashboard.vue` — `data-tour` attrs, `onMounted`, "?" button | ~60 min |
| 10 | Frontend: Unit tests for composable | ~30 min |
| **Total** | | **~5–6 hrs** |
