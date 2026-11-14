from django.db import models
from users.models import CustomUser, University

CATEGORY_CHOICES = [
    ('Electronics', 'Electronics'),
    ('Books', 'Books'),
    ('Furniture', 'Furniture'),
    ('Services', 'Services'),
    ('Others', 'Others'),
]

class Item(models.Model):
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='products')
    university = models.ForeignKey(University, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='Others')
    condition = models.CharField(max_length=10, choices=[('New', 'New'), ('Used', 'Used')], default='New')
    location = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    status = models.CharField(max_length=50, default='available')
    units_available = models.IntegerField(default=1)
    views = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Message(models.Model):
    product = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='messages')
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.buyer.username} -> {self.seller.username}: {self.message[:50]}"

    class Meta:
        ordering = ['-timestamp']

class Order(models.Model):
    # New canonical statuses (lowercase snake_case)
    STATUS_PENDING_PAYMENT = 'pending_payment'
    STATUS_PAID = 'paid'
    STATUS_PROCESSING = 'processing'
    STATUS_SHIPPED = 'shipped'
    STATUS_DELIVERED = 'delivered'
    STATUS_COMPLETED = 'completed'
    STATUS_DISPUTED = 'disputed'
    STATUS_CANCELLED = 'cancelled'

    # Legacy aliases kept for migration compatibility
    STATUS_ORDER_PLACED = STATUS_PENDING_PAYMENT
    STATUS_PENDING = STATUS_PENDING_PAYMENT
    STATUS_CONFIRMED = STATUS_PROCESSING

    STATUS_CHOICES = [
        (STATUS_PENDING_PAYMENT, 'Pending Payment'),
        (STATUS_PAID, 'Paid'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_SHIPPED, 'Shipped'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_DISPUTED, 'Disputed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='buyer_orders')
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='seller_orders')
    product = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='orders')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING_PAYMENT)
    # Escrow and payment tracking
    escrow_status = models.CharField(max_length=20, default='NONE')
    payment_reference = models.CharField(max_length=120, blank=True, null=True)
    payment_phone = models.CharField(max_length=20, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    # Dispute metadata
    dispute_reason = models.CharField(max_length=120, blank=True, null=True)
    dispute_description = models.TextField(blank=True, null=True)
    dispute_evidence_image = models.ImageField(upload_to='disputes/', blank=True, null=True)
    disputed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    VALID_TRANSITIONS = {
        STATUS_PENDING_PAYMENT: [STATUS_PAID, STATUS_CANCELLED],
        STATUS_PAID: [STATUS_PROCESSING, STATUS_DELIVERED, STATUS_CANCELLED],
        STATUS_PROCESSING: [STATUS_SHIPPED],
        STATUS_SHIPPED: [STATUS_DELIVERED],
        STATUS_DELIVERED: [STATUS_COMPLETED, STATUS_DISPUTED],
        STATUS_DISPUTED: [],
        STATUS_COMPLETED: [],
        STATUS_CANCELLED: [],
    }

    def can_transition_to(self, next_status: str) -> bool:
        return next_status in self.VALID_TRANSITIONS.get(self.status, [])

    def transition_to(self, next_status: str):
        if not self.can_transition_to(next_status):
            raise ValueError(f"Invalid transition from {self.status} to {next_status}")
        self.status = next_status

    def __str__(self):
        return f"Order {self.id} - {self.product.title} by {self.buyer.username}"

    class Meta:
        ordering = ['-created_at']

class Conversation(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='conversation')
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='buyer_conversations')
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='seller_conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversation(order={self.order_id}, buyer={self.buyer_id}, seller={self.seller_id})"

    class Meta:
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['order', 'buyer', 'seller'], name='unique_order_buyer_seller_conversation'),
        ]

