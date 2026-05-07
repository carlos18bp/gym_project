import os
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Q
from django.dispatch import receiver
from django.utils import timezone
from django.utils.text import slugify


ALLOWED_SERVICE_FIELD_TYPES = [
    ("input", "Texto corto"),
    ("text_area", "Texto largo"),
    ("number", "Numero"),
    ("date", "Fecha"),
    ("email", "Correo electronico"),
    ("select_single", "Seleccion unica"),
    ("select_multiple", "Seleccion multiple"),
    ("file", "Archivo"),
]


SERVICE_REQUEST_STATUS_CHOICES = [
    ("DRAFT", "Borrador"),
    ("OPEN", "Abierto"),
    ("IN_STUDY", "En Estudio"),
    ("IN_PROGRESS", "En Tramite"),
    ("ANSWERED", "Contestado"),
    ("FINALIZED", "Finalizado"),
]


DEFAULT_REQUEST_LEGAL_NOTE = (
    "Esta solicitud esta sujeta a estudio y revision por parte del abogado asignado"
)


def _service_icon_path(instance, filename):
    ext = filename.split(".")[-1].lower()
    return os.path.join("services", "icons", f"{uuid.uuid4().hex}.{ext}")


def _request_document_path(instance, filename):
    ext = filename.split(".")[-1].lower()
    year = timezone.now().year
    return os.path.join("service_requests", "documents", str(year), f"{uuid.uuid4().hex}.{ext}")


def _request_field_file_path(instance, filename):
    ext = filename.split(".")[-1].lower()
    year = timezone.now().year
    return os.path.join("service_requests", "field_files", str(year), f"{uuid.uuid4().hex}.{ext}")


def _request_response_file_path(instance, filename):
    ext = filename.split(".")[-1].lower()
    year = timezone.now().year
    return os.path.join("service_requests", "response_files", str(year), f"{uuid.uuid4().hex}.{ext}")


class Service(models.Model):
    """Catalog item that can be requested by users."""

    name = models.CharField(max_length=140)
    short_title = models.CharField(max_length=40)
    slug = models.SlugField(max_length=160, unique=True)
    description = models.TextField(blank=True, null=True)
    icon_image = models.ImageField(upload_to=_service_icon_path, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    featured_order = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-is_featured", "featured_order", "name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.short_title or self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ServiceStage(models.Model):
    """Logical stage for a service form."""

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="stages")
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["service", "order"], name="unique_service_stage_order"),
        ]

    def __str__(self):
        return f"{self.service.short_title} - Etapa {self.order}: {self.title}"


