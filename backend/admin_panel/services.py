from .models import AdminActionLog


def log_admin_action(admin_user, action_type: str, target_object: str, notes: str = ''):
    AdminActionLog.objects.create(
        admin_user=admin_user,
        action_type=action_type,
        target_object=target_object,
        notes=notes or '',
    )
