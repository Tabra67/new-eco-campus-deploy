from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q
from django.utils import timezone

from .models import Dispute, Notification, Order, ReputationProfile, Review, TrustBadge, Withdrawal

RISK_TRUSTED = 'TRUSTED'
RISK_GOOD = 'GOOD'
RISK_WATCHLIST = 'WATCHLIST'
RISK_HIGH_RISK = 'HIGH_RISK'


def _clamp(value: Decimal, low: Decimal = Decimal('0'), high: Decimal = Decimal('100')) -> Decimal:
    return max(low, min(high, value))


def _risk_level_from_score(trust_score: Decimal) -> str:
    if trust_score >= 90:
        return RISK_TRUSTED
    if trust_score >= 70:
        return RISK_GOOD
    if trust_score >= 50:
        return RISK_WATCHLIST
    return RISK_HIGH_RISK


def _primary_badge(profile: ReputationProfile, badges: list) -> str:
    if badges:
        return badges[0]
    if profile.user.role == 'seller' and profile.trust_score >= 90:
        return 'Verified Seller'
    if profile.user.role == 'buyer' and profile.trust_score >= 90:
        return 'Trusted Buyer'
    return ''


def _dispute_outcome(dispute, as_buyer):
    if dispute.refund_percentage and 0 < float(dispute.refund_percentage) < 100:
        return 'Split Between Buyer and Seller'
    if dispute.status == Dispute.STATUS_REFUNDED:
        return 'Refunded to Buyer'
    if dispute.status == Dispute.STATUS_RELEASED:
        return 'Released to Seller'
    if dispute.status == Dispute.STATUS_REJECTED:
        return 'Dispute Rejected'
    if dispute.status in (Dispute.STATUS_RESOLVED, Dispute.STATUS_CLOSED, Dispute.STATUS_AUTO_RESOLVED):
        return dispute.resolution or dispute.resolution_note or 'Resolved'
    if dispute.status == Dispute.STATUS_ESCALATED:
        return 'Escalated'
    if dispute.status == Dispute.STATUS_UNDER_REVIEW:
        return 'Under review'
    if dispute.status == Dispute.STATUS_AWAITING_SELLER_RESPONSE:
        return 'Awaiting seller response'
    return 'Open'


def build_dispute_history(user, as_buyer=None):
    if as_buyer is None:
        as_buyer = user.role == 'buyer'
    qs = Dispute.objects.filter(buyer=user) if as_buyer else Dispute.objects.filter(seller=user)
    qs = qs.select_related('order').order_by('-created_at')
    rows = []
    for dispute in qs:
        rows.append({
            'dispute_id': dispute.id,
            'order_id': dispute.order_id,
            'reason': dispute.reason,
            'status': dispute.status,
            'date_opened': dispute.created_at.isoformat() if dispute.created_at else None,
            'outcome': _dispute_outcome(dispute, as_buyer),
            'resolution': dispute.resolution or dispute.resolution_note or '',
        })
    return rows


def trust_summary_dict(profile: ReputationProfile, role=None) -> dict:
    badges = list(
        TrustBadge.objects.filter(user=profile.user).order_by('-awarded_at').values_list('name', flat=True)[:5]
    )
    user = profile.user
    role = role or user.role
    data = {
        'user_id': profile.user_id,
        'username': profile.user.username,
        'trust_score': float(profile.trust_score),
        'risk_level': profile.risk_level,
        'trust_badge': profile.trust_badge or _primary_badge(profile, badges),
        'badges': badges,
        'completed_orders': profile.completed_orders,
        'completed_sales': profile.completed_sales,
        'dispute_rate': float(profile.dispute_rate),
        'repeat_offender': profile.repeat_offender,
        'member_since': user.date_joined.isoformat() if user.date_joined else None,
    }
    if role == 'seller':
        data.update({
            'total_reviews': profile.total_reviews,
            'average_rating': float(profile.average_rating or 0),
            'response_rate': float(profile.response_rate or 0),
        })
    else:
        data.update({
            'successful_transactions': profile.successful_transactions,
            'disputes_opened': profile.disputes_opened,
            'disputes_won': profile.disputes_won,
            'disputes_lost': profile.disputes_lost,
        })
    return data


