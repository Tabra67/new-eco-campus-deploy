from rest_framework import serializers
from .models import (
    Item, Message, Order, Wishlist, CartItem, Conversation, ChatMessage, Withdrawal,
    SellerWallet, Dispute, DisputeEvidence, DisputeMessage, Review,
    ReputationProfile, TrustBadge,
)
from users.models import CustomUser
from users.serializers import UserSerializer

CATEGORY_CHOICES = [
    ('Electronics', 'Electronics'),
    ('Books', 'Books'),
    ('Furniture', 'Furniture'),
    ('Services', 'Services'),
    ('Others', 'Others'),
]

class ProductSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source='seller.username', read_only=True)
    seller_profile_picture = serializers.ImageField(source='seller.profile_picture', read_only=True)
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Item
        fields = ['id', 'title', 'description', 'price', 'category', 'condition', 'location', 'image', 'image_url', 'status', 'units_available', 'created_at', 'seller', 'seller_name', 'seller_profile_picture', 'university']
        read_only_fields = ['id', 'seller', 'created_at', 'university']
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None

class MarketplaceProductSerializer(ProductSerializer):
    """Public serializer for marketplace - same as ProductSerializer"""
    pass

class CreateProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['title', 'description', 'price', 'category', 'condition', 'location', 'image', 'units_available']
    
    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Price must be positive.')
        return value
    
    def validate_category(self, value):
        if value not in dict(CATEGORY_CHOICES):
            raise serializers.ValidationError('Invalid category.')
        return value

    def validate_units_available(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError('Units must be at least 1.')
        return value

class MessageSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.username', read_only=True)
    product_title = serializers.CharField(source='product.title', read_only=True)
    
    class Meta:
        model = Message
        fields = ['id', 'product', 'product_title', 'buyer', 'buyer_name', 'message', 'timestamp', 'is_read']
        read_only_fields = ['id', 'buyer', 'seller', 'timestamp', 'is_read']

class ConversationSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.username', read_only=True)
    seller_name = serializers.CharField(source='seller.username', read_only=True)
    order_name = serializers.CharField(source='order.product.title', read_only=True)
    order_price = serializers.DecimalField(source='order.price', max_digits=10, decimal_places=2, read_only=True)
    last_message = serializers.SerializerMethodField()
    last_activity = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'order',
            'buyer',
            'seller',
            'buyer_name',
            'seller_name',
            'order_name',
            'order_price',
            'last_message',
            'last_activity',
            'created_at',
            'updated_at'
        ]
        read_only_fields = fields

    def get_last_message(self, obj):
        last = obj.messages.order_by('-timestamp').first()
        return last.text if last else ""

    def get_last_activity(self, obj):
        last = obj.messages.order_by('-timestamp').first()
        return (last.timestamp if last else obj.updated_at).isoformat()

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    receiver = serializers.PrimaryKeyRelatedField(read_only=True)
    receiver_id = serializers.IntegerField(source="receiver.id", read_only=True)
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    message_text = serializers.CharField(source="text", read_only=True)
    order_name = serializers.SerializerMethodField()
    conversation_order_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'conversation',
            'sender',
            'sender_id',
            'receiver',
            'receiver_id',
            'sender_name',
            'text',
            'message_text',
            'timestamp',
            'read_status',
            'order_name',
            'conversation_order_name',
        ]
        read_only_fields = [
            'id', 'conversation', 'sender', 'sender_id', 'receiver', 'receiver_id',
            'sender_name', 'timestamp', 'read_status', 'message_text', 'order_name',
            'conversation_order_name',
        ]

    def get_order_name(self, obj):
        order = getattr(obj.conversation, 'order', None)
        product = getattr(order, 'product', None) if order else None
        return product.title if product else ''

    def get_conversation_order_name(self, obj):
        return self.get_order_name(obj)

class OrderSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True)
    seller_name = serializers.CharField(source='seller.username', read_only=True)
    buyer_name = serializers.CharField(source='buyer.username', read_only=True)
    image_url = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    escrow_fee = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    dispute_evidence_url = serializers.SerializerMethodField()
    buyer_review = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'product',
            'product_title',
            'seller',
            'seller_name',
            'buyer',
            'buyer_name',
            'price',
            'quantity',
            'status',
            'escrow_status',
            'payment_reference',
            'payment_phone',
            'paid_at',
            'delivered_at',
            'completed_at',
            'dispute_reason',
            'dispute_description',
            'dispute_evidence_image',
            'dispute_evidence_url',
            'disputed_at',
            'buyer_review',
            'created_at',
            'image_url',
            'subtotal',
            'escrow_fee',
            'discount_amount',
            'total_amount',
        ]
        read_only_fields = [
            'id',
            'product',
            'seller',
            'buyer',
            'created_at',
            'paid_at',
            'delivered_at',
            'completed_at',
            'disputed_at'
        ]
    
    def get_image_url(self, obj):
        if obj.product and obj.product.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.product.image.url)
        return None

    def _payment_or_calculate(self, obj):
        payment = getattr(obj, 'payment_record', None)
        if payment:
            return payment
        from .escrow_services import calculate_order_amounts
        return calculate_order_amounts(obj, obj.buyer)

    def get_subtotal(self, obj):
        payment = getattr(obj, 'payment_record', None)
        if payment:
            return payment.subtotal
        return obj.price

    def get_escrow_fee(self, obj):
        payment = getattr(obj, 'payment_record', None)
        if payment:
            return payment.escrow_fee
        amounts = self._payment_or_calculate(obj)
        return amounts.get('escrow_fee', 0)

    def get_discount_amount(self, obj):
        payment = getattr(obj, 'payment_record', None)
        if payment:
            return payment.discount_amount
        amounts = self._payment_or_calculate(obj)
        return amounts.get('discount_amount', 0)

    def get_total_amount(self, obj):
        payment = getattr(obj, 'payment_record', None)
        if payment:
            return payment.amount
        amounts = self._payment_or_calculate(obj)
        return amounts.get('total_amount', obj.price)

    def get_dispute_evidence_url(self, obj):
        if obj.dispute_evidence_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.dispute_evidence_image.url)
        return None

    def get_buyer_review(self, obj):
        review = getattr(obj, 'review', None)
        if not review:
            return None
        return {
            'id': review.id,
            'rating': review.rating,
            'review_text': review.review_text,
            'created_at': review.created_at.isoformat() if review.created_at else None,
        }

class CreateOrderSerializer(serializers.ModelSerializer):
    quantity = serializers.IntegerField(min_value=1, default=1, required=False)

    class Meta:
        model = Order
        fields = ['product', 'price', 'quantity']

    def validate(self, data):
        product = data['product']
        qty = max(1, int(data.get('quantity') or 1))
        data['quantity'] = qty
        if data['price'] <= 0:
            raise serializers.ValidationError('Price must be positive.')
        if product.status != 'available':
            raise serializers.ValidationError('This item is not available.')
        if product.units_available < qty:
            raise serializers.ValidationError('Item is out of stock')
        if product.seller_id == self.context['request'].user.id:
            raise serializers.ValidationError('You cannot purchase your own listing.')
        return data

    def create(self, validated_data):
        product = validated_data['product']
        qty = validated_data.pop('quantity', 1)
        validated_data['buyer'] = self.context['request'].user
        validated_data['seller'] = product.seller
        validated_data['quantity'] = qty
        validated_data.setdefault('status', Order.STATUS_PENDING_PAYMENT)
        order = super().create(validated_data)

        from .models import Notification, Conversation
        Conversation.objects.get_or_create(
            order=order,
            defaults={'buyer': order.buyer, 'seller': order.seller},
        )
        Notification.objects.create(
            user=order.seller,
            order=order,
            title='New order awaiting payment',
            message=f'{order.buyer.username} started checkout for {product.title}.',
        )
        return order

class WishlistSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True)
    seller_name = serializers.CharField(source='product.seller.username', read_only=True)
    
    class Meta:
        model = Wishlist
        fields = ['id', 'product', 'product_title', 'seller_name', 'added_at']
        read_only_fields = ['id', 'added_at']


class CartItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_title = serializers.CharField(source='product.title', read_only=True)
    seller_name = serializers.CharField(source='product.seller.username', read_only=True)
    seller_id = serializers.IntegerField(source='product.seller.id', read_only=True)
    price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    image_url = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    units_available = serializers.IntegerField(source='product.units_available', read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id', 'product_id', 'product_title', 'seller_name', 'seller_id',
            'price', 'quantity', 'subtotal', 'image_url', 'units_available', 'added_at',
        ]
        read_only_fields = fields

    def get_image_url(self, obj):
        request = self.context.get('request')
        product = obj.product
        if product.image:
            url = product.image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_subtotal(self, obj):
        return float(obj.product.price * obj.quantity)


class CartSerializer(serializers.Serializer):
    items = CartItemSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    item_count = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerWallet
        fields = [
            'available_balance',
            'pending_balance',
            'held_balance',
            'total_earnings',
            'total_withdrawn',
            'withdrawn_total',
            'pending_withdrawals',
            'updated_at',
        ]


class WithdrawalSerializer(serializers.ModelSerializer):
    display_status = serializers.SerializerMethodField()
    method = serializers.CharField(source='payout_method', read_only=True)

    class Meta:
        model = Withdrawal
        fields = [
            'id',
            'reference_id',
            'amount',
            'phone_number',
            'payout_method',
            'method',
            'payout_details',
            'status',
            'display_status',
            'mpesa_receipt',
            'conversation_id',
            'originator_conversation_id',
            'response_description',
            'result_description',
            'failed_reason',
            'created_at',
            'completed_at',
        ]

    def get_display_status(self, obj):
        status = (obj.status or '').lower()
        if status == 'processing':
            return 'Processing'
        if status == 'completed':
            return 'Success'
        if status in ('failed', 'cancelled'):
            return 'Failed'
        return 'Pending'


class DisputeEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisputeEvidence
        fields = ['id', 'uploaded_by', 'evidence_type', 'file', 'message', 'created_at']
        read_only_fields = ['id', 'uploaded_by', 'created_at']


class DisputeSerializer(serializers.ModelSerializer):
    evidence = DisputeEvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = Dispute
        fields = [
            'id', 'order', 'buyer', 'seller', 'reason', 'detailed_description',
            'status', 'priority', 'priority_level', 'response_deadline', 'seller_response',
            'ai_recommendation', 'confidence_score', 'fraud_score', 'resolution',
            'refund_percentage', 'auto_resolved', 'escalated_to_admin', 'admin_notes',
            'resolution_note', 'resolved_by', 'created_at', 'resolved_at', 'evidence',
        ]
        read_only_fields = ['id', 'buyer', 'seller', 'resolved_by', 'created_at', 'resolved_at']


class DisputeMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = DisputeMessage
        fields = ['id', 'sender', 'sender_name', 'message', 'attachment', 'attachment_url', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url


class TrustSummarySerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    trust_score = serializers.DecimalField(max_digits=5, decimal_places=2)
    risk_level = serializers.CharField()
    trust_badge = serializers.CharField(allow_blank=True)
    badges = serializers.ListField(child=serializers.CharField())
    completed_orders = serializers.IntegerField(required=False)
    completed_sales = serializers.IntegerField(required=False)
    dispute_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    repeat_offender = serializers.BooleanField()


def _trust_summary_for_user(user):
    from .trust_services import recalculate_reputation_for_user, trust_summary_dict
    profile = recalculate_reputation_for_user(user)
    return trust_summary_dict(profile)


class DisputeDetailSerializer(serializers.ModelSerializer):
    evidence = DisputeEvidenceSerializer(many=True, read_only=True)
    messages = DisputeMessageSerializer(many=True, read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    product_title = serializers.CharField(source='order.product.title', read_only=True)
    amount = serializers.DecimalField(source='order.price', max_digits=10, decimal_places=2, read_only=True)
    buyer_username = serializers.SerializerMethodField()
    seller_username = serializers.SerializerMethodField()
    buyer_trust = serializers.SerializerMethodField()
    seller_trust = serializers.SerializerMethodField()
    admin_decision = serializers.SerializerMethodField()
    evidence_urls = serializers.SerializerMethodField()

    class Meta:
        model = Dispute
        fields = [
            'id', 'order', 'order_id', 'buyer', 'seller', 'title', 'reason', 'description',
            'detailed_description', 'status', 'priority', 'priority_level', 'response_deadline',
            'seller_response', 'seller_responded_at', 'resolution', 'resolution_note',
            'admin_notes', 'refund_percentage', 'product_title', 'amount',
            'buyer_username', 'seller_username', 'buyer_trust', 'seller_trust',
            'admin_decision', 'evidence', 'evidence_urls', 'messages',
            'created_at', 'updated_at', 'resolved_at',
        ]

    def get_buyer_username(self, obj):
        u = obj.buyer or getattr(obj.order, 'buyer', None)
        return u.username if u else ''

    def get_seller_username(self, obj):
        u = obj.seller or getattr(obj.order, 'seller', None)
        return u.username if u else ''

    def get_buyer_trust(self, obj):
        u = obj.buyer or getattr(obj.order, 'buyer', None)
        return _trust_summary_for_user(u) if u else None

    def get_seller_trust(self, obj):
        u = obj.seller or getattr(obj.order, 'seller', None)
        return _trust_summary_for_user(u) if u else None

    def get_admin_decision(self, obj):
        if obj.status not in (
            Dispute.STATUS_REFUNDED, Dispute.STATUS_RELEASED, Dispute.STATUS_REJECTED,
            Dispute.STATUS_RESOLVED, Dispute.STATUS_CLOSED, Dispute.STATUS_AUTO_RESOLVED,
        ) and not obj.resolution_note:
            return None

        if obj.refund_percentage and 0 < float(obj.refund_percentage) < 100:
            decision_label = 'Split Between Buyer and Seller'
            decision_code = 'SPLIT'
        elif obj.status == Dispute.STATUS_REFUNDED:
            decision_label = 'Refunded to Buyer'
            decision_code = 'REFUND'
        elif obj.status == Dispute.STATUS_RELEASED:
            decision_label = 'Released to Seller'
            decision_code = 'RELEASE'
        elif obj.status == Dispute.STATUS_REJECTED:
            decision_label = 'Dispute Rejected'
            decision_code = 'REJECT'
        else:
            decision_label = obj.resolution or 'Resolved'
            decision_code = 'REVIEW'

        admin_comment = (obj.resolution_note or obj.admin_notes or '').strip()
        return {
            'decision': decision_code,
            'decision_label': decision_label,
            'resolution_summary': obj.resolution or obj.resolution_note or '',
            'admin_notes': obj.admin_notes or '',
            'admin_comment': admin_comment,
            'status': obj.status,
        }

    def get_evidence_urls(self, obj):
        request = self.context.get('request')
        urls = []
        for ev in obj.evidence.all():
            if ev.file:
                url = ev.file.url
                if request:
                    url = request.build_absolute_uri(url)
                urls.append({'id': ev.id, 'url': url, 'type': ev.evidence_type})
        order = obj.order
        if order and order.dispute_evidence_image:
            url = order.dispute_evidence_image.url
            if request:
                url = request.build_absolute_uri(url)
            urls.append({'id': 'order', 'url': url, 'type': 'image'})
        return urls


class ReviewSerializer(serializers.ModelSerializer):
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    product_title = serializers.CharField(source='order.product.title', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'order', 'order_id', 'buyer', 'buyer_username', 'seller',
            'rating', 'communication_rating', 'delivery_rating', 'professionalism_rating',
            'quality_rating', 'review_text', 'verified_purchase', 'moderation_status',
            'product_title', 'created_at',
        ]
        read_only_fields = ['buyer', 'seller', 'verified_purchase', 'moderation_status', 'created_at']


class ReputationProfileSerializer(serializers.ModelSerializer):
    badges = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    member_since = serializers.DateTimeField(source='user.date_joined', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = ReputationProfile
        fields = [
            'user', 'username', 'role', 'member_since', 'trust_score', 'risk_level',
            'trust_badge', 'average_rating', 'total_reviews', 'successful_transactions',
            'completed_orders', 'completed_sales', 'disputes_opened', 'disputes_won',
            'disputes_lost', 'cancelled_orders', 'dispute_rate', 'refund_rate',
            'response_rate', 'repeat_offender', 'badges', 'verified_phone',
            'verified_email', 'last_calculated', 'updated_at',
        ]

    def get_badges(self, obj):
        return [b.name for b in TrustBadge.objects.filter(user=obj.user).order_by('-awarded_at')[:10]]

