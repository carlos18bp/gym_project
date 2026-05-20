from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from gym_app.models import (
    Service,
    ServiceStage,
    ServiceField,
    ServiceRequest,
    ServiceRequestAnswer,
    ServiceRequestFieldFile,
    ServiceRequestLawyerResponse,
    ServiceRequestLawyerResponseFile,
)


class _ServiceIconMixin:
    """Shared icon_image_url computation for Service serializers."""

    def get_icon_image_url(self, obj):
        request = self.context.get("request")
        if not obj.icon_image:
            return None
        if request:
            return request.build_absolute_uri(obj.icon_image.url)
        return obj.icon_image.url


class ServiceFieldSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ServiceField
        fields = [
            "id",
            "stage",
            "key",
            "label",
            "field_type",
            "placeholder",
            "help_text",
            "is_required",
            "order",
            "options",
            "allowed_extensions",
            "allow_multiple_files",
            "max_files",
        ]
        read_only_fields = ["stage"]


class ServiceStageSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    fields = ServiceFieldSerializer(many=True, required=False)

    class Meta:
        model = ServiceStage
        fields = ["id", "service", "title", "description", "order", "is_active", "fields"]
        read_only_fields = ["service"]


class ServiceSerializer(_ServiceIconMixin, serializers.ModelSerializer):
    stages = ServiceStageSerializer(many=True, required=False)
    icon_image_url = serializers.SerializerMethodField()
    # Model.save() auto-generates slug from short_title/name when missing,
    # so the API mirrors that contract instead of forcing the client to send it.
    slug = serializers.SlugField(max_length=160, required=False, allow_blank=True)

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "short_title",
            "slug",
            "description",
            "icon_image",
            "icon_image_url",
            "is_active",
            "is_featured",
            "featured_order",
            "stages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        stages_data = validated_data.pop("stages", [])
        request = self.context.get("request")
        if request and request.user:
            validated_data["created_by"] = request.user
            validated_data["updated_by"] = request.user

        service = Service.objects.create(**validated_data)
        self._upsert_stages(service, stages_data)
        return service

    def update(self, instance, validated_data):
        stages_data = validated_data.pop("stages", None)
        request = self.context.get("request")

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if request and request.user:
            instance.updated_by = request.user

        instance.save()

        if stages_data is not None:
            self._replace_stages(instance, stages_data)

        return instance

    def _replace_stages(self, service, stages_data):
        """Upsert stages and fields by ID, preserving FK references."""
        self._check_duplicate_stage_orders(stages_data)
        incoming_stage_ids = set()
        for stage_data in stages_data:
            fields_data = stage_data.pop("fields", [])
            stage_id = stage_data.pop("id", None)

            if stage_id:
                # Update existing stage
                try:
                    stage = ServiceStage.objects.get(id=stage_id, service=service)
                    for attr, value in stage_data.items():
                        setattr(stage, attr, value)
                    stage.save()
                except ServiceStage.DoesNotExist:
                    stage = ServiceStage.objects.create(service=service, **stage_data)
            else:
                stage = ServiceStage.objects.create(service=service, **stage_data)

            incoming_stage_ids.add(stage.id)
            self._upsert_fields(stage, fields_data)

        # Delete stages that are no longer in the payload
        service.stages.exclude(id__in=incoming_stage_ids).delete()

    @staticmethod
    def _check_duplicate_field_orders(fields_data, stage_label="etapa"):
        """Surface a friendly, pre-save error when two fields share ``order``.

        The DB-level constraint would still catch this, but the resulting
        ``IntegrityError`` produces an opaque message. Naming the duplicated
        order and the colliding field labels makes the error self-explanatory
        so the admin can correct it without guesswork (client R3 — error 500
        en Administrar Servicios).
        """
        seen = {}
        duplicates = {}
        for field in fields_data:
            order = field.get("order")
            if order is None:
                continue
            label = field.get("label") or field.get("key") or f"orden {order}"
            if order in seen:
                duplicates.setdefault(order, [seen[order]]).append(label)
            else:
                seen[order] = label

        if duplicates:
            messages = []
            for order, labels in duplicates.items():
                joined = ", ".join(f"'{lbl}'" for lbl in labels)
                messages.append(
                    f"El orden {order} está asignado a varios campos en la "
                    f"{stage_label} ({joined}). Asigna un número de orden "
                    f"único a cada campo."
                )
            raise DjangoValidationError({"order": messages})

    @staticmethod
    def _check_duplicate_stage_orders(stages_data):
        """Surface a friendly error when two stages share ``order``."""
        seen = {}
        duplicates = {}
        for stage in stages_data:
            order = stage.get("order")
            if order is None:
                continue
            title = stage.get("title") or f"etapa orden {order}"
            if order in seen:
                duplicates.setdefault(order, [seen[order]]).append(title)
            else:
                seen[order] = title

        if duplicates:
            messages = []
            for order, titles in duplicates.items():
                joined = ", ".join(f"'{t}'" for t in titles)
                messages.append(
                    f"El orden {order} está asignado a varias etapas "
                    f"({joined}). Asigna un número de orden único a cada etapa."
                )
            raise DjangoValidationError({"order": messages})

    def _upsert_fields(self, stage, fields_data):
        """Upsert fields by ID within a stage, preserving FK references.

        Three production-safety measures vs. the original implementation:

        1. Duplicate ``order`` values within the same stage are surfaced
           with a friendly error message before any DB write happens.
        2. Fields not present in the payload are deleted **before** the
           remaining ones are saved, so re-ordering or re-keying within the
           same request never collides with the existing
           ``unique_service_field_order_per_stage`` /
           ``unique_service_field_key_per_stage`` constraints mid-upsert.
        3. ``IntegrityError`` (which DRF/Django do not auto-translate and
           therefore previously surfaced as an HTTP 500) is converted to a
           Django ``ValidationError`` so the calling view's existing
           ``except ValidationError`` block returns a 400 with a clear
           message. ``ValidationError`` raised by ``ServiceField.clean()``
           keeps propagating as-is.
        """
        stage_label = stage.title or f"etapa {stage.order}"
        self._check_duplicate_field_orders(fields_data, stage_label=stage_label)
        # Drop fields that are no longer in the payload BEFORE recreating the
        # remaining ones (see docstring point #1).
        incoming_persisted_ids = {
            f["id"] for f in fields_data if isinstance(f.get("id"), int)
        }
        stage.fields.exclude(id__in=incoming_persisted_ids).delete()

        incoming_field_ids = set()
        for field_data in fields_data:
            field_id = field_data.pop("id", None)
            label = field_data.get("label") or field_data.get("key") or "campo"

            try:
                with transaction.atomic():
                    if field_id:
                        try:
                            field = ServiceField.objects.get(id=field_id, stage=stage)
                            for attr, value in field_data.items():
                                setattr(field, attr, value)
                            field.save()
                        except ServiceField.DoesNotExist:
                            field = ServiceField.objects.create(stage=stage, **field_data)
                    else:
                        field = ServiceField.objects.create(stage=stage, **field_data)
            except IntegrityError as exc:
                raise DjangoValidationError({
                    label: (
                        "Conflicto al guardar el campo (clave u orden duplicado "
                        "dentro de la etapa). Detalle: " + str(exc)
                    )
                })

            incoming_field_ids.add(field.id)

    def _upsert_stages(self, service, stages_data):
        """Create stages and fields for a new service.

        Same ``IntegrityError`` translation as ``_upsert_fields`` so a fresh
        service whose fields fail unique-constraint checks returns a 400
        instead of a 500.
        """
        self._check_duplicate_stage_orders(stages_data)
        for stage_data in stages_data:
            fields_data = stage_data.pop("fields", [])
            stage = ServiceStage.objects.create(service=service, **stage_data)
            stage_label = stage.title or f"etapa {stage.order}"
            self._check_duplicate_field_orders(fields_data, stage_label=stage_label)

            for field_data in fields_data:
                field_data.pop("id", None)
                label = field_data.get("label") or field_data.get("key") or "campo"
                try:
                    with transaction.atomic():
                        ServiceField.objects.create(stage=stage, **field_data)
                except IntegrityError as exc:
                    raise DjangoValidationError({
                        label: (
                            "Conflicto al guardar el campo (clave u orden duplicado "
                            "dentro de la etapa). Detalle: " + str(exc)
                        )
                    })


