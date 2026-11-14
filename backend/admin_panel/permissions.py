from rest_framework.permissions import BasePermission

ADMIN_ROLES = ('admin', 'super_admin')


def user_is_admin(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return bool(
        user.is_active
        and user.is_staff
        and getattr(user, 'role', None) in ADMIN_ROLES
    )


class IsAdminStaff(BasePermission):
    """Staff users with admin or super_admin role."""

    message = 'Admin access required.'

    def has_permission(self, request, view):
        return user_is_admin(request.user)
