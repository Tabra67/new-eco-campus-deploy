from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create or update an Eco-Campus admin user (is_staff + admin role).'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--username', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--role', default='admin', choices=['admin', 'super_admin'])

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        username = options['username'].strip()
        password = options['password']
        role = options['role']

        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': username, 'role': role},
        )
        user.username = username
        user.role = role
        user.is_staff = True
        user.is_active = True
        user.is_verified = True
        user.set_password(password)
        user.save()

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{verb} admin user: {user.email} (role={role})'))
