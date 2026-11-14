
"""
Serializers for the users app.
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate

from .models import CustomUser, University, EmailVerification, PasswordReset
from .utils import generate_and_send_otp


# ============================================================
# REGISTRATION SERIALIZER
# ============================================================

class RegisterSerializer(serializers.ModelSerializer):
    """
    Creates a user as inactive and sends an OTP verification email.
    Accepts users with any valid email domain.
    University association is optional.
    """

    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'username', 'email', 'password', 'password_confirm', 'role',

            # Basic profile
            'full_name', 'phone',

            # Location
            'country', 'city',

            # Buyer
            'delivery_address', 'preferred_categories',

            # Seller
            'store_name', 'seller_type', 'main_category', 'subcategory',
            'business_address', 'payout_method', 'payout_details',

            # Admin
            'is_2fa_enabled'
        ]

        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate_role(self, value):
        valid_roles = list(dict(CustomUser.ROLE_CHOICES).keys())

        if value not in valid_roles:
            raise serializers.ValidationError(
                f"Role must be one of: {', '.join(valid_roles)}"
            )

        return value

    def validate(self, attrs):

        # Check if passwords match
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })

        # Check if email already exists
        email = attrs['email'].strip()

        if CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({
                'email': 'An account with this email already exists.'
            })

        # Check if username already exists
        if CustomUser.objects.filter(
            username=attrs['username']
        ).exists():
            raise serializers.ValidationError({
                'username': 'An account with this username already exists.'
            })

        # Email format is validated by the serializer's EmailField.
        # No university-specific email domain restriction is applied.

        return attrs

    def create(self, validated_data):

        # Extract core fields
        username = validated_data.pop('username')
        email = validated_data.pop('email').strip()
        password = validated_data.pop('password')

        validated_data.pop('password_confirm', None)

        # Find a university if the email domain matches one.
        # Users with other email domains can still register.
        domain = email.rsplit('@', 1)[-1].lower()

        university = University.objects.filter(
            email_domain__iexact=domain,
            is_active=True
        ).first()

        # Create user
        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_active=False,
            is_verified=False
        )

        # Whitelisted safe profile fields
        safe_fields = {
            'role', 'full_name', 'phone', 'country', 'city',
            'delivery_address', 'preferred_categories',
            'store_name', 'seller_type', 'main_category',
            'subcategory', 'business_address', 'payout_method',
            'payout_details', 'is_2fa_enabled'
        }

        # Set safe fields
        for field, value in validated_data.items():
            if field in safe_fields:
                setattr(user, field, value)

        # Associate university when a matching university exists.
        # Otherwise, the user remains without a university.
        user.university = university

        user.save()

        # Generate and send OTP verification email
        try:
            verification, success = generate_and_send_otp(user)

            if not success:
                print(
                    f"Warning: Failed to send verification email "
                    f"to {user.email}"
                )

        except Exception as e:
            print(f"Error generating OTP: {e}")

        return user


# ============================================================
# LOGIN SERIALIZER
# ============================================================

class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):

        email = attrs.get('email')
        password = attrs.get('password')

        # Authenticate using email as username
        user = authenticate(
            username=email,
            password=password
        )

        if not user:
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        if not user.is_verified:
            raise serializers.ValidationError(
                "Email not verified."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "Account is inactive. Please verify your email."
            )

        if user.role in ('admin', 'super_admin') or user.is_staff:
            raise serializers.ValidationError(
                "Please use the admin login page at /admin-login/."
            )

        attrs['user'] = user

        return attrs


# ============================================================
# USER PROFILE SERIALIZER
# ============================================================

class UserSerializer(serializers.ModelSerializer):
    """
    User serializer for GET /profile/
    """

    university_name = serializers.CharField(
        source='university.name',
        read_only=True
    )

    profile_picture_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    role_display = serializers.CharField(
        source='get_role_display',
        read_only=True
    )

    class Meta:
        model = CustomUser

        fields = [
            'id', 'username', 'full_name', 'email', 'role',
            'role_display',

            'university', 'university_name',
            'country', 'city',

            # Basic
            'phone', 'bio', 'is_verified', 'is_active',
            'date_joined',

            # Images
            'profile_picture', 'profile_picture_url',
            'cover_image', 'cover_image_url',

            # Buyer
            'delivery_address', 'preferred_categories',

            # Seller
            'store_name', 'seller_type', 'main_category',
            'subcategory', 'business_address',
            'payout_method', 'payout_details',

            # Admin
            'is_2fa_enabled'
        ]

        read_only_fields = [
            'id', 'email', 'role', 'is_verified', 'date_joined'
        ]

    def get_profile_picture_url(self, obj):

        if obj.profile_picture:
            request = self.context.get('request')

            if request:
                return request.build_absolute_uri(
                    obj.profile_picture.url
                )

            return obj.profile_picture.url

        return None

    def get_cover_image_url(self, obj):

        if obj.cover_image:
            request = self.context.get('request')

            if request:
                return request.build_absolute_uri(
                    obj.cover_image.url
                )

            return obj.cover_image.url

        return None


# ============================================================
# PROFILE UPDATE SERIALIZER
# ============================================================

class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profiles.
    Excludes registration-only fields such as role.
    """

    username = serializers.CharField(required=False)

    class Meta:
        model = CustomUser

        fields = [
            'username', 'full_name', 'phone', 'bio',
            'profile_picture',

            # Location
            'country', 'city',

            # Buyer
            'delivery_address', 'preferred_categories',

            # Seller
            'store_name', 'seller_type', 'main_category',
            'subcategory', 'business_address',
            'payout_method', 'payout_details', 'cover_image',

            # Admin
            'is_2fa_enabled'
        ]

    def validate_username(self, value):

        user = self.context['request'].user

        if CustomUser.objects.exclude(
            pk=user.pk
        ).filter(username=value).exists():

            raise serializers.ValidationError(
                "Username already exists."
            )

        return value

    def validate_preferred_categories(self, value):

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Must be a list of strings"
            )

        return value


# ============================================================
# PASSWORD RESET SERIALIZERS
# ============================================================

class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Serializer for password reset request.
    """

    email = serializers.EmailField()


class PasswordResetVerifySerializer(serializers.Serializer):
    """
    Serializer for password reset OTP verification.
    """

    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)


class PasswordResetCompleteSerializer(serializers.Serializer):
    """
    Serializer for completing password reset.
    """

    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)

    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):

        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })

        # Validate password strength
        try:
            validate_password(attrs['new_password'])

        except serializers.ValidationError as e:
            raise serializers.ValidationError({
                'new_password': list(e.messages)
            })

        return attrs

    def validate_code(self, value):

        try:
            password_reset = PasswordReset.objects.filter(
                code=value,
                is_used=False
            ).latest('created_at')

        except PasswordReset.DoesNotExist:
            raise serializers.ValidationError(
                "Invalid or expired verification code."
            )

        return value