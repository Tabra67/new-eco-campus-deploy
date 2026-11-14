from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone

from .models import (
    Order,
    Payment,
    EscrowTransaction,
    BuyerDiscountUsage,
    Notification,
    Item,
)
from .wallet_services import credit_pending_for_order, release_pending_to_available, refund_pending_for_order, seller_payout_amount

ESCROW_FEE_PERCENT = Decimal('5.00')
FIRST_ORDER_DISCOUNT_PERCENT = Decimal('10.00')


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_order_amounts(order: Order, buyer) -> dict:
    qty = max(1, int(getattr(order, 'quantity', 1) or 1))
    subtotal = Decimal(str(order.price)) * qty
    discount = Decimal('0.00')

    has_completed_order = Order.objects.filter(
        buyer=buyer,
        status=Order.STATUS_COMPLETED,
    ).exists()
    already_used = BuyerDiscountUsage.objects.filter(buyer=buyer).exists()

    if not has_completed_order and not already_used:
        discount = _money(subtotal * (FIRST_ORDER_DISCOUNT_PERCENT / Decimal('100')))

    discounted_subtotal = _money(subtotal - discount)
    escrow_fee = _money(discounted_subtotal * (ESCROW_FEE_PERCENT / Decimal('100')))
    total = _money(discounted_subtotal + escrow_fee)

    return {
        'subtotal': subtotal,
        'discount_amount': discount,
        'escrow_fee': escrow_fee,
        'total_amount': total,
    }


def fund_order_escrow(order: Order, *, phone: str, checkout_request_id: str, receipt_number: str, merchant_request_id: str = ''):
    existing = getattr(order, 'payment_record', None)
    if existing and existing.status == Payment.STATUS_HELD_IN_ESCROW:
        return existing

    amounts = calculate_order_amounts(order, order.buyer)

    payment, _ = Payment.objects.update_or_create(
        order=order,
        defaults={
            'buyer': order.buyer,
            'subtotal': amounts['subtotal'],
            'escrow_fee': amounts['escrow_fee'],
            'discount_amount': amounts['discount_amount'],
            'amount': amounts['total_amount'],
            'status': Payment.STATUS_HELD_IN_ESCROW,
            'phone': phone,
            'mpesa_checkout_request_id': checkout_request_id,
            'mpesa_merchant_request_id': merchant_request_id,
            'mpesa_receipt_number': receipt_number,
        },
    )

    EscrowTransaction.objects.update_or_create(
        order=order,
        defaults={
            'payment': payment,
            'buyer': order.buyer,
            'seller': order.seller,
            'amount_held': amounts['total_amount'],
            'status': EscrowTransaction.STATUS_HELD,
            'payment_status': Payment.STATUS_HELD_IN_ESCROW,
        },
    )

    if amounts['discount_amount'] > 0:
        BuyerDiscountUsage.objects.get_or_create(
            buyer=order.buyer,
            defaults={
                'order': order,
                'discount_percent': FIRST_ORDER_DISCOUNT_PERCENT,
            },
        )

    if order.status in (Order.STATUS_PENDING_PAYMENT, Order.STATUS_PROCESSING, Order.STATUS_CONFIRMED):
        order.status = Order.STATUS_PAID
    elif order.status != Order.STATUS_PAID:
        order.status = Order.STATUS_PAID

    order.payment_reference = receipt_number or checkout_request_id
    order.payment_phone = phone
    order.paid_at = timezone.now()
    order.escrow_status = 'LOCKED'
    order.save()

    credit_pending_for_order(order.seller, seller_payout_amount(order))

    Notification.objects.create(
        user=order.seller,
        order=order,
        title='Escrow funded',
        message=f'Buyer paid for order #{order.id}. You can process and deliver the item.',
    )

    return payment


def release_escrow_for_order(order: Order):
    payment = getattr(order, 'payment_record', None)
    if payment:
        payment.status = Payment.STATUS_RELEASED
        payment.save(update_fields=['status', 'updated_at'])

    escrow = getattr(order, 'escrow_transaction', None)
    if escrow:
        escrow.status = EscrowTransaction.STATUS_RELEASED
        escrow.payment_status = Payment.STATUS_RELEASED
        escrow.released_at = timezone.now()
        escrow.save(update_fields=['status', 'payment_status', 'released_at', 'updated_at'])

    order.escrow_status = 'RELEASED'
    order.completed_at = timezone.now()
    order.save(update_fields=['escrow_status', 'completed_at'])

    release_pending_to_available(order.seller, seller_payout_amount(order))

    Notification.objects.create(
        user=order.seller,
        order=order,
        title='Escrow released',
        message=f'Funds for order #{order.id} were released to your available balance.',
    )


def freeze_escrow_for_order(order: Order):
    payment = getattr(order, 'payment_record', None)
    if payment and payment.status == Payment.STATUS_HELD_IN_ESCROW:
        payment.save(update_fields=['updated_at'])

    escrow = getattr(order, 'escrow_transaction', None)
    if escrow and escrow.status == EscrowTransaction.STATUS_HELD:
        escrow.status = EscrowTransaction.STATUS_FROZEN
        escrow.save(update_fields=['status', 'updated_at'])

    order.escrow_status = 'FROZEN'
    order.save(update_fields=['escrow_status'])


def refund_escrow_for_order(order: Order):
    payment = getattr(order, 'payment_record', None)
    if payment:
        payment.status = Payment.STATUS_REFUNDED
        payment.save(update_fields=['status', 'updated_at'])

    escrow = getattr(order, 'escrow_transaction', None)
    if escrow:
        escrow.status = EscrowTransaction.STATUS_REFUNDED
        escrow.payment_status = Payment.STATUS_REFUNDED
        escrow.save(update_fields=['status', 'payment_status', 'updated_at'])

    order.escrow_status = 'REFUNDED'
    order.save(update_fields=['escrow_status'])

    refund_pending_for_order(order.seller, seller_payout_amount(order))
    _restore_product_stock(order)

    Notification.objects.create(
        user=order.buyer,
        order=order,
        title='Escrow refunded',
        message=f'Funds for order #{order.id} were refunded to your account.',
    )


def _restore_product_stock(order: Order):
    product = order.product
    if not product:
        return
    qty = max(1, int(getattr(order, 'quantity', 1) or 1))
    product.units_available += qty
    if product.status == 'sold' and product.units_available > 0:
        product.status = 'available'
    product.save(update_fields=['units_available', 'status'])


def decrement_product_stock(product: Item, quantity: int = 1):
    qty = max(1, int(quantity or 1))
    if product.units_available < qty:
        raise ValueError('Insufficient stock')
    product.units_available -= qty
    if product.units_available <= 0:
        product.units_available = 0
        product.status = 'sold'
    product.save(update_fields=['units_available', 'status'])
