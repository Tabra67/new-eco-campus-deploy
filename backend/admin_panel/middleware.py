from django.http import JsonResponse

from .permissions import user_is_admin


class AdminRouteProtectionMiddleware:
    """
    Blocks non-admin users from /api/admin/ routes.
    Buyers and sellers receive 403 on admin API calls.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith('/api/admin/') and not path.rstrip('/').endswith('/login'):
            user = getattr(request, 'user', None)
            if user and user.is_authenticated and not user_is_admin(user):
                return JsonResponse({'error': 'Admin access required.'}, status=403)
        return self.get_response(request)