class ChatMessage(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='chat_messages')
    receiver = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='received_chat_messages',
        null=True,
        blank=True,
    )
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    read_status = models.BooleanField(default=False)

    def __str__(self):
        return f"ChatMessage(conversation={self.conversation_id}, sender={self.sender_id})"

    class Meta:
        ordering = ['timestamp']

class Payment(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_HELD_IN_ESCROW = 'HELD_IN_ESCROW'
    STATUS_RELEASED = 'RELEASED'
    STATUS_REFUNDED = 'REFUNDED'
    STATUS_FAILED = 'FAILED'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_HELD_IN_ESCROW, 'Held In Escrow'),
        (STATUS_RELEASED, 'Released'),
        (STATUS_REFUNDED, 'Refunded'),
        (STATUS_FAILED, 'Failed'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment_record')
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='payments')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    escrow_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    phone = models.CharField(max_length=20, blank=True, null=True)
    mpesa_checkout_request_id = models.CharField(max_length=120, blank=True, null=True, db_index=True)
    mpesa_merchant_request_id = models.CharField(max_length=120, blank=True, null=True)
    mpesa_receipt_number = models.CharField(max_length=120, blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class EscrowTransaction(models.Model):
    STATUS_HELD = 'HELD'
    STATUS_RELEASED = 'RELEASED'
    STATUS_REFUNDED = 'REFUNDED'
    STATUS_FROZEN = 'FROZEN'

    STATUS_CHOICES = [
        (STATUS_HELD, 'Held'),
        (STATUS_RELEASED, 'Released'),
        (STATUS_REFUNDED, 'Refunded'),
        (STATUS_FROZEN, 'Frozen'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='escrow_transaction')
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='escrow_transactions')
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='buyer_escrow_transactions', null=True, blank=True)
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='seller_escrow_transactions', null=True, blank=True)
    amount_held = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_HELD)
    payment_status = models.CharField(max_length=30, default='pending')
    released_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class BuyerDiscountUsage(models.Model):
    buyer = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='first_order_discount')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='discount_usage')
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    applied_at = models.DateTimeField(auto_now_add=True)


class CheckoutSession(models.Model):
    """Pay-first checkout: order is created only after successful M-Pesa payment."""
    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_EXPIRED = 'expired'

    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='checkout_sessions')
    product = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='checkout_sessions')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    phone = models.CharField(max_length=20, blank=True, default='')
    status = models.CharField(max_length=20, default=STATUS_PENDING)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='checkout_sessions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class SellerWallet(models.Model):
    seller = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='seller_wallet')
    available_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pending_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_withdrawn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    held_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    withdrawn_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pending_withdrawals = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet({self.seller.username}) avail={self.available_balance}"


class MpesaTransaction(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_TIMEOUT = 'timeout'

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='mpesa_transactions', null=True, blank=True)
    checkout_session = models.ForeignKey(
        CheckoutSession,
        on_delete=models.CASCADE,
        related_name='mpesa_transactions',
        null=True,
        blank=True,
    )
    checkout_request_id = models.CharField(max_length=120, unique=True, db_index=True)
    merchant_request_id = models.CharField(max_length=120, blank=True, null=True)
    phone = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default=STATUS_PENDING)
    result_code = models.CharField(max_length=20, blank=True, null=True)
    result_desc = models.CharField(max_length=255, blank=True, null=True)
    receipt_number = models.CharField(max_length=120, blank=True, null=True)
    raw_callback = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class Notification(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Wishlist(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='wishlist_items')
    product = models.ForeignKey(Item, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.product.title}"

    class Meta:
        unique_together = ('user', 'product')
        ordering = ['-added_at']


class Cart(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='cart')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart({self.user.username})"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Item, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('cart', 'product')
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.product.title} x{self.quantity}"


