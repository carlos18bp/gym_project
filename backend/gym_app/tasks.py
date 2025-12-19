import hashlib
import requests
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from celery import shared_task
from django.conf import settings
from gym_app.models import Subscription

logger = logging.getLogger(__name__)


@shared_task
def process_monthly_subscriptions():
    """
    Celery task to process monthly subscription payments.
    
    This task runs daily and processes all active subscriptions that are due for billing.
    It charges the payment source saved in the subscription and updates the subscription status.
    """
    today = datetime.now().date()
    
    # Get all active subscriptions that are due for billing
    due_subscriptions = Subscription.objects.filter(
        status='active',
        next_billing_date__lte=today
    )
    
    logger.info(f"Processing {due_subscriptions.count()} subscriptions due for billing")
    
    for subscription in due_subscriptions:
        try:
            process_subscription_payment(subscription)
        except Exception as e:
            logger.error(f"Error processing subscription {subscription.id}: {str(e)}")
            continue
    
    logger.info("Monthly subscription processing completed")
    return f"Processed {due_subscriptions.count()} subscriptions"


def process_subscription_payment(subscription):
    """
    Process payment for a single subscription.
    
    Args:
        subscription (Subscription): The subscription to process
    """
    # Skip if amount is 0 (free plan)
    if subscription.amount <= 0:
        subscription.next_billing_date = datetime.now().date() + timedelta(days=30)
        subscription.save()
        logger.info(f"Subscription {subscription.id} is free plan, skipping payment")
        return
    
    # Convert amount to cents for Wompi
    amount_in_cents = int(subscription.amount * 100)

    # Generate unique reference for the transaction
    reference = f"SUB-{subscription.id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # Generate integrity signature for backend transaction
    concatenated_string = f"{reference}{amount_in_cents}COP{settings.WOMPI_INTEGRITY_KEY}"
    signature = hashlib.sha256(concatenated_string.encode()).hexdigest()

    # Prepare payment data for Wompi using a saved payment source
    payment_data = {
        "amount_in_cents": amount_in_cents,
        "currency": "COP",
        "signature": signature,
        "customer_email": subscription.user.email,
        "payment_method": {
            "installments": 1
        },
        "reference": reference,
        "payment_source_id": subscription.payment_source_id,
        "recurrent": True,
    }
    
    # Make request to Wompi API
    headers = {
        "Authorization": f"Bearer {settings.WOMPI_PRIVATE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{settings.WOMPI_API_URL}/transactions",
            json=payment_data,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        payment_response = response.json()
        
        payment_status = payment_response.get('data', {}).get('status')
        
        if payment_status == 'APPROVED':
            # Payment successful, update next billing date
            subscription.next_billing_date = datetime.now().date() + timedelta(days=30)
            subscription.save()
            logger.info(f"Subscription {subscription.id} payment successful")
            
        elif payment_status == 'DECLINED':
            # Payment failed, mark subscription as expired
            subscription.status = 'expired'
            subscription.save()
            
            # Update user role to basic
            subscription.user.role = 'basic'
            subscription.user.save()
            
            logger.warning(f"Subscription {subscription.id} payment declined, subscription expired")
            
        else:
            # Payment pending or other status
            logger.info(f"Subscription {subscription.id} payment status: {payment_status}")
            
    except requests.RequestException as e:
        logger.error(f"Error processing payment for subscription {subscription.id}: {str(e)}")
        raise


@shared_task
def cancel_subscription(subscription_id):
    """
    Cancel a subscription and update user role.
    
    Args:
        subscription_id (int): ID of the subscription to cancel
    """
    try:
        subscription = Subscription.objects.get(id=subscription_id)
        subscription.status = 'cancelled'
        subscription.save()
        
        # Update user role to basic
        subscription.user.role = 'basic'
        subscription.user.save()
        
        logger.info(f"Subscription {subscription_id} cancelled successfully")
        return f"Subscription {subscription_id} cancelled"
        
    except Subscription.DoesNotExist:
        logger.error(f"Subscription {subscription_id} not found")
        raise
