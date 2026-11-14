from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.contrib.auth.tokens import default_token_generator
from django.utils.crypto import get_random_string


class University(models.Model):
    name = models.CharField(max_length=255)
    email_domain = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('buyer', 'Buyer'),
        ('seller', 'Seller'),
        ('admin', 'Admin'),
        ('super_admin', 'Super Admin'),
    ]
    
    # Core fields
    university = models.ForeignKey(University, on_delete=models.SET_NULL, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    email_otp = models.CharField(max_length=6, blank=True, null=True)
    otp_expiration = models.DateTimeField(null=True, blank=True)
    
    # Basic profile
    full_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    bio = models.TextField(blank=True, default="")
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    
    # Role field (registration-only)
    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default='buyer')
    
    # Shared location fields
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    
    # Buyer-specific
    delivery_address = models.TextField(blank=True, default="")
    preferred_categories = models.JSONField(default=list, blank=True)
    
    # Seller-specific
    store_name = models.CharField(max_length=100, blank=True)
    seller_type = models.CharField(max_length=50, blank=True)
    main_category = models.CharField(max_length=50, blank=True)
    subcategory = models.CharField(max_length=50, blank=True)
    business_address = models.TextField(blank=True, default="")
    cover_image = models.ImageField(upload_to='cover_images/', blank=True, null=True)
    payout_method = models.CharField(max_length=50, blank=True)
    payout_details = models.TextField(blank=True, default="")
    
    # Admin-specific
    is_2fa_enabled = models.BooleanField(default=False)

    def generate_otp(self):
        """Generate a 6-digit OTP and set expiration to 10 minutes."""
        self.email_otp = get_random_string(length=6, allowed_chars='0123456789')
        self.otp_expiration = timezone.now() + timezone.timedelta(minutes=10)
        self.save()
        return self.email_otp

    def get_full_name(self):
        """Legacy support for AbstractUser full_name."""
        return self.full_name or f"{self.first_name} {self.last_name}".strip()

    full_name.short_description = 'Full Name'

    def __str__(self):
        return self.username


class PasswordReset(models.Model):
    """
    Model to store password reset OTP codes.
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='password_resets')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        """Check if the OTP is still valid (not used and within 10 minutes)."""
        if self.is_used:
            return False
        # Check if OTP is within 10 minutes
        expiration_time = self.created_at + timezone.timedelta(minutes=10)
        return timezone.now() < expiration_time

    def __str__(self):
        return f"Password Reset for {self.user.email} - Code: {self.code}"


class EmailVerification(models.Model):
    """
    Model to store email verification OTP codes.
    Tracks verification status and expiration.
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='email_verifications')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        """Check if the OTP is still valid (not used and within 10 minutes)."""
        if self.is_used:
            return False
        # Check if OTP is within 10 minutes
        expiration_time = self.created_at + timezone.timedelta(minutes=10)
        return timezone.now() < expiration_time

    def __str__(self):
        return f"Verification for {self.user.email} - Code: {self.code}"

