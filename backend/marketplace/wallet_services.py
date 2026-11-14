from decimal import Decimal

from django.db import transaction
from django.db.models import F

from .models import SellerWallet, Withdrawal


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def get_or_create_wallet(seller) -> SellerWallet:
    wallet, _ = SellerWallet.objects.get_or_create(seller=seller)
    dirty = False
    if wallet.held_balance != wallet.pending_balance:
        wallet.held_balance = wallet.pending_balance
        dirty = True
    if wallet.withdrawn_total != wallet.total_withdrawn:
        wallet.withdrawn_total = wallet.total_withdrawn
        dirty = True
    if dirty:
        wallet.save(update_fields=['held_balance', 'withdrawn_total', 'updated_at'])
    return wallet


def credit_pending_for_order(seller, amount) -> SellerWallet:
    """When buyer pays, seller subtotal (after platform fees) goes to pending."""
    amount = _money(amount)
    if amount <= 0:
        return get_or_create_wallet(seller)
    wallet = get_or_create_wallet(seller)
    SellerWallet.objects.filter(pk=wallet.pk).update(
        pending_balance=F('pending_balance') + amount,
        held_balance=F('held_balance') + amount,
        total_earnings=F('total_earnings') + amount,
    )
    wallet.refresh_from_db()
    return wallet


def release_pending_to_available(seller, amount) -> SellerWallet:
    """When buyer confirms delivery, move funds from pending to available."""
    amount = _money(amount)
    wallet = get_or_create_wallet(seller)
    if amount <= 0:
        return wallet
    with transaction.atomic():
        wallet = SellerWallet.objects.select_for_update().get(pk=wallet.pk)
        release = min(amount, wallet.pending_balance)
        wallet.pending_balance = _money(wallet.pending_balance - release)
        wallet.held_balance = wallet.pending_balance
        wallet.available_balance = _money(wallet.available_balance + release)
        wallet.save(update_fields=['pending_balance', 'held_balance', 'available_balance', 'updated_at'])
    return wallet


def deduct_available_for_withdrawal(seller, amount) -> SellerWallet:
    amount = _money(amount)
    with transaction.atomic():
        wallet = SellerWallet.objects.select_for_update().get(
            seller=seller,
        )
        if amount > wallet.available_balance:
            raise ValueError('Amount exceeds available balance.')
        if amount <= 0:
            raise ValueError('Amount must be greater than zero.')
        wallet.available_balance = _money(wallet.available_balance - amount)
        wallet.total_withdrawn = _money(wallet.total_withdrawn + amount)
        wallet.withdrawn_total = wallet.total_withdrawn
        wallet.pending_withdrawals = _money(wallet.pending_withdrawals + amount)
        wallet.save(update_fields=['available_balance', 'total_withdrawn', 'withdrawn_total', 'pending_withdrawals', 'updated_at'])
    return wallet


def refund_pending_for_order(seller, amount) -> SellerWallet:
    """On escrow refund, reverse pending balance."""
    amount = _money(amount)
    wallet = get_or_create_wallet(seller)
    with transaction.atomic():
        wallet = SellerWallet.objects.select_for_update().get(pk=wallet.pk)
        deduct = min(amount, wallet.pending_balance)
        wallet.pending_balance = _money(wallet.pending_balance - deduct)
        wallet.held_balance = wallet.pending_balance
        wallet.total_earnings = _money(max(Decimal('0'), wallet.total_earnings - deduct))
        wallet.save(update_fields=['pending_balance', 'held_balance', 'total_earnings', 'updated_at'])
    return wallet


def seller_payout_amount(order) -> Decimal:
    """Amount credited to seller pending balance (subtotal after buyer discount, before escrow fee)."""
    from .escrow_services import calculate_order_amounts
    amounts = calculate_order_amounts(order, order.buyer)
    return _money(amounts['subtotal'] - amounts['discount_amount'])
