const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

function getToken(): string {
  const token = process.env.WHAPI_API_TOKEN;
  if (!token) throw new Error('WHAPI_API_TOKEN not configured');
  return token;
}

async function whapiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${WHAPI_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whapi GET ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function whapiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${WHAPI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whapi POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface WhapiChannelHealth {
  status?: string | { code: number; text: string };
  phone?: string;
  name?: string;
  device?: { phone?: string; name?: string };
  user?: { id?: string; name?: string; is_business?: boolean };
}

export interface WhapiQRResponse {
  // Whapi returns the base64 QR image — field name varies by version
  qr_code?: string;
  base64?: string;
  image?: string;
  status?: string;
}

export interface WhapiSendTextResponse {
  sent: boolean;
  id?: string;
}

export async function getChannelHealth(): Promise<WhapiChannelHealth> {
  return whapiGet<WhapiChannelHealth>('/health');
}

export async function getChannelQR(): Promise<WhapiQRResponse> {
  // Correct Whapi endpoint for QR login
  return whapiGet<WhapiQRResponse>('/users/login');
}

/** Extract the base64 QR image regardless of which field Whapi uses */
export function extractQRCode(qr: WhapiQRResponse): string | undefined {
  return qr.qr_code ?? qr.base64 ?? qr.image;
}

/**
 * Send a text message via Whapi.
 * chatId format: "521234567890@s.whatsapp.net"
 */
export async function sendTextMessage(
  chatId: string,
  text: string
): Promise<WhapiSendTextResponse> {
  return whapiPost<WhapiSendTextResponse>('/messages/text', {
    to: chatId,
    body: text,
  });
}

/** Build the WhatsApp chatId from a plain phone number */
export function toChatId(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return `${clean}@s.whatsapp.net`;
}

export interface WhapiSendMediaResponse {
  sent: boolean;
  id?: string;
}

export async function sendImageMessage(
  chatId: string,
  mediaUrl: string,
  caption?: string
): Promise<WhapiSendMediaResponse> {
  return whapiPost<WhapiSendMediaResponse>('/messages/image', {
    to: chatId,
    media: mediaUrl,
    ...(caption ? { caption } : {}),
  });
}

export async function sendVideoMessage(
  chatId: string,
  mediaUrl: string,
  caption?: string
): Promise<WhapiSendMediaResponse> {
  return whapiPost<WhapiSendMediaResponse>('/messages/video', {
    to: chatId,
    media: mediaUrl,
    ...(caption ? { caption } : {}),
  });
}

export async function sendDocumentMessage(
  chatId: string,
  mediaUrl: string,
  filename: string,
  caption?: string
): Promise<WhapiSendMediaResponse> {
  return whapiPost<WhapiSendMediaResponse>('/messages/document', {
    to: chatId,
    media: mediaUrl,
    filename,
    ...(caption ? { caption } : {}),
  });
}

export async function sendVoiceMessage(
  chatId: string,
  mediaUrl: string
): Promise<WhapiSendMediaResponse> {
  return whapiPost<WhapiSendMediaResponse>('/messages/voice', {
    to: chatId,
    media: mediaUrl,
  });
}
