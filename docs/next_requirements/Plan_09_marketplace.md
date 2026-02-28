# Services Marketplace — Implementation Plan

A new independent module offering a mini e-commerce of legal services with dynamic configurable forms (Google Forms–style), service listing, a submission tracking workflow, and Dashboard integration.

---

## Confirmed Decisions

| Question | Decision |
|---|---|
| Who creates services | `lawyer` role + `is_service_manager = True` flag on User model |
| Who views/requests services | All authenticated users (any role) |
| Service form field types | `input`, `text_area`, `number`, `date`, `email`, `select`, `radio`, `checkbox` |
| Submission notifications | Base email to creator on new submission; full in-app notification deferred to Notification Center (Req 05) |
| Dashboard widget | Visible for all roles; shows up to 3 `is_featured` services |
| Service categories | Predefined choices: `consulting`, `document_review`, `legal_process`, `advisory`, `other` |
| Field ordering | Integer `order` field, managed by the creator via UI (drag-and-drop or up/down buttons) |
| Service state | `is_active` boolean; inactive services are hidden from the public listing |

---

## Current Architecture State

### Backend
- **No marketplace/services module exists** — full greenfield implementation required.
- **`DocumentVariable` model** (`models/dynamic_document.py`): has `field_type` choices `input`, `text_area`, `number`, `date`, `email`, `select` with `select_options JSONField`. Reused as design reference for `ServiceField`.
- **User model** (`models/user.py`): roles `client`, `lawyer`, `corporate_client`, `basic`. Boolean flags pattern: `is_gym_lawyer`, `is_profile_completed`. New `is_service_manager` flag follows the same pattern.
- **View pattern**: `@api_view` + `@permission_classes([IsAuthenticated])` function-based views (see `views/user.py`, `views/dynamic_document.py`).
- **URL pattern**: grouped lists (e.g. `user_urls`, `process_urls`) concatenated into `urlpatterns` in `urls.py`.
- **Admin**: `admin.py` uses `@admin.register(Model)` class-based `ModelAdmin`; `models/__init__.py` holds explicit imports + `__all__`.

### Frontend
- **No marketplace views, stores, or routes exist.**
- **`DocumentForm.vue`**: renders `input`, `text_area`, `number`, `date`, `email`, `select` fields from a `variables` array. **Direct pattern reference** for `ServiceFormRenderer.vue`.
- **Dashboard** (`views/dashboard/dashboard.vue`): uses a grid + `Suspense` pattern for async components. New `FeaturedServicesCard.vue` slots directly into the grid.
- **`QuickActionButtons.vue`**: role-based button list — add new "Marketplace" button for all roles.
- **`SlideBar.vue`**: `navigation` ref array with `{ name, action, icon, current, routes }` shape — new item follows this exact shape.
- **Router** (`router/index.js`): `requiresAuth: true` meta guard. New routes use the same `SlideBar` layout parent.
- **Pinia stores**: `defineStore` with `state/getters/actions` + `get_request` / `create_request` / `update_request` — new store at `stores/marketplace/index.js`.

---

## Implementation

### Phase 1 — Backend: User Model Flag

**Modified file: `backend/gym_app/models/user.py`**

Add after the existing `is_profile_completed` field:

```python
is_service_manager = models.BooleanField(
    default=False,
    help_text="If True, this user can create and manage services in the Marketplace."
)
```

**Migration**: `python manage.py makemigrations gym_app && python manage.py migrate`

---

### Phase 2 — Backend: Marketplace Models

**New file: `backend/gym_app/models/marketplace.py`**