def _maybe_notify_trust_change(user, old_score, new_score, old_risk, new_risk, repeat_offender):
    if abs(float(new_score) - float(old_score)) >= 10:
        Notification.objects.create(
            user=user,
            title='Trust score updated',
            message=f'Your trust score changed from {old_score} to {new_score}.',
        )
    if old_risk != RISK_WATCHLIST and new_risk == RISK_WATCHLIST:
        Notification.objects.create(
            user=user,
            title='Account on watchlist',
            message='Your account has been placed on the trust watchlist due to recent activity.',
        )
    if old_risk != RISK_TRUSTED and new_risk == RISK_TRUSTED:
        Notification.objects.create(
            user=user,
            title='Trusted member',
            message='Congratulations! You have reached trusted status on Eco-Campus.',
        )
    if repeat_offender:
        Notification.objects.create(
            user=user,
            title='Repeat offender warning',
            message='Your account has been flagged for repeated disputes. Please review platform policies.',
        )


def recalculate_reputation_for_user(user):
    profile, _ = ReputationProfile.objects.get_or_create(user=user)
    old_score = profile.trust_score
    old_risk = profile.risk_level

    account_days = max((timezone.now() - user.date_joined).days, 1)
    completed_buyer = Order.objects.filter(buyer=user, status=Order.STATUS_COMPLETED).count()
    completed_seller = Order.objects.filter(seller=user, status=Order.STATUS_COMPLETED).count()
    completed_count = completed_buyer + completed_seller if user.role == 'buyer' else max(completed_buyer, completed_seller)
    if user.role == 'seller':
        completed_count = completed_seller
    else:
        completed_count = max(completed_buyer, completed_seller)

    thirty_days_ago = timezone.now() - timedelta(days=30)
    disputed_count = Dispute.objects.filter(Q(buyer=user) | Q(seller=user)).count()
    disputes_30d = Dispute.objects.filter(
        Q(buyer=user) | Q(seller=user),
        created_at__gte=thirty_days_ago,
    ).count()
    disputes_opened = Dispute.objects.filter(buyer=user).count() if user.role == 'buyer' else Dispute.objects.filter(seller=user).count()
    disputes_won = Dispute.objects.filter(
        seller=user,
        status__in=[Dispute.STATUS_RELEASED, Dispute.STATUS_REJECTED],
    ).count()
    disputes_lost = Dispute.objects.filter(
        seller=user,
        status=Dispute.STATUS_REFUNDED,
    ).count()
    if user.role == 'buyer':
        disputes_won = Dispute.objects.filter(buyer=user, status=Dispute.STATUS_REFUNDED).count()
        disputes_lost = Dispute.objects.filter(buyer=user, status=Dispute.STATUS_REJECTED).count()

    refunded_count = Dispute.objects.filter(order__buyer=user, status=Dispute.STATUS_REFUNDED).count()
    cancelled_count = Order.objects.filter(Q(buyer=user) | Q(seller=user), status=Order.STATUS_CANCELLED).count()
    review_avg = Review.objects.filter(seller=user, moderation_status=Review.MODERATION_APPROVED).aggregate(avg=Avg('rating')).get('avg') or 0
    review_count = Review.objects.filter(seller=user, moderation_status=Review.MODERATION_APPROVED).count()
    successful_withdrawals = Withdrawal.objects.filter(seller=user, status=Withdrawal.STATUS_COMPLETED).count()
    repeat_customers = Order.objects.filter(seller=user, status=Order.STATUS_COMPLETED).values('buyer').annotate(c=Count('buyer')).filter(c__gt=1).count()

    base_completed = max(completed_count, 1)
    dispute_rate = Decimal(disputed_count * 100 / base_completed)
    refund_rate = Decimal(refunded_count * 100 / base_completed)
    cancellation_rate = Decimal(cancelled_count * 100 / base_completed)
    account_age_score = Decimal(min(account_days / 365 * 20, 20))
    repeat_customer_score = Decimal(min(repeat_customers * 2, 20))

    trust_base = Decimal('40')
    trust_score = (
        trust_base
        + Decimal(review_avg) * Decimal('8')
        + Decimal(min(completed_count, 100)) * Decimal('0.2')
        + account_age_score
        + repeat_customer_score
        + Decimal(min(successful_withdrawals, 50)) * Decimal('0.1')
        - dispute_rate * Decimal('0.3')
        - refund_rate * Decimal('0.25')
        - cancellation_rate * Decimal('0.15')
        - profile.fraud_score * Decimal('0.4')
    )
    trust_score = _clamp(trust_score)
    risk = _risk_level_from_score(trust_score)

    repeat_offender = disputes_30d > 5

    profile.trust_score = trust_score
    profile.average_rating = Decimal(review_avg).quantize(Decimal('0.01')) if review_avg else Decimal('0')
    profile.total_reviews = review_count
    profile.successful_transactions = completed_count
    profile.completed_orders = completed_buyer
    profile.completed_sales = completed_seller
    profile.disputes_opened = disputes_opened
    profile.disputes_won = disputes_won
    profile.disputes_lost = disputes_lost
    profile.cancelled_orders = cancelled_count
    profile.dispute_rate = dispute_rate.quantize(Decimal('0.01'))
    profile.refund_rate = refund_rate.quantize(Decimal('0.01'))
    profile.cancellation_rate = cancellation_rate.quantize(Decimal('0.01'))
    profile.response_rate = Decimal('100') if completed_count else Decimal('0')
    profile.account_age_score = account_age_score.quantize(Decimal('0.01'))
    profile.repeat_customer_score = repeat_customer_score.quantize(Decimal('0.01'))
    profile.verified_email = bool(user.email)
    profile.verified_phone = bool(getattr(user, 'phone', ''))
    profile.risk_level = risk
    profile.repeat_offender = repeat_offender
    profile.last_calculated = timezone.now()
    profile.updated_at = timezone.now()
    profile.save()
    assign_badges(profile)
    profile.trust_badge = _primary_badge(
        profile,
        list(TrustBadge.objects.filter(user=user).values_list('name', flat=True)[:1]),
    )
    profile.save(update_fields=['trust_badge'])

    _maybe_notify_trust_change(user, old_score, trust_score, old_risk, risk, repeat_offender)
    return profile


