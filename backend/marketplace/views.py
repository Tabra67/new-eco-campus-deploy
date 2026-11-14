from rest_framework import generics, status, permissions, filters
from django.utils import timezone
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

import json
import logging

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from .models import (
    Item, Message, Order, Wishlist, Conversation, ChatMessage,
    MpesaTransaction, Notification, Payment, Withdrawal, SellerWallet,
    EscrowTransaction, CheckoutSession, SupportThread, SupportMessage, Dispute,
    DisputeEvidence, Review, ReputationProfile, Cart, CartItem,
)
from .dispute_services import compute_dispute_ai_recommendation, auto_resolve_dispute
from .trust_services import recalculate_reputation_for_user
from .mpesa_b2c import initiate_b2c_payout
from .mpesa import initiate_stk_push, initiate_stk_push_for_session, process_stk_callback, maybe_mark_transaction_timed_out
from .checkout_services import create_checkout_session, amounts_for_checkout_session
from .wallet_services import get_or_create_wallet, deduct_available_for_withdrawal
from .mpesa_config import normalize_callback_url
from .escrow_services import calculate_order_amounts, release_escrow_for_order
from .serializers import (
    ProductSerializer, CreateProductSerializer, 
    MessageSerializer, MarketplaceProductSerializer,
    OrderSerializer, CreateOrderSerializer,
    WishlistSerializer, ConversationSerializer, ChatMessageSerializer,
    WalletSerializer, WithdrawalSerializer, DisputeSerializer, DisputeEvidenceSerializer,
    ReviewSerializer, ReputationProfileSerializer, CartItemSerializer,
)
from users.models import CustomUser

class IsSellerPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if hasattr(request.user, 'seller_orders'):
            return True
        return False

    def has_object_permission(self, request, view, obj):
        return obj.seller == request.user

class IsOwnerOrSeller(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.seller == request.user

# Existing seller-only views - unchanged
class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'category']

    def get_queryset(self):
        # Only seller's own products
        return Item.objects.filter(seller=self.request.user).select_related('seller', 'university').order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateProductSerializer
        return ProductSerializer

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user, university=self.request.user.university)

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrSeller]
    lookup_field = 'id'
    queryset = Item.objects.all().select_related('seller', 'university')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CreateProductSerializer  # No image on update for simplicity
        return ProductSerializer

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsOwnerOrSeller])
def mark_product_sold(request, id):
    product = get_object_or_404(Item, id=id, seller=request.user)
    product.status = 'sold'
    product.save()
    serializer = ProductSerializer(product, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)

class SellerStatsView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = Item.objects.filter(seller=request.user)
        messages = Message.objects.filter(seller=request.user)
        stats = {
            'products_listed': products.count(),
            'products_sold': products.filter(status='sold').count(),
            'messages': messages.count(),
            'views': 0,  # Placeholder
        }
        return Response(stats)

class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Seller's inbox
        print(f"MESSAGE_LIST_SELLER: user={self.request.user.id}, count={Message.objects.filter(seller=self.request.user).count()}")
        return Message.objects.filter(seller=self.request.user).select_related('product', 'buyer', 'seller').order_by('-timestamp')

class MessageBidirectionalListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        print(f"MESSAGE_BIDIR: user={user.id}, sent={Message.objects.filter(buyer=user).count()}, received={Message.objects.filter(seller=user).count()}")
        return Message.objects.filter(Q(buyer=user) | Q(seller=user)).select_related('product', 'buyer', 'seller').order_by('-timestamp')

class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(buyer=user) | Q(seller=user)
        ).select_related('order__product', 'buyer', 'seller').order_by('-updated_at')

    def list(self, request, *args, **kwargs):
        from .conversation_services import get_grouped_threads
        return Response(get_grouped_threads(request.user))

