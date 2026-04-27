-- Migration 001: Add Evolution API fields
-- Apply each block in order via Supabase SQL editor (project: crm-assistant)

-- contacts: normalized phone for deduplication
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_normalized text;
CREATE INDEX IF NOT EXISTS contacts_phone_normalized_idx ON contacts(phone_normalized);

-- conversations: link to contact, last message timestamp, unique constraint for idempotent upsert
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON conversations(last_message_at DESC);
ALTER TABLE conversations ADD CONSTRAINT conversations_owner_phone_unique
  UNIQUE (owner_id, customer_phone);

-- messages: Evolution message ID (idempotency), media fields, timestamp, expanded type check
ALTER TABLE messages ADD COLUMN IF NOT EXISTS evolution_message_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS filename text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_timestamp timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS messages_evolution_message_id_idx
  ON messages(evolution_message_id) WHERE evolution_message_id IS NOT NULL;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','video','document','audio','sticker','note']));

-- Dead letter queue: failed webhook events (no RLS — server-side only)
CREATE TABLE IF NOT EXISTS _dlq (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  source text NOT NULL,
  payload jsonb NOT NULL,
  error text NOT NULL,
  created_at timestamptz DEFAULT now()
);
