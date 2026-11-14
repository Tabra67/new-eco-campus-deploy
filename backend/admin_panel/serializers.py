from rest_framework import serializers

from marketplace.models import Dispute, Withdrawal
from users.models import CustomUser


class AdminUserSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'is_active', 'is_staff', 'status_label', 'date_joined']

    def get_status_label(self, obj):
        return 'ACTIVE' if obj.is_active else 'BANNED'


class AdminDisputeSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    product_title = serializers.CharField(source='order.product.title', read_only=True)
    amount = serializers.DecimalField(
        source='order.price', max_digits=10, decimal_places=2, read_only=True
    )
    buyer_username = serializers.CharField(source='order.buyer.username', read_only=True)
    seller_username = serializers.CharField(source='order.seller.username', read_only=True)
    priority_level = serializers.CharField(read_only=True)
    confidence_score = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    fraud_score = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    buyer_trust = serializers.SerializerMethodField()
    seller_trust = serializers.SerializerMethodField()
    reason = serializers.CharField(read_only=True)
    response_deadline = serializers.DateTimeField(read_only=True)
    evidence = serializers.SerializerMethodField()
    admin_decision = serializers.SerializerMethodField()

    class Meta:
        model = Dispute
        fields = [
            'id', 'title', 'description', 'reason', 'status', 'resolution', 'resolution_note',
            'admin_notes', 'order_id', 'product_title', 'amount',
            'buyer_username', 'seller_username', 'buyer_trust', 'seller_trust',
            'priority_level', 'confidence_score', 'fraud_score', 'response_deadline',
            'evidence', 'admin_decision', 'created_at', 'resolved_at',
        ]

    def get_buyer_trust(self, obj):
        from marketplace.trust_services import trust_summary_dict, recalculate_reputation_for_user
        u = obj.buyer or obj.order.buyer
        if not u:
            return None
        return trust_summary_dict(recalculate_reputation_for_user(u))

    def get_seller_trust(self, obj):
        from marketplace.trust_services import trust_summary_dict, recalculate_reputation_for_user
        u = obj.seller or obj.order.seller
        if not u:
            return None
        return trust_summary_dict(recalculate_reputation_for_user(u))

    def get_evidence(self, obj):
        request = self.context.get('request')
        items = []
        for ev in obj.evidence.all():
            if ev.file:
                url = ev.file.url
                if request:
                    url = request.build_absolute_uri(url)
                file_name = ev.file.name.split('/')[-1] if ev.file.name else f'evidence-{ev.id}'
                file_type = (ev.evidence_type or '').lower()
                if not file_type:
                    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
                    if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
                        file_type = 'image'
                    elif ext == 'pdf':
                        file_type = 'pdf'
                    else:
                        file_type = 'document'
                items.append({
                    'id': ev.id,
                    'url': url,
                    'type': file_type,
                    'name': file_name,
                })
        order = obj.order
        if order and order.dispute_evidence_image:
            url = order.dispute_evidence_image.url
            if request:
                url = request.build_absolute_uri(url)
            items.append({
                'id': 'order-evidence',
                'url': url,
                'type': 'image',
                'name': 'Order dispute evidence',
            })
        return items

    def get_admin_decision(self, obj):
        from marketplace.serializers import DisputeDetailSerializer
        return DisputeDetailSerializer().get_admin_decision(obj)


class AdminWithdrawalSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    seller_email = serializers.EmailField(source='seller.email', read_only=True)
    display_status = serializers.SerializerMethodField()
    requires_manual_review = serializers.SerializerMethodField()
    suspicious_flags = serializers.SerializerMethodField()

    class Meta:
        model = Withdrawal
        fields = [
            'id', 'reference_id', 'amount', 'status', 'display_status', 'requires_manual_review',
            'suspicious_flags', 'payout_method', 'payout_details', 'phone_number',
            'conversation_id', 'originator_conversation_id', 'mpesa_receipt', 'response_description',
            'result_description', 'failed_reason',
            'seller_username', 'seller_email', 'rejection_reason',
            'created_at', 'reviewed_at', 'completed_at',
        ]

    def get_display_status(self, obj):
        if obj.status == Withdrawal.STATUS_PROCESSING:
            return 'Processing'
        if obj.status == Withdrawal.STATUS_COMPLETED:
            return 'Success'
        if obj.status in (Withdrawal.STATUS_FAILED, Withdrawal.STATUS_CANCELLED):
            return 'Failed'
        return 'Pending'

    def get_requires_manual_review(self, obj):
        return False

    def get_suspicious_flags(self, obj):
        return []
