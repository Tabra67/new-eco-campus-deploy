# users/urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, VerifyEmailView, LoginView, ResendOTPView, 
    UserDetailView, PasswordResetRequestView, PasswordResetVerifyView,
    PasswordResetCompleteView, ProfileViewSet, ChangePasswordView,
    DashboardView
)

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, VerifyEmailView, LoginView, ResendOTPView, 
    UserDetailView, PasswordResetRequestView, PasswordResetVerifyView,
    PasswordResetCompleteView, ChangePasswordView,
    DashboardView
)
from .profile_api import ProfileAPIView

router = DefaultRouter()

urlpatterns = [
    path('profile/', ProfileAPIView.as_view(), name='profile'),
    # Authentication endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),
    path('login/', LoginView.as_view(), name='login'),
    
    # Dashboard endpoint
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    
    # User endpoints
    path('me/', UserDetailView.as_view(), name='user-detail'),
    
    # Password reset endpoints
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/verify/', PasswordResetVerifyView.as_view(), name='password-reset-verify'),
    path('password-reset/complete/', PasswordResetCompleteView.as_view(), name='password-reset-complete'),
    
    # Change password (authenticated)
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
]

# Include router URLs (no ProfileViewSet)
urlpatterns += router.urls