def assign_badges(profile: ReputationProfile):
    user = profile.user
    badge_names = []
    if user.role == 'seller' and profile.trust_score >= 90:
        badge_names.append(('Verified Seller', 'High trust seller'))
        badge_names.append(('Trusted Merchant', 'Consistently reliable merchant'))
    if user.role == 'buyer' and profile.trust_score >= 90:
        badge_names.append(('Trusted Buyer', 'Reliable buyer profile'))
    if user.role == 'seller' and profile.average_rating >= 4.5:
        badge_names.append(('Top Seller', 'Excellent ratings'))
    if user.role == 'seller' and profile.dispute_rate <= 5:
        badge_names.append(('Low Dispute Seller', 'Low dispute activity'))
    if profile.response_rate >= 90:
        badge_names.append(('Fast Responder', 'Quick responses'))
    if profile.completed_orders >= 5 and user.role == 'buyer':
        badge_names.append(('Reliable Buyer', 'Multiple successful purchases'))
    if getattr(user, 'is_verified', False) or profile.verified_identity:
        badge_names.append(('Verified Student', 'Identity verified'))

    for name, desc in badge_names:
        TrustBadge.objects.get_or_create(user=user, name=name, defaults={'description': desc})


def trust_dashboard_metrics():
    profiles = ReputationProfile.objects.all()
    approved_reviews = Review.objects.filter(moderation_status=Review.MODERATION_APPROVED)
    avg_rating = approved_reviews.aggregate(avg=Avg('rating')).get('avg') or 0
    total_reviews = approved_reviews.count()
    positive_reviews = approved_reviews.filter(rating__gte=4).count()
    negative_reviews = approved_reviews.filter(rating__lte=2).count()
    review_sentiment_impact = round((positive_reviews - negative_reviews) * 0.5, 2)
    return {
        'total_trusted_users': profiles.filter(risk_level=RISK_TRUSTED).count(),
        'watchlist_users': profiles.filter(risk_level=RISK_WATCHLIST).count(),
        'high_risk_users': profiles.filter(risk_level=RISK_HIGH_RISK).count(),
        'good_users': profiles.filter(risk_level=RISK_GOOD).count(),
        'average_rating': round(float(avg_rating), 2),
        'total_reviews': total_reviews,
        'review_sentiment_impact': review_sentiment_impact,
        'positive_reviews': positive_reviews,
        'negative_reviews': negative_reviews,
        'trust_distribution': {
            RISK_TRUSTED: profiles.filter(risk_level=RISK_TRUSTED).count(),
            RISK_GOOD: profiles.filter(risk_level=RISK_GOOD).count(),
            RISK_WATCHLIST: profiles.filter(risk_level=RISK_WATCHLIST).count(),
            RISK_HIGH_RISK: profiles.filter(risk_level=RISK_HIGH_RISK).count(),
        },
        'disputes_by_risk': {
            RISK_TRUSTED: Dispute.objects.filter(seller__reputation_profile__risk_level=RISK_TRUSTED).count(),
            RISK_GOOD: Dispute.objects.filter(seller__reputation_profile__risk_level=RISK_GOOD).count(),
            RISK_WATCHLIST: Dispute.objects.filter(seller__reputation_profile__risk_level=RISK_WATCHLIST).count(),
            RISK_HIGH_RISK: Dispute.objects.filter(seller__reputation_profile__risk_level=RISK_HIGH_RISK).count(),
        },
    }