```python
from django.db import models
from django.conf import settings


class Service(models.Model):
    CATEGORY_CHOICES = [
        ('consulting', 'Consultoría'),
        ('document_review', 'Revisión de documentos'),
        ('legal_process', 'Trámites'),
        ('advisory', 'Asesoría'),
        ('other', 'Otro'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_services'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Service'
        verbose_name_plural = 'Services'

    def __str__(self):
        return self.title


class ServiceField(models.Model):
    FIELD_TYPE_CHOICES = [
        ('input', 'Text Input'),
        ('text_area', 'Text Area'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('email', 'Email'),
        ('select', 'Select (dropdown)'),
        ('radio', 'Radio (single choice)'),
        ('checkbox', 'Checkbox (multiple)'),
    ]

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='fields')
    label = models.CharField(max_length=200)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPE_CHOICES, default='input')
    placeholder = models.CharField(max_length=200, blank=True, null=True)
    tooltip = models.CharField(max_length=300, blank=True, null=True)
    options = models.JSONField(
        blank=True,
        null=True,
        help_text="List of string options for select, radio, and checkbox field types."
    )
    is_required = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name = 'Service Field'
        verbose_name_plural = 'Service Fields'

    def __str__(self):
        return f"{self.service.title} — {self.label}"


class ServiceSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_review', 'In Review'),
        ('completed', 'Completed'),
    ]

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='submissions')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='service_submissions'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']
        verbose_name = 'Service Submission'
        verbose_name_plural = 'Service Submissions'

    def __str__(self):
        return f"{self.user.email} → {self.service.title} ({self.status})"


class ServiceSubmissionAnswer(models.Model):
    submission = models.ForeignKey(
        ServiceSubmission, on_delete=models.CASCADE, related_name='answers'
    )
    field = models.ForeignKey(
        ServiceField, on_delete=models.SET_NULL, null=True, related_name='answers'
    )
    value = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = 'Submission Answer'
        verbose_name_plural = 'Submission Answers'

    def __str__(self):
        return f"{self.submission} — {self.field.label if self.field else 'deleted field'}"
```

**Register in `backend/gym_app/models/__init__.py`**:

```python
from .marketplace import Service, ServiceField, ServiceSubmission, ServiceSubmissionAnswer
```

Add to `__all__`:
```python
'Service', 'ServiceField', 'ServiceSubmission', 'ServiceSubmissionAnswer',
```

---

### Phase 3 — Backend: Serializers

**New file: `backend/gym_app/serializers/marketplace.py`**

```python
from rest_framework import serializers
from gym_app.models import Service, ServiceField, ServiceSubmission, ServiceSubmissionAnswer


class ServiceFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceField
        fields = ['id', 'label', 'field_type', 'placeholder', 'tooltip',
                  'options', 'is_required', 'order']


class ServiceListSerializer(serializers.ModelSerializer):
    fields_count = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = ['id', 'title', 'description', 'category', 'is_active',
                  'is_featured', 'created_at', 'fields_count']

    def get_fields_count(self, obj):
        return obj.fields.count()


class ServiceDetailSerializer(serializers.ModelSerializer):
    fields = ServiceFieldSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = ['id', 'title', 'description', 'category', 'is_active',
                  'is_featured', 'created_at', 'updated_at', 'fields', 'created_by_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return None


class ServiceWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['id', 'title', 'description', 'category', 'is_active', 'is_featured']


class ServiceSubmissionAnswerSerializer(serializers.ModelSerializer):
    field_label = serializers.SerializerMethodField()

    class Meta:
        model = ServiceSubmissionAnswer
        fields = ['id', 'field', 'field_label', 'value']

    def get_field_label(self, obj):
        return obj.field.label if obj.field else None


class ServiceSubmissionSerializer(serializers.ModelSerializer):
    answers = ServiceSubmissionAnswerSerializer(many=True, read_only=True)
    service_title = serializers.CharField(source='service.title', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceSubmission
        fields = ['id', 'service', 'service_title', 'user', 'user_name',
                  'status', 'notes', 'submitted_at', 'updated_at', 'answers']
        read_only_fields = ['user', 'submitted_at', 'updated_at']

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()
```

---

### Phase 4 — Backend: Views

