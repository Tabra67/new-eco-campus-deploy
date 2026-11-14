from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from admin_panel.permissions import IsAdminStaff
from users.models import CustomUser

from .models import ReputationProfile, Review, Dispute
from .serializers import ReputationProfileSerializer, TrustSummarySerializer
from .trust_services import (
    build_dispute_history,
    recalculate_reputation_for_user,
    trust_dashboard_metrics,
    trust_summary_dict,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trust_profile_me(request):
    profile = recalculate_reputation_for_user(request.user)
    data = ReputationProfileSerializer(profile).data
    as_buyer = request.user.role == 'buyer'
    data['dispute_history'] = build_dispute_history(request.user, as_buyer=as_buyer)
    open_statuses = [
        Dispute.STATUS_OPEN,
        Dispute.STATUS_UNDER_REVIEW,
        Dispute.STATUS_ESCALATED,
        Dispute.STATUS_AWAITING_SELLER_RESPONSE,
    ]
    if as_buyer:
        data['open_disputes'] = Dispute.objects.filter(buyer=request.user, status__in=open_statuses).count()
    else:
        data['open_disputes'] = Dispute.objects.filter(seller=request.user, status__in=open_statuses).count()
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trust_profile_user(request, user_id):
    user = get_object_or_404(CustomUser, pk=user_id)
    profile = recalculate_reputation_for_user(user)
    return Response(ReputationProfileSerializer(profile).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_trust(request, user_id):
    user = get_object_or_404(CustomUser, pk=user_id)
    profile = recalculate_reputation_for_user(user)
    data = trust_summary_dict(profile, role='seller')
    reviews = Review.objects.filter(
        seller=user,
        moderation_status=Review.MODERATION_APPROVED,
    ).select_related('buyer', 'order').order_by('-created_at')[:10]
    data['recent_reviews'] = [
        {
            'id': r.id,
            'rating': r.rating,
            'review_text': r.review_text,
            'buyer_username': r.buyer.username if r.buyer else '',
            'created_at': r.created_at.isoformat() if r.created_at else None,
        }
        for r in reviews
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buyer_trust(request, user_id):
    user = get_object_or_404(CustomUser, pk=user_id)
    profile = recalculate_reputation_for_user(user)
    return Response(trust_summary_dict(profile, role='buyer'))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminStaff])
def trust_dashboard(request):
    return Response(trust_dashboard_metrics())


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminStaff])
def flagged_users(request):
    risk = request.query_params.get('risk', 'all')
    qs = ReputationProfile.objects.select_related('user').order_by('-trust_score')
    if risk == 'trusted':
        qs = qs.filter(risk_level='TRUSTED')
    elif risk == 'good':
        qs = qs.filter(risk_level='GOOD')
    elif risk == 'watchlist':
        qs = qs.filter(risk_level='WATCHLIST')
    elif risk == 'high_risk':
        qs = qs.filter(risk_level='HIGH_RISK')
    elif risk == 'repeat':
        qs = qs.filter(repeat_offender=True)

    rows = []
    for p in qs[:200]:
        positive = Review.objects.filter(
            seller=p.user, moderation_status=Review.MODERATION_APPROVED, rating__gte=4
        ).count()
        negative = Review.objects.filter(
            seller=p.user, moderation_status=Review.MODERATION_APPROVED, rating__lte=2
        ).count()
        rows.append({
            'user': p.user.username,
            'user_id': p.user_id,
            'role': p.user.role,
            'trust_score': float(p.trust_score),
            'risk_level': p.risk_level,
            'average_rating': float(p.average_rating or 0),
            'total_reviews': p.total_reviews,
            'review_sentiment_impact': round((positive - negative) * 0.5, 2),
            'disputes_won': p.disputes_won,
            'disputes_lost': p.disputes_lost,
            'disputes': p.disputes_opened,
            'transactions': p.successful_transactions,
            'status': 'FLAGGED' if p.repeat_offender else 'ACTIVE',
            'repeat_offender': p.repeat_offender,
        })
    return Response(rows)
