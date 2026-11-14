from django.urls import path

from . import views

urlpatterns = [
    path('balance/', views.seller_wallet, name='wallet-balance-public'),
    path('withdraw/', views.seller_withdrawals, name='wallet-withdraw-public'),
    path('withdrawals/', views.seller_withdrawals, name='wallet-withdrawals-public'),
]
