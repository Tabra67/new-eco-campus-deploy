"""
Test script to verify SendGrid SMTP email configuration.
Run this from the backend directory: python test_email_config.py
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.conf import settings
from django.core.mail import get_connection


def test_email_backend():
    """Test which email backend Django is using."""
    print("=" * 60)
    print("EMAIL BACKEND TEST")
    print("=" * 60)
    
    print(f"\n1. EMAIL_BACKEND setting: {settings.EMAIL_BACKEND}")
    print(f"2. Expected: django.core.mail.backends.smtp.EmailBackend")
    
    if settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend":
        print("\n✓ PASS: Using SMTP backend (not sandbox!)")
    else:
        print("\n✗ FAIL: Not using SMTP backend!")
    
    print(f"\n3. EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"4. EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"5. EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"6. EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"7. DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")


def test_email_connection():
    """Test the email connection."""
    print("\n" + "=" * 60)
    print("EMAIL CONNECTION TEST")
    print("=" * 60)
    
    try:
        connection = get_connection()
        print(f"\n1. Connection class: {connection.__class__.__name__}")
        
        # Try to open the connection
        connection.open()
        print("2. ✓ Successfully connected to SMTP server!")
        connection.close()
        return True
    except Exception as e:
        print(f"2. ✗ Connection failed: {e}")
        return False


def test_send_email():
    """Test sending an actual email."""
    print("\n" + "=" * 60)
    print("SEND EMAIL TEST")
    print("=" * 60)
    
    from django.core.mail import send_mail
    
    test_email = os.getenv("TEST_EMAIL", "")
    if not test_email:
        print("\n⚠ No TEST_EMAIL set in .env. Provide a test email address.")
        print("Add: TEST_EMAIL=your@email.com to .env file")
        return False
    
    subject = "Test Email from Eco-Campus (SendGrid SMTP)"
    message = """
This is a test email sent from your Django application using SendGrid SMTP.

If you received this email, your email configuration is working correctly!

Configuration details:
- Backend: SMTP (not sandbox)
- Host: smtp.sendgrid.net
- Port: 587
- TLS: Enabled
"""
    
    try:
        result = send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[test_email],
            fail_silently=False,
        )
        
        if result == 1:
            print(f"\n✓ SUCCESS: Email sent to {test_email}!")
            print("Check your inbox (and spam folder)")
            return True
        else:
            print(f"\n✗ FAIL: send_mail returned {result}")
            return False
            
    except Exception as e:
        print(f"\n✗ FAIL: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("ECO-CAMPUS EMAIL CONFIGURATION TEST")
    print("=" * 60)
    
    # Test 1: Backend configuration
    test_email_backend()
    
    # Test 2: Connection test
    test_email_connection()
    
    # Test 3: Send test email
    test_send_email()
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()

