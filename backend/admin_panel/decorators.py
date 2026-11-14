from functools import wraps

from django.http import JsonResponse
from django.shortcuts import redirect

from .permissions import user_is_admin


def admin_required(view_func):
    """DRF/Django view decorator: requires staff admin role."""

    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        user = getattr(request, 'user', None)
        if user_is_admin(user):
            return view_func(request, *args, **kwargs)
        if request.path.startswith('/api/'):
            return JsonResponse({'error': 'Admin access required.'}, status=403)
        return redirect('/login/')

    return _wrapped
