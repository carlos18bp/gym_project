# Fake Data Audit Report - Validaciones, Roles y Dependencias

## Resumen Ejecutivo

Auditoría de los comandos de generación de fake data para verificar alineación con reglas de negocio, validaciones y restricciones del sistema.

---

## Hallazgos Críticos

### 🔴 CRITICAL: Estado inválido en `create_dynamic_documents.py`

**Archivo:** `create_dynamic_documents.py:67`
**Problema:** Usa estado `'Pending Review'` que NO existe en `DynamicDocument.STATE_CHOICES`

```python
# INCORRECTO (línea 67):
states = ['Draft', 'Published', 'Progress', 'Completed', 'Rejected', 'Pending Review']
```

**Estados válidos según modelo (`dynamic_document.py:68-77`):**
- `Published`
- `Draft`
- `Progress`
- `Completed`
- `PendingSignatures` ← Correcto (no "Pending Review")
- `FullySigned`
- `Rejected`
- `Expired`

**Impacto:** Documentos generados con estado inválido pueden causar errores en filtros y validaciones frontend/backend.

**Corrección requerida:** Reemplazar `'Pending Review'` por `'PendingSignatures'` y considerar agregar `'FullySigned'` y `'Expired'`.

---

## Hallazgos Medios

### 🟡 MEDIUM: `create_activity_logs.py` borra TODOS los activity logs

**Archivo:** `create_activity_logs.py:87`
```python
ActivityFeed.objects.all().delete()  # ← Peligroso
```

**Problema:** Elimina TODOS los registros, no solo los fake. En ambiente de desarrollo compartido o staging podría borrar datos reales.

**Impacto:** Pérdida de datos de actividad real si se ejecuta en ambiente incorrecto.

**Recomendación:** Agregar filtro o flag `--clear-existing` con confirmación.

---

### 🟡 MEDIUM: Filtro de rol inconsistente en `create_legal_requests.py`

**Archivo:** `create_legal_requests.py:107-114`
```python
special_client = User.objects.filter(
    email='carlos18bp@gmail.com',
    role='client'  # ← Restrictivo
).first()
special_basic = User.objects.filter(
    email='info.montreal.studios@gmail.com',
    role='basic'  # ← Restrictivo
).first()
```

**Problema:** Si el usuario cambia de rol (ej: de `client` a `corporate_client`), el comando no lo encuentra.

**Comparación con `create_dynamic_documents.py:48-54`:**
```python
# CORRECTO - busca solo por email:
special_client = User.objects.filter(
    email='carlos18bp@gmail.com',
).first()
```

**Recomendación:** Unificar patrón: buscar por email sin filtrar por rol.

---

### 🟡 MEDIUM: `action_types` incompleto en `create_activity_logs.py`

**Archivo:** `create_activity_logs.py:36`
```python
action_types = ['create', 'edit', 'finish', 'delete', 'update', 'other']
```

**Modelo `user.py:201-209`:**
```python
ACTION_TYPE_CHOICES = [
    ('create', 'Create'),
    ('edit', 'Edit'),
    ('finish', 'Finish'),
    ('delete', 'Delete'),
    ('update', 'Update'),
    ('download', 'Download'),  # ← Falta en fake data
    ('other', 'Other'),
]
```

**Impacto:** No se generan actividades de tipo `download`, lo que puede dejar sin probar ese flujo.

---

## Matriz de Reglas Extraídas

### User (`user.py`)

| Regla | Tipo | Fuente | Severidad |
|-------|------|--------|-----------|
| `role` debe ser uno de: `client`, `lawyer`, `corporate_client`, `basic` | choices | `ROLE_CHOICES` | CRITICAL |
| `document_type` debe ser uno de: `NIT`, `CC`, `NUIP`, `EIN` | choices | `DOCUMENT_TYPE_CHOICES` | MEDIUM |
| `email` es único | unique | campo `email` | CRITICAL |
| ActivityFeed máximo 20 por usuario | limit | `ActivityFeed.save()` | MEDIUM |