class ServiceListSerializer(_ServiceIconMixin, serializers.ModelSerializer):
    icon_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "short_title",
            "slug",
            "description",
            "icon_image_url",
            "is_active",
            "is_featured",
            "featured_order",
        ]


class ServiceRequestFieldFileSerializer(serializers.ModelSerializer):
    file_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequestFieldFile
        fields = ["id", "field", "file_name", "download_url", "created_at"]

    def get_file_name(self, obj):
        return obj.original_name or obj.file.name.split("/")[-1]

    def get_download_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        return request.build_absolute_uri(
            f"/api/service-requests/{obj.service_request_id}/field-files/{obj.id}/download/"
        )


class ServiceRequestAnswerSerializer(serializers.ModelSerializer):
    files = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequestAnswer
        fields = [
            "id",
            "field",
            "field_key",
            "field_label",
            "field_type",
            "stage_title",
            "stage_order",
            "value_text",
            "value_json",
            "files",
        ]

    def get_files(self, obj):
        # Filter from prefetched field_files (via _request_queryset) to avoid N+1.
        # field_files__field is select_related so f.field.key is free.
        try:
            all_files = obj.service_request.field_files.all()
            matched = sorted(
                (f for f in all_files if f.field_id and f.field.key == obj.field_key),
                key=lambda f: f.created_at,
            )
        except AttributeError:
            matched = ServiceRequestFieldFile.objects.filter(
                service_request=obj.service_request,
                field__key=obj.field_key,
            ).order_by("created_at")
        return ServiceRequestFieldFileSerializer(matched, many=True, context=self.context).data