class EnsureConversationView(generics.GenericAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        order = get_object_or_404(Order.objects.select_related('buyer', 'seller'), id=order_id)
        if request.user.id not in [order.buyer_id, order.seller_id]:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        conversation, _ = Conversation.objects.get_or_create(
            order=order,
            defaults={'buyer': order.buyer, 'seller': order.seller}
        )
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ConversationByOrderView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'order_id'

    def get_object(self):
        order_id = self.kwargs.get('order_id')
        conversation = get_object_or_404(Conversation.objects.select_related('order__product', 'buyer', 'seller'), order_id=order_id)
        if self.request.user.id not in [conversation.buyer_id, conversation.seller_id]:
            raise PermissionDenied("Forbidden")
        return conversation

class ConversationMessagesView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs.get('conversation_id')
        conversation = get_object_or_404(Conversation, id=conversation_id)
        if self.request.user.id not in [conversation.buyer_id, conversation.seller_id]:
            raise PermissionDenied("Forbidden")
        return ChatMessage.objects.filter(conversation=conversation).select_related('sender', 'conversation')


class ThreadMessagesView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from .conversation_services import get_thread_messages
        other_user_id = self.kwargs.get('other_user_id')
        return get_thread_messages(self.request.user, other_user_id)

class ChatMessageCreateView(generics.GenericAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .conversation_services import find_conversation_between

        conversation_id = request.data.get('conversation_id')
        order_id = request.data.get('order_id') or request.data.get('order')
        other_user_id = request.data.get('other_user_id')
        text = request.data.get('message') or request.data.get('text')
        if not text:
            return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

        conversation = None

        if order_id:
            order = get_object_or_404(Order.objects.select_related('buyer', 'seller'), id=order_id)
            if request.user.id not in [order.buyer_id, order.seller_id]:
                return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

            conversation, _ = Conversation.objects.get_or_create(
                order=order,
                defaults={'buyer': order.buyer, 'seller': order.seller}
            )
        elif other_user_id:
            conversation = find_conversation_between(request.user, other_user_id)
            if not conversation:
                return Response(
                    {'error': 'No conversation found. Start chat from an order first.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif conversation_id:
            conversation = get_object_or_404(Conversation.objects.select_related('buyer', 'seller', 'order'), id=conversation_id)
            if request.user.id not in [conversation.buyer_id, conversation.seller_id]:
                return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({'error': 'order_id or other_user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        receiver_id = conversation.seller_id if request.user.id == conversation.buyer_id else conversation.buyer_id
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            receiver_id=receiver_id,
            text=text.strip(),
            read_status=False,
        )
        conversation.save(update_fields=['updated_at'])

        serialized = ChatMessageSerializer(message).data
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{conversation.id}",
            {
                "type": "chat.message",
                "payload": serialized
            }
        )
        return Response(serialized, status=status.HTTP_201_CREATED)

# Bidirectional send message - buyer->seller or seller->buyer
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):
    product_id = request.data.get('product')
    receiver_id = request.data.get('receiver')  # Optional for seller replies
    message_text = request.data.get('message')
    print(f"SEND_MESSAGE: user={request.user.id}, product={product_id}, receiver={receiver_id}")
    
    if not message_text or not product_id:
        return Response({'error': 'Product ID and message required'}, status=status.HTTP_400_BAD_REQUEST)
    
    product = get_object_or_404(Item, id=product_id)
    
    if receiver_id:
        # Bidirectional: seller replying to buyer
        if request.user == product.seller:
            # Seller sending to buyer (receiver)
            serializer_data = {
                'product': product_id,
                'buyer': receiver_id,
                'seller': request.user.id,
                'message': message_text,
            }
        else:
            # Buyer sending to someone else? Block for safety
            return Response({'error': 'Invalid sender/receiver'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        # Legacy buyer -> seller
        serializer_data = {
            'product': product_id,
            'buyer': request.user.id,
            'seller': product.seller.id,
            'message': message_text,
        }
    
    serializer = MessageSerializer(data=serializer_data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# NEW: Public marketplace products list with search & filters
class MarketplaceProductListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MarketplaceProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'condition', 'status']
    search_fields = ['title', 'description', 'category']
    ordering_fields = ['price', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Item.objects.filter(
            status='available',
            units_available__gt=0,
        ).select_related('seller', 'university').order_by('-created_at')

        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(category__icontains=search)
            )
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

# NEW: User orders
class OrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        print(f"ORDERS_BUYER: user={self.request.user.id}, count={Order.objects.filter(buyer=self.request.user).count()}")
        return Order.objects.filter(buyer=self.request.user).select_related(
            'product__seller', 'product', 'seller', 'buyer', 'payment_record', 'review'
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateOrderSerializer
        return OrderSerializer

    def perform_create(self, serializer):
        try:
            instance = serializer.save()
            print(f"Order created: {instance.id} for product {instance.product.id} (Ksh {instance.price}) status={instance.status}")
        except Exception as e:
            print(f"Order create FAILED: {str(e)}")
            raise

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

# NEW: Wishlist toggle/list
class WishlistListCreateView(generics.ListCreateAPIView):
    serializer_class = WishlistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        print(f"WISHLIST: user={self.request.user.id}, count={Wishlist.objects.filter(user=self.request.user).count()}")
        return Wishlist.objects.filter(user=self.request.user).select_related('product__seller', 'product')

# NEW: Increment product view count (public, fires on detail page load)
@api_view(['PATCH'])
@permission_classes([AllowAny])
def increment_product_view(request, id):
    product = get_object_or_404(Item, id=id)
    product.views += 1
    product.save()
    return Response({'views': product.views}, status=status.HTTP_200_OK)

# NEW: Seller order list
class SellerOrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(seller=self.request.user).select_related(
            'product__seller', 'product', 'seller', 'buyer', 'payment_record', 'review'
        ).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

# NEW: Seller update order status
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def update_order_status(request, id):
    order = get_object_or_404(Order, id=id)

    action = request.data.get('action')
    payment_reference = request.data.get('payment_reference')
    payment_phone = request.data.get('payment_phone')
    dispute_reason = request.data.get('dispute_reason')
    dispute_description = request.data.get('dispute_description')

    if not action:
        return Response({'error': 'Action is required'}, status=status.HTTP_400_BAD_REQUEST)

    action = str(action).strip().lower()

    action_map = {
        'seller_confirm': {
            'allowed_user': 'seller',
            'target_status': Order.STATUS_PROCESSING,
            'idempotent_statuses': [Order.STATUS_PROCESSING],
        },
        'seller_processing': {
            'allowed_user': 'seller',
            'target_status': Order.STATUS_PROCESSING,
            'idempotent_statuses': [Order.STATUS_PROCESSING],
        },
        'seller_ship': {
            'allowed_user': 'seller',
            'target_status': Order.STATUS_SHIPPED,
            'idempotent_statuses': [Order.STATUS_SHIPPED],
        },
        'buyer_pay': {
            'allowed_user': 'buyer',
            'target_status': Order.STATUS_PAID,
            'idempotent_statuses': [Order.STATUS_PAID],
        },
        'seller_deliver': {
            'allowed_user': 'seller',
            'target_status': Order.STATUS_DELIVERED,
            'idempotent_statuses': [Order.STATUS_DELIVERED],
        },
        'buyer_confirm_delivery': {
            'allowed_user': 'buyer',
            'target_status': Order.STATUS_COMPLETED,
            'idempotent_statuses': [Order.STATUS_COMPLETED],
        },
        'buyer_dispute': {
            'allowed_user': 'buyer',
            'target_status': Order.STATUS_DISPUTED,
            'idempotent_statuses': [Order.STATUS_DISPUTED],
        },
    }

    if action not in action_map:
        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

    config = action_map[action]
    allowed_user = config['allowed_user']
    target_status = config['target_status']

    if allowed_user == 'seller' and order.seller_id != request.user.id:
        return Response({'error': 'Only seller can perform this action'}, status=status.HTTP_403_FORBIDDEN)
    if allowed_user == 'buyer' and order.buyer_id != request.user.id:
        return Response({'error': 'Only buyer can perform this action'}, status=status.HTTP_403_FORBIDDEN)

    if order.status in config['idempotent_statuses']:
        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    if action == 'buyer_pay':
        if not payment_reference:
            return Response({'error': 'payment_reference is required'}, status=status.HTTP_400_BAD_REQUEST)

    if action == 'buyer_dispute':
        if not dispute_reason or not str(dispute_reason).strip():
            return Response({'error': 'dispute_reason is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not dispute_description or not str(dispute_description).strip():
            return Response({'error': 'dispute_description is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order.transition_to(target_status)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()

    if action == 'buyer_pay':
        order.payment_reference = payment_reference
        order.payment_phone = payment_phone or order.payment_phone
        order.paid_at = now
        order.escrow_status = 'LOCKED'
    elif action in ('seller_confirm', 'seller_processing'):
        Notification.objects.create(
            user=order.buyer,
            order=order,
            title='Order processing',
            message=f'Seller is processing order #{order.id}.',
        )
    elif action == 'seller_ship':
        Notification.objects.create(
            user=order.buyer,
            order=order,
            title='Order shipped',
            message=f'Seller shipped order #{order.id}.',
        )
    elif action == 'seller_deliver':
        order.delivered_at = now
        Notification.objects.create(
            user=order.buyer,
            order=order,
            title='Order delivered',
            message=f'Seller marked order #{order.id} as delivered. Confirm delivery or open a dispute.',
        )
    elif action == 'buyer_confirm_delivery':
        release_escrow_for_order(order)
    elif action == 'buyer_dispute':
        from .models import Dispute
        from .escrow_services import freeze_escrow_for_order

        order.dispute_reason = dispute_reason
        order.dispute_description = dispute_description
        if request.FILES.get('dispute_evidence_image'):
            order.dispute_evidence_image = request.FILES.get('dispute_evidence_image')
        order.disputed_at = now
        freeze_escrow_for_order(order)
        dispute, created = Dispute.objects.update_or_create(
            order=order,
            defaults={
                'buyer': order.buyer,
                'seller': order.seller,
                'title': dispute_reason,
                'reason': dispute_reason,
                'description': dispute_description,
                'detailed_description': dispute_description,
                'status': Dispute.STATUS_AWAITING_SELLER_RESPONSE,
                'priority': Dispute.PRIORITY_MEDIUM,
                'priority_level': 'medium',
                'response_deadline': now + __import__('datetime').timedelta(hours=48),
            },
        )
        if created:
            from .dispute_views import setup_dispute_on_open
            setup_dispute_on_open(dispute, order)
        elif not dispute.response_deadline:
            from .dispute_views import setup_dispute_on_open
            setup_dispute_on_open(dispute, order)

    order.save()
    serializer = OrderSerializer(order, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)

# Toggle wishlist (POST to add, DELETE to remove)
@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def wishlist_toggle(request, product_id):
    product = get_object_or_404(Item, id=product_id)
    wishlist_item, created = Wishlist.objects.get_or_create(
        user=request.user,
        product=product,
        defaults={'added_at': timezone.now()}
    )
    
    if not created:
        wishlist_item.delete()
        return Response({'message': 'Removed from wishlist'}, status=status.HTTP_200_OK)
    
    return Response(WishlistSerializer(wishlist_item, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    user = request.user
    buyer_orders = Order.objects.filter(buyer=user)
    seller_orders = Order.objects.filter(seller=user)
    payments = Payment.objects.filter(buyer=user)

    return Response({
        'buyer_orders': buyer_orders.count(),
        'seller_orders': seller_orders.count(),
        'completed_orders': buyer_orders.filter(status=Order.STATUS_COMPLETED).count(),
        'disputed_orders': buyer_orders.filter(status=Order.STATUS_DISPUTED).count(),
        'payments_count': payments.count(),
        'total_spent': float(sum(p.amount for p in payments)),
        'unread_notifications': Notification.objects.filter(user=user, is_read=False).count(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_history(request):
    payments = Payment.objects.filter(buyer=request.user).select_related('order__product').order_by('-created_at')
    data = [
        {
            'id': p.mpesa_receipt_number or f'payment-{p.id}',
            'order_id': p.order_id,
            'order_name': p.order.product.title if p.order and p.order.product else 'Order',
            'date': p.created_at,
            'amount': p.amount,
            'phone': p.phone,
            'status': p.status,
            'escrow_fee': p.escrow_fee,
            'discount_amount': p.discount_amount,
        }
        for p in payments
    ]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mpesa_stk_push(request):
    order_id = request.data.get('order_id')
    phone = request.data.get('phone')
    if not order_id or not phone:
        return Response({'error': 'order_id and phone are required'}, status=status.HTTP_400_BAD_REQUEST)

    order = get_object_or_404(Order.objects.select_related('buyer', 'seller', 'product'), id=order_id)
    if order.buyer_id != request.user.id:
        return Response({'error': 'Only the buyer can pay for this order'}, status=status.HTTP_403_FORBIDDEN)

    if order.status not in [Order.STATUS_PENDING_PAYMENT, Order.STATUS_PAID]:
        return Response({'error': 'Order is not awaiting payment'}, status=status.HTTP_400_BAD_REQUEST)

    if order.status == Order.STATUS_PAID:
        serializer = OrderSerializer(order, context={'request': request})
        return Response({'message': 'Order already paid', 'order': serializer.data}, status=status.HTTP_200_OK)

    pending_txn = MpesaTransaction.objects.filter(
        order=order,
        status=MpesaTransaction.STATUS_PENDING,
    ).first()
    if pending_txn:
        maybe_mark_transaction_timed_out(pending_txn)
        if pending_txn.status == MpesaTransaction.STATUS_PENDING:
            return Response(
                {'error': 'A payment is already pending for this order. Complete or cancel it on your phone.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    try:
        callback_url = normalize_callback_url(settings.MPESA_CALLBACK_URL)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        txn = initiate_stk_push(order=order, phone=phone)
        amounts = calculate_order_amounts(order, order.buyer)
        return Response({
            'checkout_request_id': txn.checkout_request_id,
            'merchant_request_id': txn.merchant_request_id,
            'message': 'STK push sent. Complete payment on your phone.',
            'subtotal': str(amounts['subtotal']),
            'escrow_fee': str(amounts['escrow_fee']),
            'discount_amount': str(amounts['discount_amount']),
            'total_amount': str(amounts['total_amount']),
            'callback_url_host': callback_url.split('/')[2],
        }, status=status.HTTP_200_OK)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        logging.getLogger('marketplace.mpesa').exception('STK push unexpected error order_id=%s', order_id)
        return Response({'error': 'Payment could not be started. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)


mpesa_logger = logging.getLogger('marketplace.mpesa')


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """Safaricom STK callback — must be public HTTPS, no auth, no CSRF."""
    try:
        payload = request.data if isinstance(request.data, dict) and request.data else None
        if not payload:
            raw = request.body.decode('utf-8') if request.body else '{}'
            payload = json.loads(raw or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        mpesa_logger.warning('M-Pesa callback rejected: invalid JSON body')
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

    mpesa_logger.info('M-Pesa callback HTTP received keys=%s', list(payload.keys()) if isinstance(payload, dict) else 'invalid')

    try:
        process_stk_callback(payload)
    except Exception:
        mpesa_logger.exception('M-Pesa callback processing error')

    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mpesa_payment_status(request, checkout_request_id):
    txn = get_object_or_404(MpesaTransaction.objects.select_related('order'), checkout_request_id=checkout_request_id)
    allowed_ids = []
    if txn.order_id:
        allowed_ids = [txn.order.buyer_id, txn.order.seller_id]
    elif txn.checkout_session_id:
        allowed_ids = [txn.checkout_session.buyer_id]
    if request.user.id not in allowed_ids:
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    txn = maybe_mark_transaction_timed_out(txn)

    order_id = txn.order_id
    if not order_id and txn.checkout_session_id:
        session = txn.checkout_session
        if session and session.order_id:
            order_id = session.order_id

    return Response({
        'status': txn.status,
        'message': txn.result_desc or '',
        'receipt_number': txn.receipt_number,
        'order_id': order_id,
        'checkout_session_id': txn.checkout_session_id,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mpesa_checkout(request):
    """Pay-first flow: create checkout session and initiate STK push (order created on payment)."""
    product_id = request.data.get('product_id')
    quantity = request.data.get('quantity', 1)
    phone = request.data.get('phone')
    if not product_id or not phone:
        return Response({'error': 'product_id and phone are required'}, status=status.HTTP_400_BAD_REQUEST)

    product = get_object_or_404(Item.objects.select_related('seller'), id=product_id)
    try:
        session = create_checkout_session(
            buyer=request.user,
            product=product,
            quantity=quantity,
            phone=phone,
        )
        txn = initiate_stk_push_for_session(session=session, phone=phone)
        amounts = amounts_for_checkout_session(session)
        return Response({
            'checkout_session_id': session.id,
            'checkout_request_id': txn.checkout_request_id,
            'merchant_request_id': txn.merchant_request_id,
            'message': 'STK push sent. Complete payment on your phone.',
            'subtotal': str(amounts['subtotal']),
            'escrow_fee': str(amounts['escrow_fee']),
            'discount_amount': str(amounts['discount_amount']),
            'total_amount': str(amounts['total_amount']),
        }, status=status.HTTP_200_OK)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        logging.getLogger('marketplace.mpesa').exception('Checkout STK error product_id=%s', product_id)
        return Response({'error': 'Payment could not be started. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_wallet(request):
    if request.user.role != 'seller':
        return Response({'error': 'Only sellers have wallets.'}, status=status.HTTP_403_FORBIDDEN)
    wallet = get_or_create_wallet(request.user)
    return Response(WalletSerializer(wallet).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def escrow_history(request):
    user = request.user
    if user.role == 'seller':
        qs = EscrowTransaction.objects.filter(seller=user)
    elif user.role in ('admin', 'super_admin'):
        qs = EscrowTransaction.objects.all()
    else:
        qs = EscrowTransaction.objects.filter(buyer=user)

    qs = qs.select_related('order__product', 'buyer', 'seller', 'payment').order_by('-created_at')[:100]
    data = [
        {
            'id': e.id,
            'order_id': e.order_id,
            'product_title': e.order.product.title if e.order and e.order.product else '',
            'buyer': e.buyer.username if e.buyer else (e.order.buyer.username if e.order else ''),
            'seller': e.seller.username if e.seller else (e.order.seller.username if e.order else ''),
            'amount_held': e.amount_held,
            'escrow_status': e.status,
            'payment_status': e.payment_status,
            'released_at': e.released_at,
            'created_at': e.created_at,
        }
        for e in qs
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buyer_cart(request):
    if request.user.role != 'buyer':
        return Response({'error': 'Only buyers have carts.'}, status=status.HTTP_403_FORBIDDEN)

    from .cart_services import get_or_create_cart, cart_totals
    cart = get_or_create_cart(request.user)
    items = cart.items.select_related('product', 'product__seller').all()
    totals = cart_totals(cart)
    return Response({
        'items': CartItemSerializer(items, many=True, context={'request': request}).data,
        'subtotal': str(totals['subtotal']),
        'item_count': totals['item_count'],
        'total_amount': str(totals['subtotal']),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cart_add_item(request):
    if request.user.role != 'buyer':
        return Response({'error': 'Only buyers can add to cart.'}, status=status.HTTP_403_FORBIDDEN)

    product_id = request.data.get('product_id')
    quantity = request.data.get('quantity', 1)
    if not product_id:
        return Response({'error': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from .cart_services import add_to_cart, get_or_create_cart, cart_totals
    try:
        item = add_to_cart(request.user, int(product_id), quantity)
        cart = get_or_create_cart(request.user)
        totals = cart_totals(cart)
        return Response({
            'item': CartItemSerializer(item, context={'request': request}).data,
            'item_count': totals['item_count'],
            'message': 'Added to cart.',
        }, status=status.HTTP_201_CREATED)
    except Item.DoesNotExist:
        return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def cart_item_detail(request, item_id):
    if request.user.role != 'buyer':
        return Response({'error': 'Only buyers can modify cart.'}, status=status.HTTP_403_FORBIDDEN)

    from .cart_services import update_cart_item_quantity, remove_cart_item, get_or_create_cart, cart_totals

    if request.method == 'DELETE':
        try:
            remove_cart_item(request.user, item_id)
        except CartItem.DoesNotExist:
            return Response({'error': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)
        cart = get_or_create_cart(request.user)
        totals = cart_totals(cart)
        return Response({'message': 'Item removed.', 'item_count': totals['item_count']})

    quantity = request.data.get('quantity')
    try:
        item = update_cart_item_quantity(request.user, item_id, quantity)
        cart = get_or_create_cart(request.user)
        totals = cart_totals(cart)
        return Response({
            'item': CartItemSerializer(item, context={'request': request}).data,
            'subtotal': str(totals['subtotal']),
            'item_count': totals['item_count'],
        })
    except CartItem.DoesNotExist:
        return Response({'error': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cart_clear(request):
    if request.user.role != 'buyer':
        return Response({'error': 'Only buyers can clear cart.'}, status=status.HTTP_403_FORBIDDEN)

    from .cart_services import clear_cart
    clear_cart(request.user)
    return Response({'message': 'Cart cleared.', 'item_count': 0})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def seller_withdrawals(request):
    if request.user.role != 'seller':
        return Response({'error': 'Only sellers can request withdrawals.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        rows = Withdrawal.objects.filter(seller=request.user).order_by('-created_at')
        return Response(WithdrawalSerializer(rows, many=True).data)

    amount = request.data.get('amount')
    payout_method = (request.data.get('payout_method') or request.data.get('method') or 'BANK').strip().upper()
    payout_details = (request.data.get('payout_details') or '').strip()
    phone_number = (request.data.get('phone_number') or payout_details or '').strip()

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return Response({'error': 'Valid amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount <= 0:
        return Response({'error': 'Amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

    if payout_method not in ('BANK', 'PAYPAL', 'STRIPE', 'MPESA'):
        payout_method = 'BANK'

    if payout_method == 'MPESA':
        phone_number = phone_number or payout_details
        payout_details = phone_number or payout_details
    elif not payout_details:
        return Response({'error': 'payout_details is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from .withdrawal_services import validate_withdrawal_request, initiate_mock_b2c_withdrawal
    valid, validation_error = validate_withdrawal_request(
        seller=request.user,
        amount=amount,
        payout_method=payout_method,
        phone_number=phone_number if payout_method == 'MPESA' else '',
    )
    if not valid:
        return Response({'error': validation_error}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            deduct_available_for_withdrawal(request.user, amount)
            withdrawal = Withdrawal.objects.create(
                seller=request.user,
                amount=amount,
                status=Withdrawal.STATUS_PENDING,
                payout_method=payout_method,
                payout_details=payout_details,
                phone_number=phone_number if payout_method == 'MPESA' else phone_number,
            )
        initiate_mock_b2c_withdrawal(withdrawal)
        Notification.objects.create(
            user=request.user,
            title='Withdrawal initiated',
            message=f'Your withdrawal of KES {amount} is being processed.',
        )
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    wallet = get_or_create_wallet(request.user)
    return Response({
        'withdrawal': WithdrawalSerializer(withdrawal).data,
        'wallet': WalletSerializer(wallet).data,
    }, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_b2c_result(request):
    payload = request.data if isinstance(request.data, dict) else {}
    result = payload.get('Result', {}) if isinstance(payload, dict) else {}
    conversation_id = result.get('ConversationID') or payload.get('ConversationID')
    withdrawal = Withdrawal.objects.filter(conversation_id=conversation_id).first()
    if not withdrawal:
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})
    result_code = str(result.get('ResultCode', '1'))
    if result_code == '0':
        withdrawal.status = Withdrawal.STATUS_COMPLETED
        withdrawal.mpesa_receipt = result.get('TransactionReceipt', '') or withdrawal.mpesa_receipt
        withdrawal.result_description = result.get('ResultDesc', 'Success')
        withdrawal.completed_at = timezone.now()
        withdrawal.save(update_fields=['status', 'mpesa_receipt', 'result_description', 'completed_at'])
    else:
        with transaction.atomic():
            wallet = SellerWallet.objects.select_for_update().get(seller=withdrawal.seller)
            wallet.available_balance += withdrawal.amount
            wallet.pending_withdrawals = max(0, wallet.pending_withdrawals - withdrawal.amount)
            wallet.total_withdrawn = max(0, wallet.total_withdrawn - withdrawal.amount)
            wallet.withdrawn_total = wallet.total_withdrawn
            wallet.save(update_fields=['available_balance', 'pending_withdrawals', 'total_withdrawn', 'withdrawn_total', 'updated_at'])
            withdrawal.status = Withdrawal.STATUS_FAILED
            withdrawal.failed_reason = result.get('ResultDesc', 'B2C failed')
            withdrawal.result_description = withdrawal.failed_reason
            withdrawal.save(update_fields=['status', 'failed_reason', 'result_description'])
    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mpesa_b2c_timeout(request):
    payload = request.data if isinstance(request.data, dict) else {}
    conversation_id = payload.get('ConversationID') or payload.get('OriginatorConversationID')
    withdrawal = Withdrawal.objects.filter(conversation_id=conversation_id).first()
    if withdrawal and withdrawal.status in [Withdrawal.STATUS_PENDING, Withdrawal.STATUS_PROCESSING]:
        with transaction.atomic():
            wallet = SellerWallet.objects.select_for_update().get(seller=withdrawal.seller)
            wallet.available_balance += withdrawal.amount
            wallet.pending_withdrawals = max(0, wallet.pending_withdrawals - withdrawal.amount)
            wallet.total_withdrawn = max(0, wallet.total_withdrawn - withdrawal.amount)
            wallet.withdrawn_total = wallet.total_withdrawn
            wallet.save(update_fields=['available_balance', 'pending_withdrawals', 'total_withdrawn', 'withdrawn_total', 'updated_at'])
            withdrawal.status = Withdrawal.STATUS_FAILED
            withdrawal.failed_reason = 'B2C timeout callback received'
            withdrawal.save(update_fields=['status', 'failed_reason'])
    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def open_dispute(request):
    order_id = request.data.get('order')
    order = get_object_or_404(Order, id=order_id, buyer=request.user)
    dispute, created = Dispute.objects.get_or_create(
        order=order,
        defaults={
            'buyer': order.buyer,
            'seller': order.seller,
            'reason': request.data.get('reason', ''),
            'detailed_description': request.data.get('detailed_description', ''),
            'description': request.data.get('detailed_description', ''),
            'title': request.data.get('reason', 'Dispute'),
            'status': Dispute.STATUS_AWAITING_SELLER_RESPONSE,
        },
    )
    if created:
        from .dispute_views import setup_dispute_on_open
        setup_dispute_on_open(dispute, order)
    dispute.ai_recommendation = compute_dispute_ai_recommendation(dispute)
    dispute.confidence_score = dispute.ai_recommendation.get('confidence_score', 0)
    if not auto_resolve_dispute(dispute):
        dispute.priority_level = 'high' if dispute.fraud_score >= 60 else 'medium'
        dispute.escalated_to_admin = dispute.priority_level == 'high'
        dispute.save(update_fields=['ai_recommendation', 'confidence_score', 'priority_level', 'escalated_to_admin', 'updated_at'])
    return Response(DisputeSerializer(dispute).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_dispute_evidence(request, dispute_id):
    dispute = get_object_or_404(Dispute, id=dispute_id)
    if request.user.id not in [dispute.buyer_id, dispute.seller_id]:
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    serializer = DisputeEvidenceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(dispute=dispute, uploaded_by=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_review(request):
    serializer = ReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    order = serializer.validated_data['order']
    if order.buyer_id != request.user.id:
        return Response({'error': 'Only buyer can review.'}, status=status.HTTP_403_FORBIDDEN)
    if order.status != Order.STATUS_COMPLETED or Dispute.objects.filter(order=order, status__in=[Dispute.STATUS_OPEN, Dispute.STATUS_UNDER_REVIEW]).exists():
        return Response({'error': 'Order is not eligible for review.'}, status=status.HTTP_400_BAD_REQUEST)
    if Review.objects.filter(order=order).exists():
        return Response({'error': 'Review already submitted for this order.'}, status=status.HTTP_400_BAD_REQUEST)
    review = serializer.save(buyer=order.buyer, seller=order.seller, verified_purchase=True, moderation_status=Review.MODERATION_APPROVED)
    recalculate_reputation_for_user(order.seller)
    recalculate_reputation_for_user(order.buyer)
    return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_reviews_list(request):
    if request.user.role != 'seller':
        return Response({'error': 'Only sellers can view seller reviews.'}, status=status.HTTP_403_FORBIDDEN)
    reviews = Review.objects.filter(
        seller=request.user,
        moderation_status=Review.MODERATION_APPROVED,
    ).select_related('buyer', 'order', 'order__product').order_by('-created_at')
    return Response(ReviewSerializer(reviews, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_reviews_list(request, user_id):
    reviews = Review.objects.filter(
        seller_id=user_id,
        moderation_status=Review.MODERATION_APPROVED,
    ).select_related('buyer', 'order', 'order__product').order_by('-created_at')
    return Response(ReviewSerializer(reviews, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reputation_profile(request, user_id):
    profile, _ = ReputationProfile.objects.get_or_create(user_id=user_id)
    profile = recalculate_reputation_for_user(profile.user)
    return Response(ReputationProfileSerializer(profile).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def support_threads(request):
    user = request.user
    if request.method == 'GET':
        if user.role in ('admin', 'super_admin'):
            qs = SupportThread.objects.all()
        else:
            qs = SupportThread.objects.filter(Q(buyer=user) | Q(seller=user) | Q(admin=user))
        qs = qs.select_related('buyer', 'seller', 'admin', 'product', 'order').order_by('-updated_at')
        rows = []
        for t in qs:
            last = t.messages.order_by('-timestamp').first()
            unread = t.messages.filter(read_status=False).exclude(sender=user).count()
            peer = t.seller if user == t.buyer else t.buyer if user == t.seller else (t.buyer or t.seller)
            rows.append({
                'id': t.id,
                'thread_type': t.thread_type,
                'product_id': t.product_id,
                'order_id': t.order_id,
                'peer_id': peer.id if peer else None,
                'peer_name': peer.username if peer else 'User',
                'last_message': last.text if last else '',
                'last_activity': (last.timestamp if last else t.updated_at).isoformat(),
                'unread_count': unread,
            })
        return Response(rows)

    peer_id = request.data.get('user_id') or request.data.get('recipient_id')
    product_id = request.data.get('product_id')
    order_id = request.data.get('order_id')
    if not peer_id:
        return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    peer = get_object_or_404(CustomUser, id=peer_id)
    thread_type = SupportThread.THREAD_BUYER_SELLER
    admin_user = None
    buyer = None
    seller = None

    if user.role in ('admin', 'super_admin'):
        admin_user = user
        if peer.role == 'buyer':
            thread_type = SupportThread.THREAD_ADMIN_BUYER
            buyer, seller = peer, None
        else:
            thread_type = SupportThread.THREAD_ADMIN_SELLER
            seller, buyer = peer, None
    elif user.role == 'buyer':
        buyer, seller = user, peer
    else:
        seller, buyer = user, peer

    filters = Q(thread_type=thread_type)
    if buyer:
        filters &= Q(buyer=buyer)
    if seller:
        filters &= Q(seller=seller)
    if admin_user:
        filters &= Q(admin=admin_user)
    if product_id:
        filters &= Q(product_id=product_id)

    thread = SupportThread.objects.filter(filters).first()
    if not thread:
        thread = SupportThread.objects.create(
            thread_type=thread_type,
            buyer=buyer,
            seller=seller,
            admin=admin_user,
            product_id=product_id or None,
            order_id=order_id or None,
        )
    return Response({'id': thread.id}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def support_thread_messages(request, thread_id):
    thread = get_object_or_404(SupportThread, id=thread_id)
    user = request.user
    if user.role not in ('admin', 'super_admin') and user.id not in filter(None, [thread.buyer_id, thread.seller_id, thread.admin_id]):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        msgs = thread.messages.select_related('sender').order_by('timestamp')
        thread.messages.exclude(sender=user).update(read_status=True)
        return Response([
            {
                'id': m.id,
                'sender_id': m.sender_id,
                'sender_name': m.sender.username,
                'text': m.text,
                'timestamp': m.timestamp,
                'read_status': m.read_status,
            }
            for m in msgs
        ])

    text = (request.data.get('message') or request.data.get('text') or '').strip()
    if not text:
        return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)
    msg = SupportMessage.objects.create(thread=thread, sender=user, text=text)
    thread.save(update_fields=['updated_at'])
    return Response({
        'id': msg.id,
        'sender_id': msg.sender_id,
        'sender_name': user.username,
        'text': msg.text,
        'timestamp': msg.timestamp,
        'read_status': msg.read_status,
    }, status=status.HTTP_201_CREATED)

