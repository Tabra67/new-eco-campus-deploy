# Generated migration for wallet, checkout, and order status updates

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_order_statuses(apps, schema_editor):
    Order = apps.get_model('marketplace', 'Order')
    mapping = {
        'ORDER_PLACED': 'pending_payment',
        'PENDING': 'pending_payment',
        'CONFIRMED': 'processing',
        'PAID': 'paid',
        'DELIVERED': 'delivered',
        'COMPLETED': 'completed',
        'DISPUTED': 'disputed',
    }
    for old, new in mapping.items():
        Order.objects.filter(status=old).update(status=new)


def migrate_withdrawal_statuses(apps, schema_editor):
    Withdrawal = apps.get_model('marketplace', 'Withdrawal')
    Withdrawal.objects.filter(status='PENDING').update(status='pending')
    Withdrawal.objects.filter(status='APPROVED').update(status='completed')
    Withdrawal.objects.filter(status='REJECTED').update(status='rejected')


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0012_dispute_withdrawal'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='quantity',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending_payment', 'Pending Payment'),
                    ('paid', 'Paid'),
                    ('processing', 'Processing'),
                    ('shipped', 'Shipped'),
                    ('delivered', 'Delivered'),
                    ('completed', 'Completed'),
                    ('disputed', 'Disputed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='pending_payment',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='CheckoutSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
                ('status', models.CharField(default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('buyer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='checkout_sessions', to=settings.AUTH_USER_MODEL)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='checkout_sessions', to='marketplace.item')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='SellerWallet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('available_balance', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('pending_balance', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_earnings', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_withdrawn', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('seller', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='seller_wallet', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name='mpesatransaction',
            name='checkout_session',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='mpesa_transactions', to='marketplace.checkoutsession'),
        ),
        migrations.AlterField(
            model_name='mpesatransaction',
            name='order',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='mpesa_transactions', to='marketplace.order'),
        ),
        migrations.AddField(
            model_name='checkoutsession',
            name='order',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='checkout_sessions', to='marketplace.order'),
        ),
        migrations.AddField(
            model_name='escrowtransaction',
            name='buyer',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='buyer_escrow_transactions', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='escrowtransaction',
            name='seller',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='seller_escrow_transactions', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='escrowtransaction',
            name='payment_status',
            field=models.CharField(default='pending', max_length=30),
        ),
        migrations.AddField(
            model_name='withdrawal',
            name='reference_id',
            field=models.CharField(blank=True, max_length=32, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='withdrawal',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('processing', 'Processing'),
                    ('completed', 'Completed'),
                    ('rejected', 'Rejected'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='SupportThread',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('thread_type', models.CharField(choices=[('admin_buyer', 'Admin-Buyer'), ('admin_seller', 'Admin-Seller'), ('buyer_seller', 'Buyer-Seller')], default='buyer_seller', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('admin', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='admin_support_threads', to=settings.AUTH_USER_MODEL)),
                ('buyer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='buyer_support_threads', to=settings.AUTH_USER_MODEL)),
                ('seller', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='seller_support_threads', to=settings.AUTH_USER_MODEL)),
                ('product', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='support_threads', to='marketplace.item')),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='support_threads', to='marketplace.order')),
            ],
            options={'ordering': ['-updated_at']},
        ),
        migrations.CreateModel(
            name='SupportMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('read_status', models.BooleanField(default=False)),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='support_messages_sent', to=settings.AUTH_USER_MODEL)),
                ('thread', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='marketplace.supportthread')),
            ],
            options={'ordering': ['timestamp']},
        ),
        migrations.RunPython(migrate_order_statuses, migrations.RunPython.noop),
        migrations.RunPython(migrate_withdrawal_statuses, migrations.RunPython.noop),
    ]
