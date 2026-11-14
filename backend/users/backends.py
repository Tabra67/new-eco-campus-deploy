"""
Custom authentication backend for email-based authentication.
"""
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class EmailBackend(ModelBackend):
    """
    Custom authentication backend that authenticates users using their email address.
    Supports case-insensitive email lookup.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Authenticate a user using their email address.
        
        Args:
            request: The HTTP request object
            username: The email address (passed as username by DRF serializer)
            password: The user's password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        if username is None or password is None:
            return None

        try:
            # Case-insensitive email lookup
            user = User.objects.get(email__iexact=username)
        except User.DoesNotExist:
            # Run default password hashers to save timing
            User().set_password(password)
            return None

        # Check the password
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None

    def user_can_authenticate(self, user):
        """
        Check if the user is allowed to authenticate.
        
        Args:
            user: The user object to check
            
        Returns:
            bool: True if user can authenticate, False otherwise
        """
        is_active = getattr(user, 'is_active', None)
        is_verified = getattr(user, 'is_verified', True)
        
        # Check if user is active
        if is_active is False:
            return False
        
        return True

    def get_user(self, user_id):
        """
        Retrieve a user by their primary key.
        
        Args:
            user_id: The user's primary key
            
        Returns:
            User object if found, None otherwise
        """
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

        if self.user_can_authenticate(user):
            return user
        return None

