from django.db.models import Q

from .models import ChatMessage, Conversation


def _other_party(conversation, user):
    if conversation.buyer_id == user.id:
        return conversation.seller, conversation.seller_id
    return conversation.buyer, conversation.buyer_id


def get_grouped_threads(user):
    conversations = (
        Conversation.objects.filter(Q(buyer=user) | Q(seller=user))
        .select_related('order__product', 'buyer', 'seller')
        .prefetch_related('messages')
        .order_by('-updated_at')
    )

    threads = {}
    for conv in conversations:
        other_user, other_user_id = _other_party(conv, user)
        if other_user_id not in threads:
            threads[other_user_id] = {
                'id': f'thread-{other_user_id}',
                'thread_key': str(other_user_id),
                'other_user_id': other_user_id,
                'other_user_name': getattr(other_user, 'username', 'User'),
                'buyer': conv.buyer_id,
                'seller': conv.seller_id,
                'buyer_name': conv.buyer.username,
                'seller_name': conv.seller.username,
                'conversation_ids': [],
                'primary_conversation_id': conv.id,
                'order': conv.order_id,
                'order_name': conv.order.product.title if conv.order and conv.order.product else 'Order',
                'last_message': '',
                'last_activity': conv.updated_at.isoformat() if conv.updated_at else '',
                'unread_count': 0,
            }

        entry = threads[other_user_id]
        entry['conversation_ids'].append(conv.id)

        last = conv.messages.order_by('-timestamp').first()
        last_ts = last.timestamp if last else conv.updated_at
        last_text = last.text if last else ''
        current_ts = entry.get('_last_ts')
        if not current_ts or (last_ts and last_ts > current_ts):
            entry['_last_ts'] = last_ts
            entry['last_message'] = last_text
            entry['last_activity'] = last_ts.isoformat() if last_ts else entry['last_activity']
            entry['primary_conversation_id'] = conv.id
            entry['order'] = conv.order_id
            entry['order_name'] = (
                conv.order.product.title if conv.order and conv.order.product else entry['order_name']
            )

        unread = ChatMessage.objects.filter(
            conversation=conv,
            receiver=user,
            read_status=False,
        ).count()
        entry['unread_count'] += unread

    result = []
    for entry in threads.values():
        entry.pop('_last_ts', None)
        result.append(entry)

    result.sort(key=lambda t: t.get('last_activity') or '', reverse=True)
    return result


def get_thread_messages(user, other_user_id):
    conversations = Conversation.objects.filter(
        Q(buyer=user, seller_id=other_user_id) | Q(seller=user, buyer_id=other_user_id)
    )
    return (
        ChatMessage.objects.filter(conversation__in=conversations)
        .select_related('sender', 'receiver', 'conversation', 'conversation__order__product')
        .order_by('timestamp')
    )


def find_conversation_between(user, other_user_id, order_id=None):
    if order_id:
        order_conv = Conversation.objects.filter(order_id=order_id).first()
        if order_conv and user.id in (order_conv.buyer_id, order_conv.seller_id):
            return order_conv

    return (
        Conversation.objects.filter(
            Q(buyer=user, seller_id=other_user_id) | Q(seller=user, buyer_id=other_user_id)
        )
        .select_related('order', 'buyer', 'seller')
        .order_by('-updated_at')
        .first()
    )
