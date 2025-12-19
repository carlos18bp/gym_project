from rest_framework import serializers
from gym_app.models import Subscription, PaymentHistory


class PaymentHistorySerializer(serializers.ModelSerializer):
    """Serializer for PaymentHistory model."""
    
    class Meta:
        model = PaymentHistory
        fields = [
            'id',
            'amount',
            'status',
            'transaction_id',
            'reference',
            'payment_date',
            'error_message'
        ]
        read_only_fields = ['id', 'payment_date']


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for Subscription model."""
    
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Subscription
        fields = [
            'id',
            'user_email',
            'user_name',
            'plan_type',
            'payment_source_id',
            'status',
            'next_billing_date',
            'amount',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_email', 'user_name']
    
    def get_user_name(self, obj):
        """Get user's full name."""
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.email
