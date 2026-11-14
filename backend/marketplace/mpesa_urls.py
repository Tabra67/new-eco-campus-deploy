from django.urls import path

from . import views

urlpatterns = [
    path('b2c/result/', views.mpesa_b2c_result, name='mpesa-b2c-result-public'),
    path('b2c/timeout/', views.mpesa_b2c_timeout, name='mpesa-b2c-timeout-public'),
]
