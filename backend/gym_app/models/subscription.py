from django.db import models
from .user import User


class PaymentHistory(models.Model):
    """
    Payment history model to track all subscription payments.
    
    Attributes:
        subscription (ForeignKey): The subscription this payment belongs to.
        amount (DecimalField): The payment amount in COP.
        status (CharField): Payment status (approved, declined, pending, error).
        transaction_id (CharField): Wompi transaction ID.
        reference (CharField): Payment reference.
        payment_date (DateTimeField): When the payment was processed.
        error_message (TextField): Error message if payment failed.
    """
    
    STATUS_CHOICES = [
        ('approved', 'Approved'),
        ('declined', 'Declined'),
        ('pending', 'Pending'),
        ('error', 'Error'),
    ]
    
    subscription = models.ForeignKey(
        'Subscription',
        on_delete=models.CASCADE,
        related_name='payments',
        help_text="The subscription this payment belongs to."
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="The payment amount in COP."
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        help_text="Payment status."
    )
    
    transaction_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Wompi transaction ID."
    )
    
    reference = models.CharField(
        max_length=255,
        help_text="Payment reference."
    )
    
    payment_date = models.DateTimeField(
        auto_now_add=True,
        help_text="When the payment was processed."
    )
    
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Error message if payment failed."
    )
    
    class Meta:
        ordering = ['-payment_date']
        verbose_name = 'Payment History'
        verbose_name_plural = 'Payment Histories'
    
    def __str__(self):
        """String representation of the payment."""
        return f"Payment {self.id} - {self.subscription.user.email} - {self.status}"


class Subscription(models.Model):
    """
    Subscription model to manage user subscriptions with Wompi payment integration.
    
    Attributes:
        user (ForeignKey): The user who owns this subscription.
        plan_type (CharField): The type of subscription plan (basico, cliente, corporativo).
        payment_source_id (CharField): Wompi payment source token for recurring payments.
        status (CharField): Current status of the subscription (active, cancelled, expired).
        next_billing_date (DateField): The date when the next billing will occur.
        amount (DecimalField): The subscription amount in COP.
        created_at (DateTimeField): When the subscription was created.
        updated_at (DateTimeField): When the subscription was last updated.
    """
    
    PLAN_TYPE_CHOICES = [
        ('basico', 'Básico'),
        ('cliente', 'Cliente'),
        ('corporativo', 'Corporativo'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='subscriptions',
        help_text="The user who owns this subscription."
    )
    
    plan_type = models.CharField(
        max_length=20, 
        choices=PLAN_TYPE_CHOICES,
        help_text="The type of subscription plan."
    )
    
    payment_source_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Wompi payment source token for recurring payments."
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        help_text="Current status of the subscription."
    )
    
    next_billing_date = models.DateField(
        help_text="The date when the next billing will occur."
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="The subscription amount in COP."
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the subscription was created."
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="When the subscription was last updated."
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Subscription'
        verbose_name_plural = 'Subscriptions'
    
    def __str__(self):
        """String representation of the subscription."""
        return f"{self.user.email} - {self.get_plan_type_display()} ({self.status})"
