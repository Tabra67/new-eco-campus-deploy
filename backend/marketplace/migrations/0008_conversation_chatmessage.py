from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0007_alter_order_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Conversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("buyer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="buyer_conversations", to=settings.AUTH_USER_MODEL)),
                ("order", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="conversation", to="marketplace.order")),
                ("seller", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="seller_conversations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="ChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="marketplace.conversation")),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chat_messages", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["timestamp"]},
        ),
    ]

