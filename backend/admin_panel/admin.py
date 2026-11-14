from django.contrib import admin

from .models import AdminActionLog


@admin.register(AdminActionLog)
class AdminActionLogAdmin(admin.ModelAdmin):
    list_display = ('action_type', 'admin_user', 'target_object', 'timestamp')
    list_filter = ('action_type',)
    search_fields = ('target_object', 'notes')
    readonly_fields = ('timestamp',)
