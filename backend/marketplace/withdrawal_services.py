import logging
import random
import re
import threading
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import SellerWallet, Withdrawal

logger = logging.getLogger('marketplace.withdrawal')

KENYAN_PHONE_RE = re.compile(r'^(\+254|254|0)?[17]\d{8}$')


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def get_withdrawal_limit() -> Decimal:
    return _money(getattr(settings, 'MAX_WITHDRAWAL_AMOUNT', 50000))


def validate_mpesa_phone(phone: str) -> tuple[bool, str]:
    normalized = (phone or '').strip().replace(' ', '')
    if not normalized:
        return False, 'M-Pesa phone number is required.'
    if not KENYAN_PHONE_RE.match(normalized):
        return False, 'Enter a valid M-Pesa phone number (e.g. 0712345678).'
    return True, normalized


def validate_withdrawal_request(*, seller, amount, payout_method: str, phone_number: str = '') -> tuple[bool, str]:
    amount = _money(amount)
    if amount <= 0:
        return False, 'Amount must be greater than zero.'

    limit = get_withdrawal_limit()
    if amount > limit:
        return False, f'Amount exceeds configured withdrawal limit of KES {limit}.'

    wallet = SellerWallet.objects.filter(seller=seller).first()
    available = _money(wallet.available_balance if wallet else 0)
    if amount > available:
        return False, 'Insufficient balance.'

    if payout_method == 'MPESA':
        ok, msg = validate_mpesa_phone(phone_number)
        if not ok:
            return False, msg

    return True, ''


def generate_ecm_b2c_reference() -> str:
    return f"ECM-B2C-{uuid.uuid4().hex[:8].upper()}"


def _finalize_mock_b2c_success(withdrawal_id: int):
    try:
        with transaction.atomic():
            withdrawal = Withdrawal.objects.select_for_update().get(pk=withdrawal_id)
            if withdrawal.status not in (Withdrawal.STATUS_PENDING, Withdrawal.STATUS_PROCESSING):
                return

            withdrawal.status = Withdrawal.STATUS_COMPLETED
            withdrawal.reference_id = generate_ecm_b2c_reference()
            withdrawal.mpesa_receipt = withdrawal.reference_id
            withdrawal.response_description = 'Mock B2C payout successful'
            withdrawal.result_description = 'Success'
            withdrawal.completed_at = timezone.now()
            withdrawal.save(update_fields=[
                'status', 'reference_id', 'mpesa_receipt', 'response_description',
                'result_description', 'completed_at',
            ])

            wallet = SellerWallet.objects.select_for_update().get(seller=withdrawal.seller)
            wallet.pending_withdrawals = _money(
                max(Decimal('0'), wallet.pending_withdrawals - withdrawal.amount)
            )
            wallet.save(update_fields=['pending_withdrawals', 'updated_at'])

        from .models import Notification
        Notification.objects.create(
            user=withdrawal.seller,
            title='Withdrawal successful',
            message=f'Your withdrawal of KES {withdrawal.amount} was completed. Reference: {withdrawal.reference_id}.',
        )
    except Withdrawal.DoesNotExist:
        logger.warning('Mock B2C completion skipped; withdrawal %s not found', withdrawal_id)
    except Exception:
        logger.exception('Mock B2C completion failed for withdrawal %s', withdrawal_id)


def schedule_mock_b2c_completion(withdrawal_id: int):
    delay = random.uniform(3.0, 5.0)
    timer = threading.Timer(delay, _finalize_mock_b2c_success, args=(withdrawal_id,))
    timer.daemon = True
    timer.start()


def initiate_mock_b2c_withdrawal(withdrawal: Withdrawal) -> Withdrawal:
    """Move withdrawal to processing and schedule simulated B2C payout."""
    withdrawal.status = Withdrawal.STATUS_PROCESSING
    withdrawal.response_description = 'Processing withdrawal...'
    withdrawal.save(update_fields=['status', 'response_description'])
    schedule_mock_b2c_completion(withdrawal.id)
    return withdrawal


def fail_withdrawal(withdrawal: Withdrawal, reason: str) -> Withdrawal:
    """Mark withdrawal failed and restore seller balance."""
    with transaction.atomic():
        withdrawal = Withdrawal.objects.select_for_update().get(pk=withdrawal.pk)
        if withdrawal.status in (Withdrawal.STATUS_COMPLETED, Withdrawal.STATUS_FAILED):
            return withdrawal

        wallet = SellerWallet.objects.select_for_update().get(seller=withdrawal.seller)
        wallet.available_balance = _money(wallet.available_balance + withdrawal.amount)
        wallet.pending_withdrawals = _money(
            max(Decimal('0'), wallet.pending_withdrawals - withdrawal.amount)
        )
        wallet.total_withdrawn = _money(max(Decimal('0'), wallet.total_withdrawn - withdrawal.amount))
        wallet.withdrawn_total = wallet.total_withdrawn
        wallet.save(update_fields=[
            'available_balance', 'pending_withdrawals', 'total_withdrawn',
            'withdrawn_total', 'updated_at',
        ])

        withdrawal.status = Withdrawal.STATUS_FAILED
        withdrawal.failed_reason = reason
        withdrawal.response_description = reason
        withdrawal.save(update_fields=['status', 'failed_reason', 'response_description'])

    return withdrawal
