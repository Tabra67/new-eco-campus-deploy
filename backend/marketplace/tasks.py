from .models import Dispute, Order
from .dispute_services import auto_resolve_dispute, compute_dispute_ai_recommendation
from .trust_services import recalculate_reputation_for_user


def monitor_open_disputes():
    for dispute in Dispute.objects.filter(status__in=[Dispute.STATUS_OPEN, Dispute.STATUS_UNDER_REVIEW]).select_related('buyer', 'seller', 'order'):
        dispute.ai_recommendation = compute_dispute_ai_recommendation(dispute)
        dispute.confidence_score = dispute.ai_recommendation.get('confidence_score', 0)
        dispute.save(update_fields=['ai_recommendation', 'confidence_score', 'updated_at'])
        auto_resolve_dispute(dispute)


def recalculate_marketplace_trust():
    user_ids = set()
    for order in Order.objects.filter(status=Order.STATUS_COMPLETED).values_list('buyer_id', 'seller_id'):
        user_ids.update(order)
    for user_id in user_ids:
        if user_id:
            recalculate_reputation_for_user_id(user_id)


def recalculate_reputation_for_user_id(user_id):
    from users.models import CustomUser
    user = CustomUser.objects.filter(id=user_id).first()
    if user:
        recalculate_reputation_for_user(user)
