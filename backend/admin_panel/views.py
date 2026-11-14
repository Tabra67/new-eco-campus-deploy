from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from marketplace.escrow_services import refund_escrow_for_order, release_escrow_for_order
from marketplace.models import Dispute, Order, Withdrawal, Notification, ReputationProfile, Review
from users.serializers import UserSerializer

from .models import AdminActionLog
from .permissions import IsAdminStaff, user_is_admin, ADMIN_ROLES
from .serializers import AdminUserSerializer, AdminDisputeSerializer, AdminWithdrawalSerializer
from .services import log_admin_action

User = get_user_model()


def _authenticate_identifier(identifier: str, password: str):
    identifier = (identifier or '').strip()
    if not identifier or not password:
        return None

    user = authenticate(username=identifier, password=password)
    if user:
        return user

    try:
        email_user = User.objects.get(email__iexact=identifier)
    except User.DoesNotExist:
        return None

    if email_user.check_password(password):
        return email_user
    return None


class AdminLoginView(APIView):
    """Admin login — no restriction; requires is_staff + admin role."""

    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier') or request.data.get('email') or request.data.get('username')
        password = request.data.get('password')

        user = _authenticate_identifier(identifier, password)
        if not user:
            return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'error': 'Account is deactivated.'}, status=status.HTTP_403_FORBIDDEN)

        if not user.is_staff:
            return Response({'error': 'You do not have admin panel access.'}, status=status.HTTP_403_FORBIDDEN)

        if user.role not in ADMIN_ROLES:
            return Response({'error': 'You do not have admin panel access.'}, status=status.HTTP_403_FORBIDDEN)

        token, _ = Token.objects.get_or_create(user=user)
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user, context={'request': request}).data

        return Response({
            'token': token.key,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data,
        })


class AdminOverviewView(APIView):
    permission_classes = [IsAdminStaff]

    def get(self, request):
        risk_users = ReputationProfile.objects.filter(risk_level__in=['HIGH_RISK', 'WATCHLIST']).count()
        auto_resolved_pct = 0
        total_disputes = Dispute.objects.count()
        if total_disputes:
            auto_resolved_pct = round((Dispute.objects.filter(auto_resolved=True).count() / total_disputes) * 100, 2)
        return Response({
            'users_count': User.objects.count(),
            'sellers_count': User.objects.filter(role='seller').count(),
            'open_disputes_count': Dispute.objects.filter(status=Dispute.STATUS_OPEN).count(),
            'pending_withdrawals_count': Withdrawal.objects.filter(status__in=[Withdrawal.STATUS_PENDING, Withdrawal.STATUS_PROCESSING]).count(),
            'risky_users_count': risk_users,
            'auto_resolved_disputes_percent': auto_resolved_pct,
            'fraud_alerts_count': Dispute.objects.filter(fraud_score__gte=60).count(),
            'reviews_pending_moderation': Review.objects.filter(moderation_status=Review.MODERATION_PENDING).count(),
        })


class AdminUserListView(APIView):
    permission_classes = [IsAdminStaff]

    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data)


class AdminUserBanView(APIView):
    permission_classes = [IsAdminStaff]

    def post(self, request, user_id):
        target = User.objects.filter(pk=user_id).first()
        if not target:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if target.role in ADMIN_ROLES:
            return Response({'error': 'Cannot ban admin users.'}, status=status.HTTP_400_BAD_REQUEST)

        target.is_active = False
        target.save(update_fields=['is_active'])
        log_admin_action(
            request.user,
            AdminActionLog.ACTION_BAN_USER,
            f'User:{target.id}',
            notes=f'Banned {target.username}',
        )
        return Response(AdminUserSerializer(target).data)