### Organization (`organization.py`)

| Regla | Tipo | Fuente | Severidad |
|-------|------|--------|-----------|
| `corporate_client` debe tener `role='corporate_client'` | validación | `Organization.clean()` | CRITICAL |
| Solo 1 líder (LEADER) por organización | validación | `OrganizationMembership.clean()` | CRITICAL |
| Membresía única por (organization, user) | unique_together | `OrganizationMembership.Meta` | CRITICAL |
| Invitación única por (organization, invited_user, status) | unique_together | `OrganizationInvitation.Meta` | HIGH |
| Solo `client` o `basic` pueden ser invitados | validación | `OrganizationInvitation.clean()` | CRITICAL |
| Solo `corporate_client` puede enviar invitaciones | validación | `OrganizationInvitation.clean()` | CRITICAL |
| Invitador debe ser líder de la organización | validación | `OrganizationInvitation.clean()` | CRITICAL |
| Post author debe ser líder de la organización | validación | `OrganizationPost.clean()` | HIGH |

### CorporateRequest (`corporate_request.py`)

| Regla | Tipo | Fuente | Severidad |
|-------|------|--------|-----------|
| `client` debe tener `role='client'` | limit_choices_to | FK `client` | CRITICAL |
| `corporate_client` debe tener `role='corporate_client'` | limit_choices_to | FK `corporate_client` | CRITICAL |
| `client` debe ser miembro de la organización | validación | `CorporateRequest.clean()` | CRITICAL |
| `corporate_client` debe ser líder de la organización | validación | `CorporateRequest.clean()` | CRITICAL |
| `status` debe ser: PENDING, IN_REVIEW, RESPONDED, RESOLVED, CLOSED | choices | `STATUS_CHOICES` | HIGH |
| `priority` debe ser: LOW, MEDIUM, HIGH, URGENT | choices | `PRIORITY_CHOICES` | HIGH |
| `request_number` es único | unique | campo | CRITICAL |

### LegalRequest (`legal_request.py`)

| Regla | Tipo | Fuente | Severidad |
|-------|------|--------|-----------|
| `status` debe ser: PENDING, IN_REVIEW, RESPONDED, CLOSED | choices | `STATUS_CHOICES` | HIGH |
| `request_number` es único (auto-generado) | unique | campo | CRITICAL |
| `user_type` en respuestas: `lawyer` o `client` | choices | `LegalRequestResponse.USER_TYPE_CHOICES` | HIGH |

### DynamicDocument (`dynamic_document.py`)

| Regla | Tipo | Fuente | Severidad |
|-------|------|--------|-----------|
| `state` debe ser: Published, Draft, Progress, Completed, PendingSignatures, FullySigned, Rejected, Expired | choices | `STATE_CHOICES` | **CRITICAL** |
| DocumentSignature único por (document, signer) | unique_together | `DocumentSignature.Meta` | CRITICAL |
| DocumentVisibilityPermission único por (document, user) | unique_together | Meta | CRITICAL |
| DocumentUsabilityPermission único por (document, user) | unique_together | Meta | CRITICAL |
| Usability requiere Visibility previa (excepto lawyers) | validación | `DocumentUsabilityPermission.clean()` | HIGH |
| `field_type` en variables: input, text_area, number, date, email, select | choices | `DocumentVariable.FIELD_TYPE_CHOICES` | MEDIUM |

### Process (`process.py`)

| Regla | Tipo | Fuente | Severidad |
|-------|------|--------|-----------|
| `lawyer` es FK requerido | FK | `Process.lawyer` | CRITICAL |
| `case` es FK requerido | FK | `Process.case` | CRITICAL |
| `progress` entre 0 y 100 | validators | `MinValueValidator, MaxValueValidator` | MEDIUM |
| RecentProcess único por (user, process) | unique_together | Meta | MEDIUM |

---

## Grafo de Dependencias de Generación

