import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Conversation, ChatMessage
from .serializers import ChatMessageSerializer


class ConversationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.group_name = f"chat_{self.conversation_id}"

        is_member = await self._is_conversation_member(user.id, self.conversation_id)
        if not is_member:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        payload = json.loads(text_data or "{}")
        message_text = (payload.get("message") or "").strip()
        if not message_text:
            return

        saved = await self._save_message(
            conversation_id=self.conversation_id,
            sender_id=self.scope["user"].id,
            text=message_text
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "payload": saved
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    @database_sync_to_async
    def _is_conversation_member(self, user_id, conversation_id):
        return Conversation.objects.filter(id=conversation_id).filter(
            buyer_id=user_id
        ).exists() or Conversation.objects.filter(id=conversation_id, seller_id=user_id).exists()

    @database_sync_to_async
    def _save_message(self, conversation_id, sender_id, text):
        conversation = Conversation.objects.get(id=conversation_id)

        receiver_id = conversation.seller_id if int(sender_id) == int(conversation.buyer_id) else conversation.buyer_id
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender_id=sender_id,
            receiver_id=receiver_id,
            text=text,
            read_status=False,
        )
        conversation.save(update_fields=["updated_at"])
        return ChatMessageSerializer(message).data

