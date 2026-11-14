from decimal import Decimal

from django.db import transaction

from .models import Cart, CartItem, Item


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def get_or_create_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def add_to_cart(user, product_id: int, quantity: int = 1) -> CartItem:
    product = Item.objects.select_related('seller').get(id=product_id)
    if product.status != 'available' or product.units_available < 1:
        raise ValueError('Item is not available')
    if product.seller_id == user.id:
        raise ValueError('You cannot add your own listing to cart')

    qty = max(1, int(quantity or 1))
    cart = get_or_create_cart(user)

    with transaction.atomic():
        item, created = CartItem.objects.select_for_update().get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': qty},
        )
        if not created:
            new_qty = item.quantity + qty
            if new_qty > product.units_available:
                raise ValueError(f'Only {product.units_available} units available')
            item.quantity = new_qty
            item.save(update_fields=['quantity'])
    return item


def update_cart_item_quantity(user, item_id: int, quantity: int) -> CartItem:
    qty = int(quantity or 1)
    if qty <= 0:
        raise ValueError('Quantity must be at least 1')

    cart = get_or_create_cart(user)
    item = CartItem.objects.select_related('product').get(id=item_id, cart=cart)
    if qty > item.product.units_available:
        raise ValueError(f'Only {item.product.units_available} units available')
    item.quantity = qty
    item.save(update_fields=['quantity'])
    return item


def remove_cart_item(user, item_id: int):
    cart = get_or_create_cart(user)
    CartItem.objects.filter(id=item_id, cart=cart).delete()


def clear_cart(user):
    cart = get_or_create_cart(user)
    CartItem.objects.filter(cart=cart).delete()


def cart_totals(cart: Cart) -> dict:
    subtotal = Decimal('0')
    for item in cart.items.select_related('product').all():
        subtotal += _money(item.product.price) * item.quantity
    return {
        'subtotal': _money(subtotal),
        'item_count': cart.items.count(),
    }
