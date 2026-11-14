from django.contrib import admin
from .models import Item, Message, Order, Wishlist

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'seller', 'category', 'price', 'units_available', 'status', 'created_at']
    list_filter = ['category', 'condition', 'status', 'created_at']
    search_fields = ['title', 'description', 'seller__username']
    list_editable = ['status', 'units_available']
    readonly_fields = ['created_at']

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['product', 'buyer', 'seller', 'timestamp', 'is_read']
    list_filter = ['is_read', 'timestamp']
    search_fields = ['message', 'buyer__username', 'seller__username']
    readonly_fields = ['timestamp']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'product', 'buyer', 'seller', 'price', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['product__title', 'buyer__username', 'seller__username']
    readonly_fields = ['created_at']

@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'added_at']
    list_filter = ['added_at']
    readonly_fields = ['added_at']

