from django.contrib import admin
from .models import CustomUser, University

# Register your custom user
admin.site.register(CustomUser)

# Register universities so they appear in admin
admin.site.register(University)