```
┌─────────────────────────────────────────────────────────────┐
│                    ORDEN DE EJECUCIÓN                       │
└─────────────────────────────────────────────────────────────┘

1. create_clients_lawyers
   └── Crea: User (roles: client, lawyer)
   └── Sin dependencias previas

2. create_organizations  
   └── Requiere: User con role=corporate_client
   └── Crea: Organization, OrganizationMembership, OrganizationPost
   └── Dependencias:
       ├── Organization.corporate_client → User (corporate_client)
       ├── OrganizationMembership.user → User
       └── OrganizationPost.author → User (corporate_client = líder)

3. create_legal_requests
   └── Requiere: User (cualquier rol para crear, lawyer para respuestas)
   └── Crea: LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequestResponse
   └── Dependencias:
       ├── LegalRequest.user → User
       ├── LegalRequest.request_type → LegalRequestType (se crean si no existen)
       ├── LegalRequest.discipline → LegalDiscipline (se crean si no existen)
       └── LegalRequestResponse.user → User

4. create_processes
   └── Requiere: User (client para clients, lawyer para lawyer), Case
   └── Crea: Process, Stage, CaseFile, Case
   └── Dependencias:
       ├── Process.lawyer → User (role=lawyer)
       ├── Process.clients → User (típicamente role=client)
       ├── Process.case → Case (se crean si no existen)
       └── Process.stages → Stage (se crean nuevos)

5. create_dynamic_documents
   └── Requiere: User (lawyer para created_by, client-side para assigned_to)
   └── Crea: DynamicDocument, DocumentVariable, DocumentSignature, Tag, DocumentFolder
   └── Dependencias:
       ├── DynamicDocument.created_by → User (típicamente lawyer)
       ├── DynamicDocument.assigned_to → User (típicamente client)
       ├── DocumentSignature.signer → User
       └── DocumentVisibilityPermission.user → User

6. create_activity_logs
   └── Requiere: User, Process (opcional), DynamicDocument (opcional)
   └── Crea: ActivityFeed
   └── Dependencias:
       ├── ActivityFeed.user → User
       └── Referencias a Process.ref y DynamicDocument.title en descriptions
```

---

## Checklist de Correcciones Aplicadas

- [x] **CRITICAL**: Corregido estados en `create_dynamic_documents.py:67` - Reemplazado `'Pending Review'` por estados válidos
- [x] **MEDIUM**: Agregado `'download'` a action_types en `create_activity_logs.py:36`
- [x] **MEDIUM**: Unificada búsqueda de usuarios especiales en `create_legal_requests.py` y `create_processes.py`
- [ ] **BACKLOG**: Agregar flag `--clear-existing` en `create_activity_logs.py` en lugar de borrado automático (mejora futura)

---

## Tests de Regresión Creados

Archivo: `gym_app/tests/commands/test_fake_data_generation.py`

**Resultados: 13/13 PASSED**

| Test Class | Tests | Estado |
|------------|-------|--------|
| TestDynamicDocumentStatesValidity | 3 | ✅ PASSED |
| TestActivityFeedActionTypes | 4 | ✅ PASSED |
| TestLegalRequestStatusValidity | 1 | ✅ PASSED |
| TestOrganizationBusinessRules | 3 | ✅ PASSED |
| TestUserRoleChoices | 1 | ✅ PASSED |
| TestProcessBusinessRules | 1 | ✅ PASSED |

---

## Resumen de Cambios Aplicados

1. **`create_dynamic_documents.py:67`**: Estados actualizados a `['Draft', 'Published', 'Progress', 'Completed', 'PendingSignatures', 'FullySigned', 'Rejected', 'Expired']`
2. **`create_activity_logs.py:36`**: Agregado `'download'` a action_types
3. **`create_activity_logs.py:75-81`**: Agregadas plantillas para acción `'download'`
4. **`create_legal_requests.py:108-113`**: Removido filtro de rol para usuarios especiales
5. **`create_processes.py:46-51`**: Removido filtro de rol para usuarios especiales
