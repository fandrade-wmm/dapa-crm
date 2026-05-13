-- Add meta_message_id column to messages table
-- Replaces evolution_message_id for deduplication of Meta WhatsApp Cloud API messages

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS meta_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_meta_message_id_key
  ON public.messages (meta_message_id)
  WHERE meta_message_id IS NOT NULL;