class AdminUserDeleteView(APIView):
    permission_classes = [IsAdminStaff]

    def delete(self, request, user_id):
        target = User.objects.filter(pk=user_id).first()
        if not target:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if target.role in ADMIN_ROLES:
            return Response({'error': 'Cannot delete admin users.'}, status=status.HTTP_400_BAD_REQUEST)

        label = f'User:{target.id} ({target.username})'
        target.delete()
        log_admin_action(
            request.user,
            AdminActionLog.ACTION_DELETE_USER,
            label,
            notes='Hard deleted user',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminDisputeListView(APIView):
    permission_classes = [IsAdminStaff]

    def get(self, request):
        disputed_orders = Order.objects.filter(status=Order.STATUS_DISPUTED).exclude(
            dispute_record__isnull=False
        )
        for order in disputed_orders:
            Dispute.objects.get_or_create(
                order=order,
                defaults={
                    'title': order.dispute_reason or 'Dispute',
                    'description': order.dispute_description or '',
                    'status': Dispute.STATUS_OPEN,
                },
            )

        disputes = Dispute.objects.select_related(
            'order', 'order__product', 'order__buyer', 'order__seller', 'buyer', 'seller'
        ).prefetch_related('evidence').order_by('-created_at')
        serializer = AdminDisputeSerializer(disputes, many=True, context={'request': request})
        return Response(serializer.data)


class AdminDisputeActionView(APIView):
    permission_classes = [IsAdminStaff]

    @transaction.atomic
    def post(self, request, dispute_id):
        dispute = Dispute.objects.select_related('order').filter(pk=dispute_id).first()
        if not dispute:
            return Response({'error': 'Dispute not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        resolution_note = (request.data.get('resolution_note') or '').strip()
        order = dispute.order
        now = timezone.now()

        if action == 'under_review':
            dispute.status = Dispute.STATUS_UNDER_REVIEW
            if resolution_note:
                dispute.resolution_note = resolution_note
            dispute.save()
            log_admin_action(
                request.user,
                AdminActionLog.ACTION_DISPUTE_UNDER_REVIEW,
                f'Dispute:{dispute.id}',
                notes=resolution_note,
            )

        elif action == 'refund_buyer':
            refund_escrow_for_order(order)
            if order.status != Order.STATUS_COMPLETED:
                order.status = Order.STATUS_DISPUTED
            order.save(update_fields=['status'])
            dispute.status = Dispute.STATUS_REFUNDED
            dispute.resolution = 'Refunded to Buyer'
            dispute.resolution_note = resolution_note
            dispute.resolved_by = request.user
            dispute.resolved_at = now
            dispute.save()
            log_admin_action(
                request.user,
                AdminActionLog.ACTION_REFUND,
                f'Dispute:{dispute.id}/Order:{order.id}',
                notes=resolution_note,
            )
            Notification.objects.create(
                user=order.buyer,
                order=order,
                title='Dispute resolved — refund',
                message=f'Your dispute for order #{order.id} was resolved with a refund.',
            )

        elif action == 'release_seller':
            release_escrow_for_order(order)
            order.status = Order.STATUS_COMPLETED
            order.completed_at = order.completed_at or now
            order.save(update_fields=['status', 'completed_at'])
            dispute.status = Dispute.STATUS_RELEASED
            dispute.resolution = 'Released to Seller'
            dispute.resolution_note = resolution_note
            dispute.resolved_by = request.user
            dispute.resolved_at = now
            dispute.save()
            log_admin_action(
                request.user,
                AdminActionLog.ACTION_RELEASE_ESCROW,
                f'Dispute:{dispute.id}/Order:{order.id}',
                notes=resolution_note,
            )
            Notification.objects.create(
                user=order.seller,
                order=order,
                title='Dispute resolved — funds released',
                message=f'Dispute for order #{order.id} was closed; escrow released.',
            )

        elif action == 'reject':
            dispute.status = Dispute.STATUS_REJECTED
            dispute.resolution_note = resolution_note
            dispute.resolved_by = request.user
            dispute.resolved_at = now
            dispute.save()
            log_admin_action(
                request.user,
                AdminActionLog.ACTION_DISPUTE_REJECT,
                f'Dispute:{dispute.id}',
                notes=resolution_note,
            )
            Notification.objects.create(
                user=order.buyer,
                order=order,
                title='Dispute resolved',
                message=f'Your dispute for order #{order.id} was reviewed and closed.',
            )
            Notification.objects.create(
                user=order.seller,
                order=order,
                title='Dispute resolved',
                message=f'Dispute for order #{order.id} was closed by admin.',
            )

        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AdminDisputeSerializer(dispute).data)


class AdminWithdrawalListView(APIView):
    permission_classes = [IsAdminStaff]

    def get(self, request):
        withdrawals = Withdrawal.objects.select_related('seller').order_by('-created_at')
        serializer = AdminWithdrawalSerializer(withdrawals, many=True)
        return Response(serializer.data)


class AdminWithdrawalActionView(APIView):
    permission_classes = [IsAdminStaff]

    def post(self, request, withdrawal_id):
        withdrawal = Withdrawal.objects.select_related('seller').filter(pk=withdrawal_id).first()
        if not withdrawal:
            return Response({'error': 'Withdrawal not found.'}, status=status.HTTP_404_NOT_FOUND)

        if withdrawal.status not in [Withdrawal.STATUS_PENDING, Withdrawal.STATUS_PROCESSING]:
            return Response({'error': 'Withdrawal already processed.'}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action')
        now = timezone.now()

        if action == 'approve':
            withdrawal.status = Withdrawal.STATUS_COMPLETED
            withdrawal.reviewed_by = request.user
            withdrawal.reviewed_at = now
            withdrawal.save()
            log_admin_action(
                request.user,
                AdminActionLog.ACTION_APPROVE_WITHDRAWAL,
                f'Withdrawal:{withdrawal.id}',
                notes=f'Approved KES {withdrawal.amount}',
            )
            Notification.objects.create(
                user=withdrawal.seller,
                title='Withdrawal approved',
                message=f'Your withdrawal of KES {withdrawal.amount} was approved.',
            )

        elif action == 'reject':
            reason = (request.data.get('rejection_reason') or request.data.get('notes') or '').strip()
            withdrawal.status = Withdrawal.STATUS_REJECTED
            withdrawal.rejection_reason = reason
            withdrawal.reviewed_by = request.user
            withdrawal.reviewed_at = now
            withdrawal.save()
            log_admin_action(
                request.user,
                AdminActionLog.ACTION_REJECT_WITHDRAWAL,
                f'Withdrawal:{withdrawal.id}',
                notes=reason,
            )
            Notification.objects.create(
                user=withdrawal.seller,
                title='Withdrawal rejected',
                message=f'Your withdrawal request was rejected. {reason}'.strip(),
            )

        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AdminWithdrawalSerializer(withdrawal).data)


class AdminMeView(APIView):
    permission_classes = [IsAdminStaff]

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)
