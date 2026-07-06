from rest_framework import serializers
from gym_app.models import TourProgress


class TourProgressSerializer(serializers.ModelSerializer):
    """Serializer for the TourProgress model.

    ``user`` is excluded because the API always filters by the
    authenticated user.  ``status`` collapses the staleness rule into a
    single value the frontend can switch on.
    """

    status = serializers.SerializerMethodField()

    class Meta:
        model = TourProgress
        fields = [
            'id',
            'module_name',
            'status',
            'completed_at',
        ]
        read_only_fields = fields

    def get_status(self, obj):
        return 'stale' if obj.is_stale else 'recent'