class ServiceField(models.Model):
    """Field configuration for each service stage."""

    stage = models.ForeignKey(ServiceStage, on_delete=models.CASCADE, related_name="fields")
    key = models.SlugField(max_length=80)
    label = models.CharField(max_length=160)
    field_type = models.CharField(max_length=20, choices=ALLOWED_SERVICE_FIELD_TYPES, default="input")
    placeholder = models.CharField(max_length=200, blank=True, null=True)
    help_text = models.CharField(max_length=255, blank=True, null=True)
    is_required = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=1)
    options = models.JSONField(blank=True, null=True)
    allowed_extensions = models.JSONField(blank=True, null=True)
    allow_multiple_files = models.BooleanField(default=False)
    max_files = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["stage", "key"], name="unique_service_field_key_per_stage"),
            models.UniqueConstraint(fields=["stage", "order"], name="unique_service_field_order_per_stage"),
        ]

    def clean(self):
        if self.field_type in {"select_single", "select_multiple"}:
            if not self.options or not isinstance(self.options, list):
                raise ValidationError({"options": "Las opciones son obligatorias para campos de seleccion."})

        if self.field_type != "file":
            self.allowed_extensions = None
            self.allow_multiple_files = False
            self.max_files = 1

        if self.field_type == "file":
            if self.max_files < 1:
                raise ValidationError({"max_files": "max_files debe ser mayor o igual a 1."})
            if self.allowed_extensions and not isinstance(self.allowed_extensions, list):
                raise ValidationError({"allowed_extensions": "allowed_extensions debe ser una lista de extensiones."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.stage.service.short_title} - {self.label}"


class ServiceRequestSequence(models.Model):
    """Annual sequence lock table for request tracking numbers."""

    year = models.PositiveIntegerField(unique=True)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-year"]

    def __str__(self):
        return f"{self.year}: {self.last_value}"


class ServiceRequest(models.Model):
    """User request for a service."""

    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="requests")
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_requests",
    )
    status = models.CharField(
        max_length=20,
        choices=SERVICE_REQUEST_STATUS_CHOICES,
        default="DRAFT",
    )
    tracking_year = models.PositiveIntegerField(blank=True, null=True)
    tracking_sequence = models.PositiveIntegerField(blank=True, null=True)
    tracking_number = models.CharField(max_length=20, unique=True, blank=True, null=True)
    current_stage = models.PositiveIntegerField(default=1)
    legal_note = models.CharField(max_length=255, default=DEFAULT_REQUEST_LEGAL_NOTE)
    generated_document = models.FileField(upload_to=_request_document_path, blank=True, null=True)
    is_submitted = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tracking_year", "tracking_sequence"],
                condition=Q(tracking_year__isnull=False, tracking_sequence__isnull=False),
                name="unique_service_request_year_sequence",
            )
        ]

    def assign_tracking_number(self):
        if self.tracking_number:
            return self.tracking_number

        year = timezone.now().year
        with transaction.atomic():
            sequence, _ = ServiceRequestSequence.objects.select_for_update().get_or_create(
                year=year,
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value"])

            self.tracking_year = year
            self.tracking_sequence = sequence.last_value
            self.tracking_number = f"{year}-{sequence.last_value:05d}"

        return self.tracking_number

    def mark_submitted(self):
        if self.is_submitted:
            return
        self.assign_tracking_number()
        self.is_submitted = True
        self.status = "OPEN"
        self.submitted_at = timezone.now()

    def __str__(self):
        return self.tracking_number or f"BORRADOR-{self.id}"


class ServiceRequestAnswer(models.Model):
    """Snapshot of user answers for each dynamic field."""

    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    field = models.ForeignKey(
        ServiceField,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="request_answers",
    )
    field_key = models.SlugField(max_length=80)
    field_label = models.CharField(max_length=160)
    field_type = models.CharField(max_length=20)
    stage_title = models.CharField(max_length=140)
    stage_order = models.PositiveIntegerField(default=1)
    value_text = models.TextField(blank=True, null=True)
    value_json = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["stage_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["service_request", "field_key"],
                name="unique_answer_by_request_and_field_key",
            )
        ]

    def __str__(self):
        return f"{self.service_request_id}::{self.field_key}"


class ServiceRequestFieldFile(models.Model):
    """Uploaded files for file-type fields in service requests."""

    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="field_files",
    )
    field = models.ForeignKey(
        ServiceField,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="request_files",
    )
    file = models.FileField(upload_to=_request_field_file_path)
    original_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.original_name or os.path.basename(self.file.name)


class ServiceRequestLawyerResponse(models.Model):
    """Lawyer/admin updates to a service request."""

    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="lawyer_responses",
    )
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_request_responses",
    )
    message = models.TextField(blank=True, null=True)
    status_before = models.CharField(max_length=20, choices=SERVICE_REQUEST_STATUS_CHOICES)
    status_after = models.CharField(max_length=20, choices=SERVICE_REQUEST_STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.service_request_id}: {self.status_before} -> {self.status_after}"


class ServiceRequestLawyerResponseFile(models.Model):
    """Attachment for lawyer responses."""

    response = models.ForeignKey(
        ServiceRequestLawyerResponse,
        on_delete=models.CASCADE,
        related_name="files",
    )
    file = models.FileField(upload_to=_request_response_file_path)
    original_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.original_name or os.path.basename(self.file.name)


@receiver(models.signals.post_delete, sender=ServiceRequestFieldFile)
def delete_service_request_field_file(sender, instance, **kwargs):
    if instance.file and os.path.isfile(instance.file.path):
        os.remove(instance.file.path)


@receiver(models.signals.post_delete, sender=ServiceRequestLawyerResponseFile)
def delete_service_request_response_file(sender, instance, **kwargs):
    if instance.file and os.path.isfile(instance.file.path):
        os.remove(instance.file.path)


@receiver(models.signals.post_delete, sender=ServiceRequest)
def delete_service_request_document(sender, instance, **kwargs):
    if instance.generated_document and os.path.isfile(instance.generated_document.path):
        os.remove(instance.generated_document.path)
