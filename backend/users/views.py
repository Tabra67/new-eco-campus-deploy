"""
API Views for the users app.
"""
import random
import string
from rest_framework import generics, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authentication import TokenAuthentication
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import CustomUser, University, EmailVerification, PasswordReset
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer, 
    ProfileUpdateSerializer, PasswordResetRequestSerializer,
    PasswordResetVerifySerializer, PasswordResetCompleteSerializer
)
from .utils import verify_otp


class RegisterView(generics.CreateAPIView):
    """
    API endpoint for user registration.
    Creates user as inactive and sends OTP verification email.
    """
    queryset = CustomUser.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Return success response with instructions
        return Response({
            'message': 'Registration successful. Please check your email for verification code.',
            'email': user.email,
            'user_id': user.id
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    API endpoint for user login.
    """
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Check if account is deactivated
        if not user.is_active:
            return Response(
                {'error': 'Account is deactivated. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        token, created = Token.objects.get_or_create(user=user)
        refresh = RefreshToken.for_user(user)
        print(f"LOGIN VIEW - USER ROLE FROM DB: {getattr(user, 'role', 'NO_ROLE_FIELD')}")
        user_serializer = UserSerializer(user, context={'request': self.request})
        return Response({
            "token": token.key,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user_serializer.data
        })


class VerifyEmailView(APIView):
    """
    API endpoint to verify email using OTP code.
    Accepts email and code, validates OTP, and activates the user.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        
        # Validate input
        if not email or not code:
            return Response(
                {'error': 'Email and code are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user exists
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'No account found with this email.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if already verified
        if user.is_verified:
            return Response(
                {'message': 'Email is already verified. You can login.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify OTP
        is_valid, message = verify_otp(user, code)
        
        if not is_valid:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Success - return user info
        return Response({
            'message': 'Email verified successfully! You can now login.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }, status=status.HTTP_200_OK)


class ResendOTPView(APIView):
    """
    API endpoint to resend OTP verification email.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return Response(
                {'error': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'No account found with this email.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if user.is_verified:
            return Response(
                {'message': 'Email is already verified.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate and send new OTP
        from .utils import generate_and_send_otp
        
        try:
            verification, success = generate_and_send_otp(user)
            if success:
                return Response({
                    'message': 'Verification code sent to your email.'
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': 'Failed to send verification email. Please try again.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except Exception as e:
            return Response(
                {'error': f'Error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserDetailView(generics.RetrieveUpdateAPIView):
    """
    API endpoint to get and update current user details.
    Requires token authentication.
    """
    serializer_class = UserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        """Get current user details."""
        user = request.user
        serializer = self.get_serializer(user)
        return Response(serializer.data)

# ==================== Password Reset Views ====================

def generate_password_otp():
    """Generate a 6-digit OTP for password reset."""
    return ''.join(random.choices(string.digits, k=6))


def send_password_reset_email(user, otp_code):
    """
    Send password reset email with OTP code.
    
    Args:
        user: The CustomUser instance
        otp_code: The 6-digit OTP code
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    subject = 'Password Reset - Eco-Campus'
    message = f"""
    Password Reset Request for Eco-Campus
    
    Your password reset code is: {otp_code}
    
    This code will expire in 10 minutes.
    
    If you didn't request a password reset, please ignore this email.
    
    Best regards,
    Eco-Campus Team
    """
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return False


class PasswordResetRequestView(APIView):
    """
    API endpoint to request password reset.
    Accepts email, generates OTP, and sends it via email.
    """
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            # Don't reveal if email exists
            return Response({
                'message': 'If an account exists with this email, a password reset code has been sent.'
            }, status=status.HTTP_200_OK)
        
        # Generate OTP
        otp_code = generate_password_otp()
        
        # Mark any existing unused OTPs as used
        PasswordReset.objects.filter(user=user, is_used=False).update(is_used=True)
        
        # Create new password reset record
        password_reset = PasswordReset.objects.create(
            user=user,
            code=otp_code,
            is_used=False
        )
        
        # Send email
        success = send_password_reset_email(user, otp_code)
        
        if success:
            return Response({
                'message': 'Password reset code sent to your email.',
                'email': email
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Failed to send password reset email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PasswordResetVerifyView(APIView):
    """
    API endpoint to verify password reset OTP.
    """
    permission_classes = [AllowAny]
    serializer_class = PasswordResetVerifySerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['code']
        
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Invalid email or code.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get the latest unused password reset record
            password_reset = PasswordReset.objects.filter(
                user=user,
                is_used=False
            ).latest('created_at')
        except PasswordReset.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired verification code.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if OTP is correct
        if password_reset.code != otp_code:
            return Response(
                {'error': 'Invalid verification code.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if OTP has expired (10 minutes)
        if not password_reset.is_valid():
            return Response(
                {'error': 'Verification code has expired. Please request a new code.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Mark OTP as used
        password_reset.is_used = True
        password_reset.save()
        
        return Response({
            'message': 'Verification successful. Please enter your new password.',
            'verified': True
        }, status=status.HTTP_200_OK)


class PasswordResetCompleteView(APIView):
    """
    API endpoint to reset password after OTP verification.
    """
    permission_classes = [AllowAny]
    serializer_class = PasswordResetCompleteSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']
        
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Invalid request.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify the OTP was used
        try:
            password_reset = PasswordReset.objects.filter(
                user=user,
                code=otp_code,
                is_used=True
            ).latest('created_at')
        except PasswordReset.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired verification code.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': 'Password reset successfully. You can now login with your new password.'
        }, status=status.HTTP_200_OK)


# ==================== Profile Management Views ====================

class ProfileViewSet(viewsets.ModelViewSet):
    """
    API endpoint for profile management.
    Supports retrieve, update, partial_update, and destroy (deactivate).
    """
    serializer_class = ProfileUpdateSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_object(self):
        return self.request.user
    
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return ProfileUpdateSerializer
        return UserSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Get current user profile."""
        user = request.user
        print(f"PROFILE RETRIEVE - USER ROLE FROM DB: {getattr(user, 'role', 'NO_ROLE_FIELD')}")
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Full profile update."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def partial_update(self, request, *args, **kwargs):
        """PATCH profile update - matches frontend expectations."""
        kwargs['partial'] = True
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'message': 'Profile updated successfully.',
            'profile': serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """Deactivate user account."""
        user = self.request.user
        user.is_active = False
        user.save()
        
        # Delete auth token
        Token.objects.filter(user=user).delete()
        
        return Response({
            'message': 'Account deactivated successfully.'
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    API endpoint to change password for authenticated users.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]
    
    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        
        # Validate input
        if not old_password or not new_password or not confirm_password:
            return Response(
                {'error': 'All password fields are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if old password is correct
        if not user.check_password(old_password):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if new passwords match
        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        # Generate new token
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        
        return Response({
            'message': 'Password changed successfully.',
            'token': token.key
        }, status=status.HTTP_200_OK)


# ==================== Dashboard View ====================

class DashboardView(APIView):
    """
    API endpoint to get dashboard data for authenticated users.
    Returns user profile info for the dashboard display.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]
    
    def get(self, request):
        user = request.user
        token, _ = Token.objects.get_or_create(user=user)
        print(f"DASHBOARD VIEW - USER ROLE FROM DB: {getattr(user, 'role', 'NO_ROLE_FIELD')}")
        user_serializer = UserSerializer(user, context={'request': self.request})
        return Response({
    "token": token.key,
    "user": user_serializer.data
})

