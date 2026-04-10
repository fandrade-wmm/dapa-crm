import { https, logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../../middleware/auth';
import {
  toChatId,
  sendImageMessage,
  sendVideoMessage,
  sendDocumentMessage,
  sendVoiceMessage,
} from './whapiClient';

const whapiApiToken = defineSecret('WHAPI_API_TOKEN');

export type MediaType = 'image' | 'video' | 'document' | 'audio';

interface SendMediaInput {
  conversationId: string;
  mediaUrl: string;
  mediaType: MediaType;
  caption?: string;
  filename?: string;
}

interface SendMediaResult {
  id: string;
  sent: boolean;
}

export const sendMedia = https.onCall<SendMediaInput, Promise<SendMediaResult>>(
  { secrets: [whapiApiToken] },
  async (request) => {
    await verifyAuth(request);

    const { conversationId, mediaUrl, mediaType, caption, filename } = request.data;

    if (!conversationId || !mediaUrl || !mediaType) {
      throw new https.HttpsError('invalid-argument', 'conversationId, mediaUrl and mediaType are required.');
    }

    const db = getFirestore();
    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) {
      throw new https.HttpsError('not-found', 'Conversation not found.');
    }
    const conv = convSnap.data()!;

    // Send via Whapi first to get the message ID, which becomes the Firestore
    // document ID — this makes the webhook's idempotency check skip the duplicate.
    let whapiMessageId: string | undefined;
    const token = whapiApiToken.value();
    if (token) {
      process.env.WHAPI_API_TOKEN = token;
      const chatId = toChatId(conv.customerPhone as string);
      try {
        let whapiRes;
        if (mediaType === 'image') {
          whapiRes = await sendImageMessage(chatId, mediaUrl, caption);
        } else if (mediaType === 'video') {
          whapiRes = await sendVideoMessage(chatId, mediaUrl, caption);
        } else if (mediaType === 'document') {
          whapiRes = await sendDocumentMessage(chatId, mediaUrl, filename ?? 'archivo', caption);
        } else {
          whapiRes = await sendVoiceMessage(chatId, mediaUrl);
        }
        whapiMessageId = whapiRes?.id;
      } catch (err) {
        logger.error('Whapi media send failed:', err);
        throw new https.HttpsError('internal', 'Failed to send media via Whapi.');
      }
    }

    const msgTypeMap: Record<MediaType, string> = {
      image: 'image',
      video: 'video',
      document: 'document',
      audio: 'audio',
    };

    const msgRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(whapiMessageId ?? db.collection('_').doc().id);

    const messageData = {
      role: 'assistant',
      content: caption ?? '',
      messageType: msgTypeMap[mediaType],
      mediaUrl,
      filename: filename ?? null,
      isInternalNote: false,
      ...(whapiMessageId ? { whapiMessageId } : {}),
      createdAt: FieldValue.serverTimestamp(),
    };

    await msgRef.set(messageData);

    await db.collection('conversations').doc(conversationId).update({
      lastMessage: mediaType === 'image' ? '📷 Imagen' :
        mediaType === 'video' ? '🎥 Video' :
        mediaType === 'document' ? `📄 ${filename ?? 'Documento'}` :
        '🎤 Nota de voz',
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Media message sent: ${mediaType} to conversation ${conversationId}`);

    return { id: msgRef.id, sent: true };
  }
);
