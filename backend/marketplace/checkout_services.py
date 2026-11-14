from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import CheckoutSession, Order, Conversation, Notification
from .escrow_services import calculate_order_amounts, fund_order_escrow, decrement_product_stock


def _line_total(session: CheckoutSession) -> Decimal:
    return Decimal(str(session.unit_price)) * max(1, session.quantity)


def create_checkout_session(*, buyer, product, quantity: int, phone: str = '') -> CheckoutSession:
    qty = max(1, int(quantity or 1))
    if product.status != 'available' or product.units_available < qty:
        raise ValueError('Item is out of stock')
    if product.seller_id == buyer.id:
        raise ValueError('You cannot purchase your own listing')
    return CheckoutSession.objects.create(
        buyer=buyer,
        product=product,
        quantity=qty,
        unit_price=product.price,
        phone=phone or '',
        status=CheckoutSession.STATUS_PENDING,
    )


def amounts_for_checkout_session(session: CheckoutSession) -> dict:
    """Reuse order amount logic via a lightweight in-memory order."""
    temp = Order(
        buyer=session.buyer,
        seller=session.product.seller,
        product=session.product,
        price=session.unit_price,
        quantity=session.quantity,
    )
    return calculate_order_amounts(temp, session.buyer)


@transaction.atomic
def complete_checkout_session(session: CheckoutSession, *, phone: str, checkout_request_id: str, receipt_number: str, merchant_request_id: str = ''):
    if session.status == CheckoutSession.STATUS_COMPLETED and session.order_id:
        return session.order

    product = session.product
    decrement_product_stock(product, session.quantity)

    order = Order.objects.create(
        buyer=session.buyer,
        seller=product.seller,
        product=product,
        price=session.unit_price,
        quantity=session.quantity,
        status=Order.STATUS_PENDING_PAYMENT,
    )

    Conversation.objects.get_or_create(
        order=order,
        defaults={'buyer': order.buyer, 'seller': order.seller},
    )

    fund_order_escrow(
        order,
        phone=phone,
        checkout_request_id=checkout_request_id,
        receipt_number=receipt_number,
        merchant_request_id=merchant_request_id,
    )

    session.order = order
    session.status = CheckoutSession.STATUS_COMPLETED
    session.save(update_fields=['order', 'status', 'updated_at'])

    Notification.objects.create(
        user=order.seller,
        order=order,
        title='New paid order',
        message=f'{order.buyer.username} paid for {product.title}. Process and ship the order.',
    )

    return order