class Dispute(models.Model):
    STATUS_OPEN = 'OPEN'
    STATUS_AWAITING_SELLER_RESPONSE = 'AWAITING_SELLER_RESPONSE'
    STATUS_UNDER_REVIEW = 'UNDER_REVIEW'
    STATUS_AUTO_RESOLVED = 'AUTO_RESOLVED'
    STATUS_ESCALATED = 'ESCALATED'
    STATUS_RESOLVED = 'RESOLVED'
    STATUS_CLOSED = 'CLOSED'
    STATUS_REFUNDED = 'REFUNDED'
    STATUS_RELEASED = 'RELEASED'
    STATUS_REJECTED = 'REJECTED'

    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_AWAITING_SELLER_RESPONSE, 'Awaiting Seller Response'),
        (STATUS_UNDER_REVIEW, 'Under Review'),
        (STATUS_AUTO_RESOLVED, 'Auto Resolved'),
        (STATUS_ESCALATED, 'Escalated'),
        (STATUS_RESOLVED, 'Resolved'),
        (STATUS_CLOSED, 'Closed'),
        (STATUS_REFUNDED, 'Refunded'),
        (STATUS_RELEASED, 'Released to Seller'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_HIGH = 'high'
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_MEDIUM, 'Medium'),
        (PRIORITY_HIGH, 'High'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='dispute_record')
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='buyer_disputes', null=True, blank=True)
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='seller_disputes', null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    reason = models.CharField(max_length=255, blank=True, default='')
    detailed_description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_OPEN)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    priority_level = models.CharField(max_length=20, default='medium')
    response_deadline = models.DateTimeField(blank=True, null=True)
    seller_response = models.TextField(blank=True, default='')
    seller_responded_at = models.DateTimeField(blank=True, null=True)
    ai_recommendation = models.JSONField(blank=True, null=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fraud_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    resolution = models.TextField(blank=True, default='')
    refund_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    auto_resolved = models.BooleanField(default=False)
    escalated_to_admin = models.BooleanField(default=False)
    admin_notes = models.TextField(blank=True, default='')
    resolution_note = models.TextField(blank=True, default='')
    resolved_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_disputes',
    )
    resolved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Dispute #{self.id} - Order {self.order_id} ({self.status})"


class Withdrawal(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REJECTED = STATUS_FAILED
    # Legacy admin approval status
    STATUS_APPROVED = STATUS_COMPLETED

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='withdrawals')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    reference_id = models.CharField(max_length=32, unique=True, blank=True, null=True)
    payout_method = models.CharField(max_length=50, blank=True, default='')
    payout_details = models.TextField(blank=True, default='')
    phone_number = models.CharField(max_length=20, blank=True, default='')
    mpesa_receipt = models.CharField(max_length=120, blank=True, default='')
    conversation_id = models.CharField(max_length=120, blank=True, default='', db_index=True)
    originator_conversation_id = models.CharField(max_length=120, blank=True, default='', db_index=True)
    response_description = models.TextField(blank=True, default='')
    result_description = models.TextField(blank=True, default='')
    failed_reason = models.TextField(blank=True, default='')
    idempotency_key = models.CharField(max_length=80, blank=True, null=True, unique=True)
    rejection_reason = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_withdrawals',
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.reference_id:
            import uuid
            self.reference_id = f"WD-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Withdrawal #{self.id} - {self.seller.username} ({self.status})"


class SupportThread(models.Model):
    """Admin ↔ buyer/seller messaging threads."""
    THREAD_ADMIN_BUYER = 'admin_buyer'
    THREAD_ADMIN_SELLER = 'admin_seller'
    THREAD_BUYER_SELLER = 'buyer_seller'

    THREAD_CHOICES = [
        (THREAD_ADMIN_BUYER, 'Admin-Buyer'),
        (THREAD_ADMIN_SELLER, 'Admin-Seller'),
        (THREAD_BUYER_SELLER, 'Buyer-Seller'),
    ]

    thread_type = models.CharField(max_length=20, choices=THREAD_CHOICES, default=THREAD_BUYER_SELLER)
    admin = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='admin_support_threads',
        null=True,
        blank=True,
    )
    buyer = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='buyer_support_threads',
        null=True,
        blank=True,
    )
    seller = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='seller_support_threads',
        null=True,
        blank=True,
    )
    product = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_threads')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_threads')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class SupportMessage(models.Model):
    thread = models.ForeignKey(SupportThread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='support_messages_sent')
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    read_status = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']


