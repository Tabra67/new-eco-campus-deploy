from django.conf import settings
from django.db import models


class AdminActionLog(models.Model):
    ACTION_REFUND = 'refund'
    ACTION_RELEASE_ESCROW = 'release_escrow'
    ACTION_BAN_USER = 'ban_user'
    ACTION_DELETE_USER = 'delete_user'
    ACTION_APPROVE_WITHDRAWAL = 'approve_withdrawal'
    ACTION_REJECT_WITHDRAWAL = 'reject_withdrawal'
    ACTION_DISPUTE_UNDER_REVIEW = 'dispute_under_review'
    ACTION_DISPUTE_REJECT = 'dispute_reject'

    ACTION_CHOICES = [
        (ACTION_REFUND, 'Refund buyer'),
        (ACTION_RELEASE_ESCROW, 'Release escrow to seller'),
        (ACTION_BAN_USER, 'Ban user'),
        (ACTION_DELETE_USER, 'Delete user'),
        (ACTION_APPROVE_WITHDRAWAL, 'Approve withdrawal'),
        (ACTION_REJECT_WITHDRAWAL, 'Reject withdrawal'),
        (ACTION_DISPUTE_UNDER_REVIEW, 'Mark dispute under review'),
        (ACTION_DISPUTE_REJECT, 'Reject dispute'),
    ]

    admin_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='admin_action_logs',
    )
    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES)
    target_object = models.CharField(max_length=255)
    notes = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action_type} by {self.admin_user_id} on {self.target_object}"
