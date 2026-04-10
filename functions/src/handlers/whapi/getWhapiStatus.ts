import { https, logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { verifyAuth } from '../../middleware/auth';
import { getChannelHealth, getChannelQR, extractQRCode } from './whapiClient';

const whapiApiToken = defineSecret('WHAPI_API_TOKEN');

export interface WhapiStatusResult {
  status: 'active' | 'loading' | 'qr' | 'offline' | 'not_configured';
  phone?: string;
  name?: string;
  qrCode?: string;
}

/** Normalize whatever Whapi returns into our simple status string */
function normalizeStatus(
  raw: string | { code: number; text: string } | undefined
): WhapiStatusResult['status'] {
  const text =
    typeof raw === 'string'
      ? raw.toLowerCase()
      : typeof raw === 'object' && raw !== null
        ? raw.text.toLowerCase()
        : '';

  if (text === 'active' || text === 'authenticated' || text === 'connected' || text === 'auth') return 'active';
  if (text === 'qr' || text === 'scan_qr_code') return 'qr';
  if (text === 'loading' || text === 'init' || text === 'launch' || text === 'connecting') return 'loading';
  if (text === 'stop' || text === 'stopped' || text === 'offline' || text === 'disconnected') return 'offline';

  logger.warn(`Unknown Whapi status: ${JSON.stringify(raw)}`);
  return 'loading';
}

export const getWhapiStatus = https.onCall<void, Promise<WhapiStatusResult>>(
  { secrets: [whapiApiToken] },
  async (request) => {
    await verifyAuth(request);

    const token = whapiApiToken.value();
    if (!token) {
      return { status: 'not_configured' };
    }
    // Make token available to whapiClient via process.env
    process.env.WHAPI_API_TOKEN = token;

    try {
      const health = await getChannelHealth();
      logger.info('Whapi health response:', JSON.stringify(health));

      const status = normalizeStatus(health.status);
      const phone = health.phone ?? health.device?.phone ?? health.user?.id;
      const name = health.name ?? health.device?.name ?? health.user?.name;

      if (status === 'qr') {
        try {
          const qr = await getChannelQR();
          return { status: 'qr', qrCode: extractQRCode(qr) };
        } catch (qrErr) {
          logger.warn('Could not fetch QR code:', qrErr);
          return { status: 'qr' };
        }
      }

      return { status, phone, name };
    } catch (err) {
      logger.error('Error fetching Whapi channel status:', err);
      throw new https.HttpsError('internal', 'No se pudo obtener el estado de WhatsApp.');
    }
  }
);
