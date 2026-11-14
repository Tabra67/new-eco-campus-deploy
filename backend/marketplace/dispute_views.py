from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Dispute, DisputeEvidence, DisputeMessage, Notification, Order
from .serializers import DisputeDetailSerializer, DisputeEvidenceSerializer, DisputeMessageSerializer


def _dispute_queryset():
    return Dispute.objects.select_related(
        'order', 'order__product', 'order__buyer', 'order__seller', 'buyer', 'seller'
    ).prefetch_related('evidence', 'messages__sender')


def _user_can_access_dispute(user, dispute):
    if user.role in ('admin', 'super_admin') or user.is_staff:
        return True
    return user.id in (dispute.buyer_id, dispute.seller_id)


def _ensure_response_deadline(dispute):
    if dispute.response_deadline:
        return
    dispute.response_deadline = timezone.now() + timedelta(hours=48)
    dispute.save(update_fields=['response_deadline', 'updated_at'])


def _check_deadline_escalation(dispute):
    if not dispute.response_deadline:
        return
    if dispute.status not in (
        Dispute.STATUS_AWAITING_SELLER_RESPONSE,
        Dispute.STATUS_OPEN,
    ):
        return
    if timezone.now() > dispute.response_deadline:
        dispute.status = Dispute.STATUS_ESCALATED
        dispute.escalated_to_admin = True
        dispute.save(update_fields=['status', 'escalated_to_admin', 'updated_at'])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buyer_dispute_list(request):
    disputes = _dispute_queryset().filter(buyer=request.user)
    for d in disputes:
        _check_deadline_escalation(d)
    return Response(DisputeDetailSerializer(disputes, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_dispute_list(request):
    disputes = _dispute_queryset().filter(seller=request.user)
    for d in disputes:
        _check_deadline_escalation(d)
    return Response(DisputeDetailSerializer(disputes, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dispute_detail(request, dispute_id):
    dispute = get_object_or_404(_dispute_queryset(), id=dispute_id)
    if not _user_can_access_dispute(request.user, dispute):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    _check_deadline_escalation(dispute)
    return Response(DisputeDetailSerializer(dispute, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dispute_respond(request, dispute_id):
    dispute = get_object_or_404(_dispute_queryset(), id=dispute_id)
    if dispute.seller_id != request.user.id:
        return Response({'error': 'Only the seller can respond.'}, status=status.HTTP_403_FORBIDDEN)

    message = (request.data.get('message') or request.data.get('response') or '').strip()
    if not message:
        return Response({'error': 'Response message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    dispute.seller_response = message
    dispute.seller_responded_at = timezone.now()
    if dispute.status in (Dispute.STATUS_OPEN, Dispute.STATUS_AWAITING_SELLER_RESPONSE):
        dispute.status = Dispute.STATUS_UNDER_REVIEW
    dispute.save()

    msg = DisputeMessage.objects.create(dispute=dispute, sender=request.user, message=message)
    if request.FILES.get('attachment'):
        msg.attachment = request.FILES.get('attachment')
        msg.save(update_fields=['attachment'])

    if dispute.buyer_id:
        Notification.objects.create(
            user=dispute.buyer,
            order=dispute.order,
            title='Seller responded to dispute',
            message=f'The seller responded to dispute #{dispute.id} for order #{dispute.order_id}.',
        )

    return Response(DisputeDetailSerializer(dispute, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dispute_message(request, dispute_id):
    dispute = get_object_or_404(_dispute_queryset(), id=dispute_id)
    if not _user_can_access_dispute(request.user, dispute):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    message = (request.data.get('message') or '').strip()
    if not message and not request.FILES.get('attachment'):
        return Response({'error': 'Message or attachment required.'}, status=status.HTTP_400_BAD_REQUEST)

    msg = DisputeMessage.objects.create(
        dispute=dispute,
        sender=request.user,
        message=message or '(attachment)',
        attachment=request.FILES.get('attachment'),
    )

    recipient = dispute.buyer if request.user.id == dispute.seller_id else dispute.seller
    if recipient:
        Notification.objects.create(
            user=recipient,
            order=dispute.order,
            title='New dispute message',
            message=f'New message on dispute #{dispute.id} for order #{dispute.order_id}.',
        )

    return Response(DisputeMessageSerializer(msg, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dispute_evidence_upload(request, dispute_id):
    dispute = get_object_or_404(_dispute_queryset(), id=dispute_id)
    if not _user_can_access_dispute(request.user, dispute):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'application/pdf'}
    upload = request.FILES.get('file')
    if upload and upload.content_type and upload.content_type not in allowed_types:
        if not str(upload.name).lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.pdf')):
            return Response({'error': 'Invalid file type.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = DisputeEvidenceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(dispute=dispute, uploaded_by=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def setup_dispute_on_open(dispute, order):
    """Called when buyer opens a dispute."""
    dispute.buyer = order.buyer
    dispute.seller = order.seller
    dispute.reason = dispute.reason or order.dispute_reason or dispute.title
    dispute.description = dispute.description or order.dispute_description or ''
    dispute.detailed_description = dispute.detailed_description or dispute.description
    dispute.status = Dispute.STATUS_AWAITING_SELLER_RESPONSE
    dispute.priority = dispute.priority or Dispute.PRIORITY_MEDIUM
    dispute.priority_level = dispute.priority
    dispute.response_deadline = timezone.now() + timedelta(hours=48)
    dispute.save()

    if dispute.seller_id:
        Notification.objects.create(
            user=dispute.seller,
            order=order,
            title='Dispute opened',
            message=f'A buyer opened a dispute for order #{order.id}. Respond within 48 hours.',
        )
