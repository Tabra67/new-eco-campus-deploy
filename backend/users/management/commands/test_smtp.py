import traceback

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Send a test email to verify SMTP configuration.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            required=True,
            help='Recipient email address',
        )

    def handle(self, *args, **options):
        recipient = options['email']
        try:
            send_mail(
                subject='SMTP Test',
                message='This is a test email from Eco-Campus.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
            self.stdout.write('SUCCESS')
        except Exception:
            self.stdout.write(traceback.format_exc())
