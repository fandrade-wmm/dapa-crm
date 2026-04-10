import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { https, logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { adminDb } from '../../config/firebase-admin';

const whapiApiToken = defineSecret('WHAPI_API_TOKEN');
const whapiOwnerId = defineSecret('WHAPI_OWNER_ID');

// ---------- Whapi payload types ----------

interface WhapiMediaObject {
  link?: string;
  caption?: string;
  mime_type?: string;
  file_size?: number;
  filename?: string;
  gif_play?: boolean;
}

interface WhapiMessage {
  id: string;
  type: string;
  from: string;           // "521234567890@s.whatsapp.net"
  from_me?: boolean;      // true = sent by our phone/API
  from_name?: string;
  timestamp: number;
  chat_id: string;
  text?: { body: string };
  image?: WhapiMediaObject;
  video?: WhapiMediaObject;
  document?: WhapiMediaObject;
  audio?: WhapiMediaObject;
  sticker?: WhapiMediaObject;
  gif?: WhapiMediaObject;
}

interface WhapiWebhookPayload {
  messages?: WhapiMessage[];
}

// ---------- Helpers ----------

function parsePhone(from: string): string {
  // Strip @s.whatsapp.net or @g.us etc.
  return from.split('@')[0];
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function extractContent(msg: WhapiMessage): string {
  if (msg.text?.body) return msg.text.body;
  if (msg.image) return msg.image.caption || '';
  if (msg.gif || msg.video?.gif_play) return msg.video?.caption || msg.gif?.caption || '';
  if (msg.video) return msg.video.caption || '';
  if (msg.document) return msg.document.caption || '';
  return '';
}

function extractMediaUrl(msg: WhapiMessage): string | null {
  return (
    msg.image?.link ??
    msg.video?.link ??
    msg.document?.link ??
    msg.audio?.link ??
    msg.sticker?.link ??
    msg.gif?.link ??
    null
  );
}

function toMessageType(
  type: string,
  msg: WhapiMessage
): 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' {
  if (type === 'image') return 'image';
  if (type === 'sticker') return 'sticker';
  if (type === 'gif' || (type === 'video' && msg.video?.gif_play)) return 'image';
  if (type === 'video') return 'video';
  if (type === 'document') return 'document';
  if (type === 'audio' || type === 'voice' || type === 'ptt') return 'audio';
  return 'text';
}

function toLastMessagePreview(msg: WhapiMessage): string {
  if (msg.text?.body) return msg.text.body;
  if (msg.image) return msg.image.caption || '📷 Imagen';
  if (msg.gif || msg.video?.gif_play) return '🎞️ GIF';
  if (msg.video) return msg.video.caption || '🎥 Video';
  if (msg.document) return `📄 ${msg.document.filename ?? 'Documento'}`;
  if (msg.audio) return '🎤 Audio';
  if (msg.sticker) return '🎭 Sticker';
  return `[${msg.type}]`;
}

/**
 * Find an existing contact by phone number or create a new one.
 * Returns the contactId.
 */
async function findOrCreateContact(
  phone: string,
  name: string | null,
  ownerId: string
): Promise<string> {
  const normalized = normalizePhone(phone);

  // Search by normalized digits to handle format differences
  const snap = await adminDb
    .collection('contacts')
    .where('ownerId', '==', ownerId)
    .where('phoneNormalized', '==', normalized)
    .limit(1)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    // Update name if we now know it and didn't before
    if (name && !doc.data().name) {
      await doc.ref.update({ name, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return doc.id;
  }

  // Create new contact
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await adminDb.collection('contacts').add({
    name: name || phone,
    phone,
    phoneNormalized: normalized,
    email: null,
    company: null,
    tags: [],
    source: 'whatsapp',
    ownerId,
    createdAt: now,
    updatedAt: now,
  });

  logger.info(`Created new contact ${ref.id} for phone ${phone}`);
  return ref.id;
}

// ---------- HTTP Function ----------

export const whapiWebhook = https.onRequest(
  { cors: false, region: 'us-central1', secrets: [whapiApiToken, whapiOwnerId] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Log full payload for diagnostics
    logger.info('whapiWebhook received', {
      topLevelKeys: Object.keys(req.body ?? {}),
      rawBody: JSON.stringify(req.body).slice(0, 1000),
    });

    // Respond immediately — Whapi expects a fast 200
    res.status(200).send('OK');

    const payload = req.body as WhapiWebhookPayload;
    const messages: WhapiMessage[] =
      payload.messages ??
      (payload as unknown as { data?: { messages?: WhapiMessage[] } }).data?.messages ??
      [];

    if (messages.length === 0) {
      logger.info('whapiWebhook: no messages in payload, ignoring event');
      return;
    }

    const ownerId = whapiOwnerId.value() || null;
    if (!ownerId) {
      logger.error('whapiWebhook: WHAPI_OWNER_ID secret not configured');
      return;
    }

    for (const msg of messages) {
      const isOutgoing = msg.from_me === true;

      logger.info('whapiWebhook processing message', {
        id: msg.id,
        type: msg.type,
        from_me: isOutgoing,
        from: msg.from,
      });

      // For outgoing messages echoed by Whapi (sent via API or from the phone),
      // store as 'assistant' role so the conversation history is complete.
      // For incoming messages from clients, store as 'user'.
      const role: 'user' | 'assistant' = isOutgoing ? 'assistant' : 'user';

      // The phone of the OTHER party:
      // - Incoming: msg.from is the client
      // - Outgoing: the client is msg.chat_id (strip the suffix)
      const rawPhone = isOutgoing ? msg.chat_id : msg.from;
      const phone = parsePhone(rawPhone);

      // Skip group messages (contain "-" in phone like "1234-5678@g.us")
      if (phone.includes('-') || rawPhone.includes('@g.us')) {
        logger.info(`Skipping group message ${msg.id}`);
        continue;
      }

      const clientName = isOutgoing ? null : (msg.from_name ?? null);
      const content = extractContent(msg);
      const preview = toLastMessagePreview(msg);
      const msgType = toMessageType(msg.type, msg);
      const mediaUrl = extractMediaUrl(msg);
      const filename = msg.document?.filename ?? null;
      const now = admin.firestore.FieldValue.serverTimestamp();

      try {
        // Find or create contact
        const contactId = await findOrCreateContact(phone, clientName, ownerId);

        // Deterministic conversation ID eliminates race conditions.
        // Two concurrent webhook calls for the same phone always resolve to the same doc.
        const deterministicId = createHash('sha256')
          .update(`${ownerId}:whatsapp:${normalizePhone(phone)}`)
          .digest('hex')
          .slice(0, 20);

        const convRef = adminDb.collection('conversations').doc(deterministicId);
        const convSnap = await convRef.get();
        const conversationId = deterministicId;

        if (!convSnap.exists) {
          const displayName = clientName || phone;
          // set() is idempotent — concurrent calls create the same document safely
          await convRef.set({
            customerPhone: phone,
            customerName: clientName,
            contactId,
            status: 'active',
            aiEnabled: false,
            labels: [],
            unreadCount: isOutgoing ? 0 : 1,
            channel: 'whatsapp',
            lastMessage: preview,
            ownerId,
            createdAt: now,
            updatedAt: now,
          });

          // Auto-create CRM lead in "nuevos" (fire-and-forget, don't block message storage)
          adminDb
            .collection('leads')
            .where('ownerId', '==', ownerId)
            .where('phone', '==', phone)
            .limit(1)
            .get()
            .then((existingLead) => {
              if (existingLead.empty) {
                return adminDb.collection('leads').add({
                  name: displayName,
                  phone,
                  email: null,
                  stage: 'nuevos',
                  notes: null,
                  value: null,
                  source: 'WhatsApp',
                  contactId,
                  ownerId,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
              return null;
            })
            .then(() => logger.info(`Lead ensured for ${phone}`))
            .catch((e) => logger.warn('Lead creation failed (non-critical):', e));
        } else {
          await convRef.update({
            lastMessage: preview,
            contactId,
            updatedAt: now,
            ...(isOutgoing ? {} : { unreadCount: admin.firestore.FieldValue.increment(1) }),
            ...(clientName ? { customerName: clientName } : {}),
          });
        }

        // Idempotency: use Whapi message ID as Firestore document ID
        const msgRef = adminDb
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .doc(msg.id);

        if ((await msgRef.get()).exists) {
          logger.info(`Duplicate message ${msg.id} — skipped`);
          continue;
        }

        await msgRef.set({
          role,
          content,
          messageType: msgType,
          isInternalNote: false,
          whapiMessageId: msg.id,
          ...(mediaUrl ? { mediaUrl } : {}),
          ...(filename ? { filename } : {}),
          createdAt: admin.firestore.Timestamp.fromMillis(msg.timestamp * 1000),
        });

        logger.info(`Stored ${role} message ${msg.id} in conversation ${conversationId}`);
      } catch (err) {
        logger.error(`Failed to process Whapi message ${msg.id}:`, err);
        await adminDb.collection('_dlq').add({
          source: 'whapiWebhook',
          payload: msg,
          error: (err as Error).message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }
);
