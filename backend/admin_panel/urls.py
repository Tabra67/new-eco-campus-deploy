from django.urls import path

from marketplace import trust_views
from .views import (
    AdminLoginView,
    AdminMeView,
    AdminOverviewView,
    AdminUserListView,
    AdminUserBanView,
    AdminUserDeleteView,
    AdminDisputeListView,
    AdminDisputeActionView,
    AdminWithdrawalListView,
    AdminWithdrawalActionView,
)

urlpatterns = [
    path('login/', AdminLoginView.as_view(), name='admin-login'),
    path('me/', AdminMeView.as_view(), name='admin-me'),
    path('overview/', AdminOverviewView.as_view(), name='admin-overview'),
    path('users/', AdminUserListView.as_view(), name='admin-users'),
    path('users/<int:user_id>/ban/', AdminUserBanView.as_view(), name='admin-user-ban'),
    path('users/<int:user_id>/delete/', AdminUserDeleteView.as_view(), name='admin-user-delete'),
    path('disputes/', AdminDisputeListView.as_view(), name='admin-disputes'),
    path('disputes/<int:dispute_id>/action/', AdminDisputeActionView.as_view(), name='admin-dispute-action'),
    path('withdrawals/', AdminWithdrawalListView.as_view(), name='admin-withdrawals'),
    path('withdrawals/<int:withdrawal_id>/action/', AdminWithdrawalActionView.as_view(), name='admin-withdrawal-action'),
    path('trust/dashboard/', trust_views.trust_dashboard, name='admin-trust-dashboard'),
    path('trust/flagged/', trust_views.flagged_users, name='admin-trust-flagged'),
]
