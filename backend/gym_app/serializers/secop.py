from rest_framework import serializers
from gym_app.models import (
    SECOPProcess, ProcessClassification, SECOPAlert,
    AlertNotification, SyncLog, SavedView
)
from gym_app.serializers import UserSerializer


class SECOPProcessListSerializer(serializers.ModelSerializer):
    """
    Serializer for SECOP process list view.
    Includes computed fields for UI display.
    """
    is_open = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    my_classification = serializers.SerializerMethodField()

    class Meta:
        model = SECOPProcess
        fields = [
            'id', 'process_id', 'reference', 'entity_name', 'entity_nit',
            'department', 'city', 'procedure_name', 'description',
            'status', 'procurement_method', 'contract_type',
            'base_price', 'publication_date', 'closing_date',
            'process_url', 'unspsc_code', 'is_open', 'days_remaining',
            'my_classification',
        ]

    def get_my_classification(self, obj):
        """Return the current user's classification for this process."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        user_id = request.user.id
        for c in obj.classifications.all():
            if c.user_id == user_id:
                return {
                    'id': c.id,
                    'status': c.status,
                    'notes': c.notes,
                    'updated_at': c.updated_at,
                }
        return None


class SECOPProcessDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for SECOP process detail view.
    Includes full data and all team classifications.
    """
    is_open = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    classifications = serializers.SerializerMethodField()

    class Meta:
        model = SECOPProcess
        fields = [
            'id', 'process_id', 'reference', 'entity_name', 'entity_nit',
            'department', 'city', 'entity_level',
            'procedure_name', 'description', 'phase',
            'status', 'procurement_method', 'procurement_justification',
            'contract_type', 'base_price',
            'duration_value', 'duration_unit',
            'publication_date', 'last_update_date', 'closing_date',
            'process_url', 'unspsc_code',
            'is_open', 'days_remaining', 'classifications',
            'synced_at', 'raw_data',
        ]

    def get_classifications(self, obj):
        """Return all classifications for this process with user info."""
        request = self.context.get('request')
        current_user_id = request.user.id if request and request.user.is_authenticated else None
        classifications = obj.classifications.select_related('user').all()
        return [
            {
                'id': c.id,
                'user': {
                    'id': c.user.id,
                    'first_name': c.user.first_name,
                    'last_name': c.user.last_name,
                },
                'status': c.status,
                'notes': c.notes,
                'is_mine': c.user.id == current_user_id,
                'created_at': c.created_at,
                'updated_at': c.updated_at,
            }
            for c in classifications
        ]


class ProcessClassificationSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating process classifications.
    User is auto-assigned from request context.
    """

    class Meta:
        model = ProcessClassification
        fields = ['id', 'process', 'status', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        """Create or update classification for the current user."""
        user = self.context['request'].user
        process = validated_data['process']

        classification, _ = ProcessClassification.objects.update_or_create(
            process=process,
            user=user,
            defaults={
                'status': validated_data.get('status', ProcessClassification.Status.INTERESTING),
                'notes': validated_data.get('notes', ''),
            }
        )
        return classification


class SECOPAlertSerializer(serializers.ModelSerializer):
    """
    Serializer for SECOP alert CRUD.
    """
    notification_count = serializers.SerializerMethodField()

    class Meta:
        model = SECOPAlert
        fields = [
            'id', 'name', 'keywords', 'entities', 'departments',
            'min_budget', 'max_budget', 'procurement_methods',
            'frequency', 'is_active',
            'created_at', 'updated_at', 'notification_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_notification_count(self, obj):
        """Return count of notifications generated by this alert."""
        return obj.notifications.count()

    def create(self, validated_data):
        """Create alert for the current user."""
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SyncLogSerializer(serializers.ModelSerializer):
    """
    Serializer for sync log display.
    """
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = SyncLog
        fields = [
            'id', 'started_at', 'finished_at', 'status',
            'records_processed', 'records_created', 'records_updated',
            'error_message', 'duration_seconds',
        ]

    def get_duration_seconds(self, obj):
        """Calculate sync duration in seconds."""
        if obj.finished_at and obj.started_at:
            return (obj.finished_at - obj.started_at).total_seconds()
        return None


class SavedViewSerializer(serializers.ModelSerializer):
    """
    Serializer for saved filter views.
    """

    class Meta:
        model = SavedView
        fields = ['id', 'name', 'filters', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        """Create or update saved view for the current user."""
        user = self.context['request'].user
        saved_view, _ = SavedView.objects.update_or_create(
            user=user,
            name=validated_data['name'],
            defaults={'filters': validated_data.get('filters', {})},
        )
        return saved_view