class ServiceRequestLawyerResponseFileSerializer(serializers.ModelSerializer):
    file_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequestLawyerResponseFile
        fields = ["id", "file_name", "download_url", "created_at"]

    def get_file_name(self, obj):
        return obj.original_name or obj.file.name.split("/")[-1]

    def get_download_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        return request.build_absolute_uri(
            f"/api/service-requests/{obj.response.service_request_id}/responses/{obj.response_id}/files/{obj.id}/download/"
        )


class ServiceRequestLawyerResponseSerializer(serializers.ModelSerializer):
    responder_name = serializers.SerializerMethodField()
    files = ServiceRequestLawyerResponseFileSerializer(many=True, read_only=True)
    status_before_display = serializers.CharField(source="get_status_before_display", read_only=True)
    status_after_display = serializers.CharField(source="get_status_after_display", read_only=True)

    class Meta:
        model = ServiceRequestLawyerResponse
        fields = [
            "id",
            "responder",
            "responder_name",
            "message",
            "status_before",
            "status_before_display",
            "status_after",
            "status_after_display",
            "files",
            "created_at",
        ]

    def get_responder_name(self, obj):
        if not obj.responder:
            return ""
        full_name = f"{obj.responder.first_name or ''} {obj.responder.last_name or ''}".strip()
        return full_name or obj.responder.email


class ServiceRequestListSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_short_title = serializers.CharField(source="service.short_title", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "service",
            "service_name",
            "service_short_title",
            "status",
            "status_display",
            "tracking_number",
            "is_submitted",
            "submitted_at",
            "created_at",
            "updated_at",
        ]


class ServiceRequestDetailSerializer(serializers.ModelSerializer):
    service = ServiceListSerializer(read_only=True)
    requester_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    answers = ServiceRequestAnswerSerializer(many=True, read_only=True)
    lawyer_responses = ServiceRequestLawyerResponseSerializer(many=True, read_only=True)
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "service",
            "requester",
            "requester_name",
            "status",
            "status_display",
            "tracking_number",
            "is_submitted",
            "current_stage",
            "legal_note",
            "submitted_at",
            "created_at",
            "updated_at",
            "document_url",
            "answers",
            "lawyer_responses",
        ]

    def get_requester_name(self, obj):
        full_name = f"{obj.requester.first_name or ''} {obj.requester.last_name or ''}".strip()
        return full_name or obj.requester.email

    def get_document_url(self, obj):
        if not obj.generated_document:
            return None
        request = self.context.get("request")
        if not request:
            return None
        return request.build_absolute_uri(f"/api/service-requests/{obj.id}/document/download/")
