from rest_framework import serializers
from gym_app.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for the Notification model.

    Exposes all user-facing fields.  ``user`` is excluded because
    the API always filters by the authenticated user.
    """

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'category',
            'priority',
            'is_read',
            'is_archived',
            'snoozed_until',
            'link_type',
            'link_id',
            'created_at',
        ]
        read_only_fields = fields