**New file: `backend/gym_app/views/marketplace.py`**

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings as django_settings
from gym_app.models import Service, ServiceField, ServiceSubmission, ServiceSubmissionAnswer
from gym_app.serializers.marketplace import (
    ServiceListSerializer, ServiceDetailSerializer, ServiceWriteSerializer,
    ServiceFieldSerializer, ServiceSubmissionSerializer
)


def _is_service_manager(user):
    return user.role == 'lawyer' and getattr(user, 'is_service_manager', False)


# ── Services ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def service_list(request):
    """List all active services (all authenticated users)."""
    category = request.query_params.get('category')
    qs = Service.objects.filter(is_active=True).prefetch_related('fields')
    if category:
        qs = qs.filter(category=category)
    return Response(ServiceListSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def service_create(request):
    """Create a new service. Requires is_service_manager."""
    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    serializer = ServiceWriteSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def service_detail(request, service_id):
    """Retrieve, update, or delete a service."""
    try:
        service = Service.objects.prefetch_related('fields').get(pk=service_id)
    except Service.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        if not service.is_active and not _is_service_manager(request.user):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ServiceDetailSerializer(service).data)

    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ('PUT', 'PATCH'):
        serializer = ServiceWriteSerializer(
            service, data=request.data, partial=(request.method == 'PATCH')
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    service.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def service_featured(request):
    """Return up to 3 featured active services for the Dashboard widget."""
    services = Service.objects.filter(is_active=True, is_featured=True)[:3]
    return Response(ServiceListSerializer(services, many=True).data)


# ── Service Fields ────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def service_fields(request, service_id):
    """List or create fields for a service."""
    try:
        service = Service.objects.get(pk=service_id)
    except Service.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ServiceFieldSerializer(service.fields.all(), many=True).data)

    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ServiceFieldSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(service=service)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def service_field_detail(request, service_id, field_id):
    """Update or delete a specific service field."""
    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        field = ServiceField.objects.get(pk=field_id, service_id=service_id)
    except ServiceField.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ServiceFieldSerializer(
        field, data=request.data, partial=(request.method == 'PATCH')
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def service_fields_reorder(request, service_id):
    """Batch update field order. Body: [{ id, order }, ...]"""
    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    items = request.data  # list of { id, order }
    for item in items:
        ServiceField.objects.filter(pk=item['id'], service_id=service_id).update(order=item['order'])
    return Response({'detail': 'Order updated.'})


# ── Submissions ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def service_submit(request, service_id):
    """Submit a service request. Creates submission + answers."""
    try:
        service = Service.objects.prefetch_related('fields').get(pk=service_id, is_active=True)
    except Service.DoesNotExist:
        return Response({'detail': 'Service not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)

    answers_data = request.data.get('answers', [])  # [{ field_id, value }]

    # Validate required fields
    required_field_ids = set(
        service.fields.filter(is_required=True).values_list('id', flat=True)
    )
    submitted_field_ids = {a['field_id'] for a in answers_data if a.get('value')}
    missing = required_field_ids - submitted_field_ids
    if missing:
        return Response(
            {'detail': 'Required fields are missing.', 'missing_fields': list(missing)},
            status=status.HTTP_400_BAD_REQUEST
        )

    submission = ServiceSubmission.objects.create(service=service, user=request.user)
    for answer in answers_data:
        try:
            field = ServiceField.objects.get(pk=answer['field_id'], service=service)
            ServiceSubmissionAnswer.objects.create(
                submission=submission, field=field, value=answer.get('value', '')
            )
        except ServiceField.DoesNotExist:
            pass

    # Notify service manager via email (base version — full notifications deferred to Req 05)
    if service.created_by and service.created_by.email:
        try:
            send_mail(
                subject=f'Nueva solicitud de servicio: {service.title}',
                message=(
                    f'El usuario {request.user.email} ha enviado una solicitud '
                    f'para el servicio "{service.title}".\n\n'
                    f'Ingresa a la plataforma para revisar los detalles.'
                ),
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[service.created_by.email],
                fail_silently=True,
            )
        except Exception:
            pass

    return Response(ServiceSubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_submissions(request):
    """List submissions made by the current user."""
    qs = ServiceSubmission.objects.filter(user=request.user).select_related('service')
    return Response(ServiceSubmissionSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manage_submissions(request):
    """List all submissions for services managed by the current user."""
    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    qs = ServiceSubmission.objects.filter(
        service__created_by=request.user
    ).select_related('service', 'user').prefetch_related('answers__field')
    service_id = request.query_params.get('service')
    status_filter = request.query_params.get('status')
    if service_id:
        qs = qs.filter(service_id=service_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(ServiceSubmissionSerializer(qs, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_submission_status(request, submission_id):
    """Update status and notes of a submission."""
    if not _is_service_manager(request.user):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        submission = ServiceSubmission.objects.get(
            pk=submission_id, service__created_by=request.user
        )
    except ServiceSubmission.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    notes = request.data.get('notes')
    valid_statuses = ['pending', 'in_review', 'completed']

    if new_status and new_status not in valid_statuses:
        return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_status:
        submission.status = new_status
    if notes is not None:
        submission.notes = notes
    submission.save()
    return Response(ServiceSubmissionSerializer(submission).data)
```

---

### Phase 5 — Backend: Admin

**Modified file: `backend/gym_app/admin.py`** — add at the end:

```python
from gym_app.models import Service, ServiceField, ServiceSubmission

class ServiceFieldInline(admin.TabularInline):
    model = ServiceField
    extra = 0
    fields = ['label', 'field_type', 'is_required', 'order']

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'is_active', 'is_featured', 'created_by', 'created_at']
    list_filter = ['is_active', 'is_featured', 'category']
    search_fields = ['title', 'description']
    inlines = [ServiceFieldInline]

@admin.register(ServiceSubmission)
class ServiceSubmissionAdmin(admin.ModelAdmin):
    list_display = ['service', 'user', 'status', 'submitted_at']
    list_filter = ['status', 'service']
    search_fields = ['user__email', 'service__title']
```

---

### Phase 6 — Backend: URLs

**Modified file: `backend/gym_app/urls.py`**

Add import at the top:
```python
from gym_app.views.marketplace import (
    service_list, service_create, service_detail, service_featured,
    service_fields, service_field_detail, service_fields_reorder,
    service_submit, my_submissions, manage_submissions, update_submission_status
)
```

Add new URL group before `urlpatterns`:
```python
marketplace_urls = [
    path('services/', service_list, name='service_list'),
    path('services/create/', service_create, name='service_create'),
    path('services/featured/', service_featured, name='service_featured'),
    path('services/<int:service_id>/', service_detail, name='service_detail'),
    path('services/<int:service_id>/fields/', service_fields, name='service_fields'),
    path('services/<int:service_id>/fields/reorder/', service_fields_reorder, name='service_fields_reorder'),
    path('services/<int:service_id>/fields/<int:field_id>/', service_field_detail, name='service_field_detail'),
    path('services/<int:service_id>/submit/', service_submit, name='service_submit'),
    path('my-service-submissions/', my_submissions, name='my_submissions'),
    path('service-submissions/manage/', manage_submissions, name='manage_submissions'),
    path('service-submissions/<int:submission_id>/status/', update_submission_status, name='update_submission_status'),
]
```

Append `+ marketplace_urls` to `urlpatterns`.

---

### Phase 7 — Backend: Tests

**New file: `backend/gym_app/tests/views/test_marketplace.py`**

```python
import pytest
from gym_app.models import Service, ServiceField, ServiceSubmission

pytestmark = pytest.mark.django_db


class TestServiceList:
    def test_authenticated_user_can_list_active_services(self, api_client, client_user, lawyer_user):
        Service.objects.create(title='Tax Consulting', description='Desc', is_active=True, created_by=lawyer_user)
        Service.objects.create(title='Hidden', description='Desc', is_active=False, created_by=lawyer_user)
        api_client.force_authenticate(user=client_user)
        response = api_client.get('/api/services/')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['title'] == 'Tax Consulting'

    def test_unauthenticated_user_cannot_list_services(self, api_client):
        response = api_client.get('/api/services/')
        assert response.status_code == 401

    def test_category_filter(self, api_client, client_user, lawyer_user):
        Service.objects.create(title='S1', description='', category='consulting', is_active=True, created_by=lawyer_user)
        Service.objects.create(title='S2', description='', category='advisory', is_active=True, created_by=lawyer_user)
        api_client.force_authenticate(user=client_user)
        response = api_client.get('/api/services/?category=consulting')
        assert response.status_code == 200
        assert len(response.data) == 1


class TestServiceCreate:
    def test_service_manager_can_create_service(self, api_client, lawyer_user):
        lawyer_user.is_service_manager = True
        lawyer_user.save()
        api_client.force_authenticate(user=lawyer_user)
        data = {'title': 'New Service', 'description': 'Details', 'category': 'consulting', 'is_active': True, 'is_featured': False}
        response = api_client.post('/api/services/create/', data, format='json')
        assert response.status_code == 201
        assert Service.objects.filter(title='New Service').exists()

    def test_non_manager_cannot_create_service(self, api_client, lawyer_user):
        lawyer_user.is_service_manager = False
        lawyer_user.save()
        api_client.force_authenticate(user=lawyer_user)
        data = {'title': 'Blocked', 'description': 'Desc', 'category': 'other', 'is_active': True, 'is_featured': False}
        response = api_client.post('/api/services/create/', data, format='json')
        assert response.status_code == 403
        assert not Service.objects.filter(title='Blocked').exists()

    def test_client_cannot_create_service(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        data = {'title': 'Blocked', 'description': 'Desc', 'category': 'other', 'is_active': True, 'is_featured': False}
        response = api_client.post('/api/services/create/', data, format='json')
        assert response.status_code == 403


class TestServiceSubmission:
    def test_authenticated_user_can_submit_service(self, api_client, client_user, lawyer_user):
        lawyer_user.is_service_manager = True
        lawyer_user.save()
        service = Service.objects.create(title='S', description='D', is_active=True, created_by=lawyer_user)
        field = ServiceField.objects.create(service=service, label='Name', field_type='input', is_required=True, order=0)
        api_client.force_authenticate(user=client_user)
        data = {'answers': [{'field_id': field.id, 'value': 'John'}]}
        response = api_client.post(f'/api/services/{service.id}/submit/', data, format='json')
        assert response.status_code == 201
        assert ServiceSubmission.objects.filter(service=service, user=client_user).exists()

    def test_missing_required_field_returns_400(self, api_client, client_user, lawyer_user):
        service = Service.objects.create(title='S', description='D', is_active=True, created_by=lawyer_user)
        ServiceField.objects.create(service=service, label='Required Field', field_type='input', is_required=True, order=0)
        api_client.force_authenticate(user=client_user)
        response = api_client.post(f'/api/services/{service.id}/submit/', {'answers': []}, format='json')
        assert response.status_code == 400
        assert 'missing_fields' in response.data

    def test_inactive_service_cannot_be_submitted(self, api_client, client_user, lawyer_user):
        service = Service.objects.create(title='S', description='D', is_active=False, created_by=lawyer_user)
        api_client.force_authenticate(user=client_user)
        response = api_client.post(f'/api/services/{service.id}/submit/', {'answers': []}, format='json')
        assert response.status_code == 404


class TestManageSubmissions:
    def test_service_manager_can_update_submission_status(self, api_client, client_user, lawyer_user):
        lawyer_user.is_service_manager = True
        lawyer_user.save()
        service = Service.objects.create(title='S', description='D', is_active=True, created_by=lawyer_user)
        submission = ServiceSubmission.objects.create(service=service, user=client_user, status='pending')
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/service-submissions/{submission.id}/status/',
            {'status': 'in_review', 'notes': 'Reviewing now'},
            format='json'
        )
        assert response.status_code == 200
        submission.refresh_from_db()
        assert submission.status == 'in_review'
        assert submission.notes == 'Reviewing now'

    def test_invalid_status_returns_400(self, api_client, client_user, lawyer_user):
        lawyer_user.is_service_manager = True
        lawyer_user.save()
        service = Service.objects.create(title='S', description='D', is_active=True, created_by=lawyer_user)
        submission = ServiceSubmission.objects.create(service=service, user=client_user, status='pending')
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/service-submissions/{submission.id}/status/',
            {'status': 'invalid_status'},
            format='json'
        )
        assert response.status_code == 400

    def test_non_manager_cannot_see_managed_submissions(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        response = api_client.get('/api/service-submissions/manage/')
        assert response.status_code == 403
```

---

### Phase 8 — Frontend: Pinia Store

**New file: `frontend/src/stores/marketplace/index.js`**

```javascript
import { defineStore } from 'pinia';
import { get_request, create_request, update_request } from '../services/request_http';

export const useMarketplaceStore = defineStore('marketplace', {
  state: () => ({
    services: [],
    featuredServices: [],
    currentService: null,
    mySubmissions: [],
    managedSubmissions: [],
    loading: false,
    error: null,
  }),

  getters: {
    activeServices: (state) => state.services.filter(s => s.is_active),
    servicesByCategory: (state) => (category) =>
      state.services.filter(s => s.category === category),
  },

  actions: {
    async fetchServices(category = null) {
      this.loading = true;
      try {
        const url = category ? `services/?category=${category}` : 'services/';
        const response = await get_request(url);
        this.services = response.data;
      } catch (error) {
        this.error = error;
      } finally {
        this.loading = false;
      }
    },

    async fetchFeaturedServices() {
      try {
        const response = await get_request('services/featured/');
        this.featuredServices = response.data;
      } catch (error) {
        console.error('Error fetching featured services:', error);
      }
    },

    async fetchServiceDetail(serviceId) {
      this.loading = true;
      try {
        const response = await get_request(`services/${serviceId}/`);
        this.currentService = response.data;
        return response.data;
      } catch (error) {
        this.error = error;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createService(data) {
      const response = await create_request('services/create/', 'POST', data);
      return response.data;
    },

    async updateService(serviceId, data) {
      const response = await update_request(`services/${serviceId}/`, 'PATCH', data);
      return response.data;
    },

    async createField(serviceId, data) {
      const response = await create_request(`services/${serviceId}/fields/`, 'POST', data);
      return response.data;
    },

    async updateField(serviceId, fieldId, data) {
      const response = await update_request(`services/${serviceId}/fields/${fieldId}/`, 'PATCH', data);
      return response.data;
    },

    async deleteField(serviceId, fieldId) {
      await create_request(`services/${serviceId}/fields/${fieldId}/`, 'DELETE');
    },

    async reorderFields(serviceId, items) {
      await create_request(`services/${serviceId}/fields/reorder/`, 'POST', items);
    },

    async submitService(serviceId, answers) {
      const response = await create_request(`services/${serviceId}/submit/`, 'POST', { answers });
      return response.data;
    },

    async fetchMySubmissions() {
      const response = await get_request('my-service-submissions/');
      this.mySubmissions = response.data;
    },

    async fetchManagedSubmissions(filters = {}) {
      let url = 'service-submissions/manage/';
      const params = new URLSearchParams(filters).toString();
      if (params) url += `?${params}`;
      const response = await get_request(url);
      this.managedSubmissions = response.data;
    },

    async updateSubmissionStatus(submissionId, data) {
      const response = await update_request(`service-submissions/${submissionId}/status/`, 'PATCH', data);
      return response.data;
    },
  },
});
```

---

### Phase 9 — Frontend: New Views

**New files**:

| File | Purpose |
|---|---|
| `frontend/src/views/marketplace/ServicesList.vue` | Public listing with category filter; shows service cards |
| `frontend/src/views/marketplace/ServiceDetail.vue` | Service detail + `ServiceFormRenderer.vue` to submit |
| `frontend/src/views/marketplace/MySubmissions.vue` | User's submission history with status badges |
| `frontend/src/views/marketplace/ServicesManager.vue` | Manager-only: lists services created by them + submissions overview |
| `frontend/src/views/marketplace/ServiceEditor.vue` | Manager-only: create/edit service metadata + `ServiceFieldBuilder.vue` |

**New components**:

| File | Purpose |
|---|---|
| `frontend/src/components/marketplace/ServiceCard.vue` | Reusable card (title, description truncated, category badge, CTA button) |
| `frontend/src/components/marketplace/ServiceFormRenderer.vue` | Renders `ServiceField[]` as form inputs — mirrors `DocumentForm.vue` field rendering |
| `frontend/src/components/marketplace/ServiceFieldBuilder.vue` | Manager field editor: add/edit/delete/reorder fields |
| `frontend/src/components/dashboard/FeaturedServicesCard.vue` | Dashboard widget — shows up to 3 featured services |

---

### Phase 10 — Frontend: Router

**Modified file: `frontend/src/router/index.js`**

Add inside the `SlideBar` children array (after the existing dashboard route):

```javascript
{
  path: '/marketplace',
  name: 'marketplace',
  component: () => import('@/views/marketplace/ServicesList.vue'),
  meta: { requiresAuth: true, title: 'Marketplace' },
},
{
  path: '/marketplace/:id',
  name: 'marketplace_detail',
  component: () => import('@/views/marketplace/ServiceDetail.vue'),
  meta: { requiresAuth: true, title: 'Detalle del Servicio' },
},
{
  path: '/marketplace/my-submissions',
  name: 'marketplace_my_submissions',
  component: () => import('@/views/marketplace/MySubmissions.vue'),
  meta: { requiresAuth: true, title: 'Mis Solicitudes' },
},
{
  path: '/marketplace/manage',
  name: 'marketplace_manage',
  component: () => import('@/views/marketplace/ServicesManager.vue'),
  meta: { requiresAuth: true, title: 'Gestión de Servicios' },
},
{
  path: '/marketplace/manage/:id/edit',
  name: 'marketplace_edit',
  component: () => import('@/views/marketplace/ServiceEditor.vue'),
  meta: { requiresAuth: true, title: 'Editar Servicio' },
},
{
  path: '/marketplace/manage/create',
  name: 'marketplace_create',
  component: () => import('@/views/marketplace/ServiceEditor.vue'),
  meta: { requiresAuth: true, title: 'Crear Servicio' },
},
```

**Guard in `beforeEach`**: add a check that redirects non-service-managers away from `/marketplace/manage*` routes (use `userStore.currentUser?.is_service_manager`).

---

### Phase 11 — Frontend: UI Integration

#### `SlideBar.vue` — new navigation item
Add after `"Archivos Jurídicos"` in the `navigation` array:

```javascript
{
  name: "Marketplace",
  action: (item) => {
    setCurrent(item);
    router.push({ name: "marketplace" });
  },
  icon: ShoppingBagIcon,  // from @heroicons/vue/24/outline
  current: false,
  routes: ['/marketplace']
},
```

Import `ShoppingBagIcon` from `@heroicons/vue/24/outline`.

#### `QuickActionButtons.vue` — new button for all roles
Add a shared button (outside the `v-if="lawyer"` / `v-else` templates) pointing to the marketplace:

```html
<router-link
  :to="{ name: 'marketplace' }"
  class="flex items-center bg-blue-50 rounded-xl px-6 py-4 hover:shadow-md transition border border-blue-200"
>
  <div class="flex-shrink-0 rounded-full p-3 mr-4">
    <ShoppingBagIcon class="size-8 text-blue-600" />
  </div>
  <div class="flex flex-col">
    <span class="font-medium text-primary">Marketplace</span>
    <span class="text-sm text-gray-500">Servicios disponibles</span>
  </div>
  <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
</router-link>
```

#### `dashboard.vue` — add `FeaturedServicesCard`
Add after `<LegalUpdatesCard />` in the grid:

```html
<Suspense>
  <template #default>
    <FeaturedServicesCard class="w-full" />
  </template>
  <template #fallback>
    <div class="w-full bg-gray-50 animate-pulse rounded-lg p-4 h-40"></div>
  </template>
</Suspense>
```

Import: `import FeaturedServicesCard from '@/components/dashboard/FeaturedServicesCard.vue';`

---

## Files Summary

### New Files
| Layer | Path |
|---|---|
| Backend model | `backend/gym_app/models/marketplace.py` |
| Backend serializers | `backend/gym_app/serializers/marketplace.py` |
| Backend views | `backend/gym_app/views/marketplace.py` |
| Backend tests | `backend/gym_app/tests/views/test_marketplace.py` |
| Frontend store | `frontend/src/stores/marketplace/index.js` |
| Frontend view | `frontend/src/views/marketplace/ServicesList.vue` |
| Frontend view | `frontend/src/views/marketplace/ServiceDetail.vue` |
| Frontend view | `frontend/src/views/marketplace/MySubmissions.vue` |
| Frontend view | `frontend/src/views/marketplace/ServicesManager.vue` |
| Frontend view | `frontend/src/views/marketplace/ServiceEditor.vue` |
| Frontend component | `frontend/src/components/marketplace/ServiceCard.vue` |
| Frontend component | `frontend/src/components/marketplace/ServiceFormRenderer.vue` |
| Frontend component | `frontend/src/components/marketplace/ServiceFieldBuilder.vue` |
| Frontend component | `frontend/src/components/dashboard/FeaturedServicesCard.vue` |

### Modified Files
| Layer | Path | Change |
|---|---|---|
| Backend model | `backend/gym_app/models/user.py` | Add `is_service_manager` field |
| Backend models init | `backend/gym_app/models/__init__.py` | Import marketplace models |
| Backend admin | `backend/gym_app/admin.py` | Register `Service`, `ServiceSubmission` |
| Backend URLs | `backend/gym_app/urls.py` | Add `marketplace_urls` |
| Frontend router | `frontend/src/router/index.js` | Add 6 marketplace routes + guard |
| Frontend layout | `frontend/src/components/layouts/SlideBar.vue` | Add "Marketplace" nav item |
| Frontend component | `frontend/src/components/dashboard/QuickActionButtons.vue` | Add marketplace button |
| Frontend dashboard | `frontend/src/views/dashboard/dashboard.vue` | Add `FeaturedServicesCard` |

---

## Implementation Order

| Phase | Task | Est. Time |
|---|---|---|
| 1 | User model flag + migration | 0.5 h |
| 2 | Marketplace models + `__init__` | 1 h |
| 3 | Serializers | 1 h |
| 4 | Views (API) | 2 h |
| 5 | Admin registration | 0.5 h |
| 6 | URL wiring | 0.5 h |
| 7 | Backend tests | 2 h |
| 8 | Frontend Pinia store | 1 h |
| 9 | Frontend views (5 views) | 5 h |
| 10 | Frontend components (4 components) | 4 h |
| 11 | Router + navigation integration | 1 h |
| 12 | Dashboard + QuickActions integration | 1 h |
| **Total** | | **~19.5 h** |

**Estimated cost**: High difficulty → **2,700,000 – 3,200,000 COP**

---

## Dependencies

| Dependency | Status | Impact |
|---|---|---|
| Notification Center (Req 05 / Plan 05) | Not yet implemented | Full in-app notifications deferred; base email fallback in Phase 4 covers the first version |
| `is_service_manager` flag admin toggle | Requires admin access to set on User | Must be documented for the ops team |
| Plan 01 (`is_manager`, `is_archived`) | Independent | No conflict — different flags |
