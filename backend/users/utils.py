"""
Utility functions for email OTP verification.
"""
import random
import string
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import EmailVerification, CustomUser


def generate_otp():
    """
    Generate a 6-digit OTP.
    
    Returns:
        str: A 6-digit random numeric string
    """
    return ''.join(random.choices(string.digits, k=6))


def save_otp(user, code):
    """
    Save the OTP code to the EmailVerification model.
    
    Args:
        user: The CustomUser instance
        code: The 6-digit OTP code
        
    Returns:
        EmailVerification: The created verification record
    """
    # Mark any existing unused OTPs as used
    EmailVerification.objects.filter(user=user, is_used=False).update(is_used=True)
    
    # Create new verification record
    verification = EmailVerification.objects.create(
        user=user,
        code=code,
        is_used=False
    )
    return verification


def send_verification_email(user, otp_code):
    """
    Send verification email with OTP code.
    
    Args:
        user: The CustomUser instance
        otp_code: The 6-digit OTP code
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    subject = 'Verify Your Email - Eco-Campus'
    message = f"""
    Welcome to Eco-Campus!
    
    Your verification code is: {otp_code}
    
    This code will expire in 10 minutes.
    
    Please enter this code on the verification page to activate your account.
    
    If you didn't create this account, please ignore this email.
    
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
        print(f"Error sending email: {e}")
        return False


def generate_and_send_otp(user):
    """
    Generate a new OTP, save it, and send verification email.
    
    Args:
        user: The CustomUser instance
        
    Returns:
        tuple: (EmailVerification object, bool indicating success)
    """
    # Generate OTP
    otp_code = generate_otp()
    
    # Save OTP
    verification = save_otp(user, otp_code)
    
    # Send email
    success = send_verification_email(user, otp_code)
    
    return verification, success


def verify_otp(user, code):
    """
    Verify the OTP code for a user.
    
    Args:
        user: The CustomUser instance
        code: The 6-digit OTP code
        
    Returns:
        tuple: (bool, str) - (is_valid, message)
    """
    try:
        # Get the latest unused verification record
        verification = EmailVerification.objects.filter(
            user=user,
            is_used=False
        ).latest('created_at')
    except EmailVerification.DoesNotExist:
        return False, "No verification code found. Please request a new code."
    
    # Check if OTP is correct
    if verification.code != code:
        return False, "Invalid verification code."
    
    # Check if OTP has expired (10 minutes)
    expiration_time = verification.created_at + timedelta(minutes=10)
    if timezone.now() > expiration_time:
        return False, "Verification code has expired. Please request a new code."
    
    # Mark OTP as used
    verification.is_used = True
    verification.save()
    
    # Activate the user
    user.is_active = True
    user.is_verified = True
    user.save()
    
    return True, "Email verified successfully!"

