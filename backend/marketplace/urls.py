from django.urls import path
from . import views, dispute_views, trust_views

urlpatterns = [
    # Existing seller endpoints
    path('products/', views.ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<int:id>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('products/<int:id>/increment-view/', views.increment_product_view, name='increment-view'),
    path('products/<int:id>/mark-sold/', views.mark_product_sold, name='mark-sold'),
    path('messages/', views.MessageListCreateView.as_view(), name='message-list'),
    path('messages/send/', views.send_message, name='send-message'),
    path('messages/bidirectional/', views.MessageBidirectionalListView.as_view(), name='messages-bidirectional'),
    path('conversations/', views.ConversationListView.as_view(), name='conversation-list'),
    path('conversations/ensure/', views.EnsureConversationView.as_view(), name='conversation-ensure'),
    path('conversations/order/<int:order_id>/', views.ConversationByOrderView.as_view(), name='conversation-by-order'),
    path('conversations/<int:conversation_id>/messages/', views.ConversationMessagesView.as_view(), name='conversation-messages'),
    path('conversations/thread/<int:other_user_id>/messages/', views.ThreadMessagesView.as_view(), name='thread-messages'),
    path('messages/chat/', views.ChatMessageCreateView.as_view(), name='chat-message-create'),
    path('orders-seller/', views.SellerOrderListView.as_view(), name='seller-orders'),
    path('orders/<int:id>/', views.update_order_status, name='update-order-status'),
    path('orders/<int:id>/actions/', views.update_order_status, name='order-actions'),
    path('stats/', views.SellerStatsView.as_view(), name='seller-stats'),
    
    # NEW marketplace public endpoints
    path('marketplace/products/', views.MarketplaceProductListView.as_view(), name='marketplace-products'),
    
    # Orders
    path('orders/', views.OrderListCreateView.as_view(), name='orders-list-create'),
    
    # Wishlist
    path('wishlist/', views.WishlistListCreateView.as_view(), name='wishlist-list'),
    path('wishlist/<int:product_id>/toggle/', views.wishlist_toggle, name='wishlist-toggle'),
    # Cart
    path('cart/', views.buyer_cart, name='buyer-cart'),
    path('cart/add/', views.cart_add_item, name='cart-add'),
    path('cart/items/<int:item_id>/', views.cart_item_detail, name='cart-item-detail'),
    path('cart/clear/', views.cart_clear, name='cart-clear'),
    path('dashboard/', views.dashboard_summary, name='dashboard-summary'),
    path('payments/', views.payment_history, name='payment-history'),
    path('mpesa/stk-push/', views.mpesa_stk_push, name='mpesa-stk-push'),
    path('mpesa/checkout/', views.mpesa_checkout, name='mpesa-checkout'),
    path('mpesa/callback/', views.mpesa_callback, name='mpesa-callback'),
    path('mpesa/status/<str:checkout_request_id>/', views.mpesa_payment_status, name='mpesa-status'),
    path('wallet/', views.seller_wallet, name='seller-wallet'),
    path('wallet/balance/', views.seller_wallet, name='wallet-balance'),
    path('wallet/withdraw/', views.seller_withdrawals, name='wallet-withdraw'),
    path('wallet/withdrawals/', views.seller_withdrawals, name='wallet-withdrawals'),
    path('escrow/history/', views.escrow_history, name='escrow-history'),
    path('withdrawals/', views.seller_withdrawals, name='seller-withdrawals'),
    path('mpesa/b2c/result/', views.mpesa_b2c_result, name='mpesa-b2c-result'),
    path('mpesa/b2c/timeout/', views.mpesa_b2c_timeout, name='mpesa-b2c-timeout'),
    path('disputes/open/', views.open_dispute, name='open-dispute'),
    path('disputes/buyer/', dispute_views.buyer_dispute_list, name='buyer-disputes'),
    path('disputes/seller/', dispute_views.seller_dispute_list, name='seller-disputes'),
    path('disputes/<int:dispute_id>/', dispute_views.dispute_detail, name='dispute-detail'),
    path('disputes/<int:dispute_id>/respond/', dispute_views.dispute_respond, name='dispute-respond'),
    path('disputes/<int:dispute_id>/message/', dispute_views.dispute_message, name='dispute-message'),
    path('disputes/<int:dispute_id>/evidence/', dispute_views.dispute_evidence_upload, name='upload-dispute-evidence'),
    path('reviews/', views.create_review, name='create-review'),
    path('reviews/seller/', views.seller_reviews_list, name='seller-reviews'),
    path('reviews/user/<int:user_id>/', views.user_reviews_list, name='user-reviews'),
    path('reputation/<int:user_id>/', views.reputation_profile, name='reputation-profile'),
    path('trust/me/', trust_views.trust_profile_me, name='trust-profile-me'),
    path('trust/<int:user_id>/', trust_views.trust_profile_user, name='trust-profile'),
    path('trust/seller/<int:user_id>/', trust_views.seller_trust, name='seller-trust'),
    path('trust/buyer/<int:user_id>/', trust_views.buyer_trust, name='buyer-trust'),
    path('trust/dashboard/', trust_views.trust_dashboard, name='trust-dashboard'),
    path('trust/flagged/', trust_views.flagged_users, name='trust-flagged'),
    path('support/threads/', views.support_threads, name='support-threads'),
    path('support/threads/<int:thread_id>/messages/', views.support_thread_messages, name='support-thread-messages'),
]

