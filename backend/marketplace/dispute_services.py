from decimal import Decimal

from django.utils import timezone

from .escrow_services import refund_escrow_for_order, release_escrow_for_order
from .models import Dispute


def compute_dispute_ai_recommendation(dispute: Dispute) -> dict:
    score = Decimal('0')
    explanation = []
    if not dispute.order.delivered_at:
        score += Decimal('20')
        explanation.append('No delivery timestamp recorded.')
    if not dispute.order.dispute_evidence_image and not dispute.evidence.exists():
        score += Decimal('25')
        explanation.append('No seller evidence uploaded.')
    if (timezone.now() - dispute.created_at).total_seconds() > 48 * 3600:
        score += Decimal('10')
        explanation.append('Dispute has exceeded 48 hours.')
    score += dispute.fraud_score
    suggested_winner = 'buyer' if score >= 40 else 'seller'
    refund_pct = Decimal('100') if suggested_winner == 'buyer' else Decimal('0')
    confidence = min(Decimal('95'), Decimal('50') + score / Decimal('2'))
    return {
        'suggested_winner': suggested_winner,
        'refund_percentage': float(refund_pct),
        'confidence_score': float(confidence),
        'explanation': explanation or ['Insufficient strong signals, defaulting to seller.'],
    }


def auto_resolve_dispute(dispute: Dispute) -> bool:
    order = dispute.order
    age_hours = (timezone.now() - dispute.created_at).total_seconds() / 3600
    # Level 1 rules
    if age_hours > 48 and not order.dispute_evidence_image and not dispute.evidence.exists():
        refund_escrow_for_order(order)
        dispute.status = Dispute.STATUS_REFUNDED
        dispute.auto_resolved = True
        dispute.resolution = 'Auto refund: no evidence and timeout reached.'
        dispute.refund_percentage = Decimal('100')
        dispute.resolved_at = timezone.now()
        dispute.save(update_fields=['status', 'auto_resolved', 'resolution', 'refund_percentage', 'resolved_at', 'updated_at'])
        return True
    if age_hours > 48 and order.delivered_at:
        release_escrow_for_order(order)
        dispute.status = Dispute.STATUS_RELEASED
        dispute.auto_resolved = True
        dispute.resolution = 'Auto release: buyer inactive with delivered order.'
        dispute.refund_percentage = Decimal('0')
        dispute.resolved_at = timezone.now()
        dispute.save(update_fields=['status', 'auto_resolved', 'resolution', 'refund_percentage', 'resolved_at', 'updated_at'])
        return True
    return False