class DisputeMessage(models.Model):
    dispute = models.ForeignKey(Dispute, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='dispute_messages_sent')
    message = models.TextField()
    attachment = models.FileField(upload_to='dispute_messages/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class DisputeEvidence(models.Model):
    EVIDENCE_IMAGE = 'image'
    EVIDENCE_DOCUMENT = 'document'
    EVIDENCE_RECEIPT = 'receipt'
    EVIDENCE_CHAT = 'chat'
    EVIDENCE_OTHER = 'other'
    EVIDENCE_CHOICES = [
        (EVIDENCE_IMAGE, 'Image'),
        (EVIDENCE_DOCUMENT, 'Document'),
        (EVIDENCE_RECEIPT, 'Receipt'),
        (EVIDENCE_CHAT, 'Chat'),
        (EVIDENCE_OTHER, 'Other'),
    ]

    dispute = models.ForeignKey(Dispute, on_delete=models.CASCADE, related_name='evidence')
    uploaded_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='dispute_evidence')
    evidence_type = models.CharField(max_length=20, choices=EVIDENCE_CHOICES, default=EVIDENCE_OTHER)
    file = models.FileField(upload_to='dispute_evidence/', blank=True, null=True)
    message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ReputationProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='reputation_profile')
    trust_score = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    authenticity_score = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    fraud_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    risk_level = models.CharField(max_length=20, default='average')
    average_rating = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    successful_transactions = models.PositiveIntegerField(default=0)
    dispute_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    refund_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cancellation_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    response_speed = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    verified_phone = models.BooleanField(default=False)
    verified_email = models.BooleanField(default=False)
    verified_payment = models.BooleanField(default=False)
    verified_identity = models.BooleanField(default=False)
    suspicious_activity_count = models.PositiveIntegerField(default=0)
    account_age_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    repeat_customer_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    completed_orders = models.PositiveIntegerField(default=0)
    completed_sales = models.PositiveIntegerField(default=0)
    disputes_opened = models.PositiveIntegerField(default=0)
    disputes_won = models.PositiveIntegerField(default=0)
    disputes_lost = models.PositiveIntegerField(default=0)
    cancelled_orders = models.PositiveIntegerField(default=0)
    response_rate = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    warning_count = models.PositiveIntegerField(default=0)
    suspension_count = models.PositiveIntegerField(default=0)
    trust_badge = models.CharField(max_length=80, blank=True, default='')
    repeat_offender = models.BooleanField(default=False)
    last_calculated = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)


class Review(models.Model):
    MODERATION_PENDING = 'pending'
    MODERATION_APPROVED = 'approved'
    MODERATION_REJECTED = 'rejected'
    MODERATION_CHOICES = [
        (MODERATION_PENDING, 'Pending'),
        (MODERATION_APPROVED, 'Approved'),
        (MODERATION_REJECTED, 'Rejected'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='review')
    buyer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='reviews_left')
    seller = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='reviews_received')
    rating = models.PositiveSmallIntegerField(default=5)
    communication_rating = models.PositiveSmallIntegerField(default=5)
    delivery_rating = models.PositiveSmallIntegerField(default=5)
    professionalism_rating = models.PositiveSmallIntegerField(default=5)
    quality_rating = models.PositiveSmallIntegerField(default=5)
    review_text = models.TextField(blank=True, default='')
    verified_purchase = models.BooleanField(default=True)
    moderation_status = models.CharField(max_length=20, choices=MODERATION_CHOICES, default=MODERATION_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class TrustBadge(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='trust_badges')
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True, default='')
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['-awarded_at']

