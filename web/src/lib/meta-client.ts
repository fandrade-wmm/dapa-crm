/**
 * Meta WhatsApp Cloud API client
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * All functions accept an optional `WorkspaceCreds` argument.
 * When provided, those values are used; otherwise the functions
 * fall back to the env vars (useful for single-tenant dev/testing).
 */

const GRAPH = 'https://graph.facebook.com/v20.0';

// ── Per-workspace credentials ─────────────────────────────────

export interface WorkspaceCreds {
  phoneNumberId: string;
  accessToken:   string;
}

function resolveCreds(creds?: WorkspaceCreds): WorkspaceCreds {
  return {
    phoneNumberId: creds?.phoneNumberId ?? process.env.META_PHONE_NUMBER_ID!,
    accessToken:   creds?.accessToken   ?? process.env.META_ACCESS_TOKEN!,
  };
}

function authHeaders(accessToken: string) {
  return {
    Authorization:  `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function metaPost<T>(
  path:        string,
  body:        unknown,
  accessToken: string,
): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    method:  'POST',
    headers: authHeaders(accessToken),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function metaGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Meta GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────

export type MetaMediaType = 'image' | 'video' | 'document' | 'audio';
export type MetaStatus    = 'active' | 'offline' | 'not_configured';

export interface MetaStatusResult {
  status: MetaStatus;
  phone?: string;
  name?:  string;
}

// ── Helpers ───────────────────────────────────────────────────

/** Strip non-digits: "+593 98 765-4321" → "593987654321" */
export function toE164(phone: string): string {
  return phone.replace(/\D/g, '');
}

// ── Status ────────────────────────────────────────────────────

export async function getPhoneStatus(
  creds?: WorkspaceCreds,
): Promise<MetaStatusResult> {
  const { phoneNumberId, accessToken } = resolveCreds(creds);

  if (!accessToken || !phoneNumberId) {
    return { status: 'not_configured' };
  }
  try {
    const data = await metaGet<{
      display_phone_number?: string;
      verified_name?:        string;
    }>(`/${phoneNumberId}?fields=display_phone_number,verified_name`, accessToken);
    return {
      status: 'active',
      phone:  data.display_phone_number,
      name:   data.verified_name,
    };
  } catch {
    return { status: 'offline' };
  }
}

// ── Send ──────────────────────────────────────────────────────

interface MetaSendResponse {
  messaging_product: string;
  contacts:  { input: string; wa_id: string }[];
  messages:  { id: string }[];
}

export async function sendText(
  to:     string,
  body:   string,
  creds?: WorkspaceCreds,
): Promise<{ id: string }> {
  const { phoneNumberId, accessToken } = resolveCreds(creds);
  const r = await metaPost<MetaSendResponse>(
    `/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    },
    accessToken,
  );
  return { id: r.messages[0].id };
}

export async function sendMedia(
  to:       string,
  type:     MetaMediaType,
  mediaUrl: string,
  caption?: string,
  filename?: string,
  creds?:   WorkspaceCreds,
): Promise<{ id: string }> {
  const { phoneNumberId, accessToken } = resolveCreds(creds);
  const mediaObj: Record<string, string> = { link: mediaUrl };
  if (caption)  mediaObj.caption  = caption;
  if (filename && type === 'document') mediaObj.filename = filename;

  const r = await metaPost<MetaSendResponse>(
    `/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type,
      [type]: mediaObj,
    },
    accessToken,
  );
  return { id: r.messages[0].id };
}

// ── Media download ─────────────────────────────────────────────

/**
 * Get the temporary download URL for a media object (expires in ~5 min).
 */
export async function getMediaUrl(
  mediaId: string,
  creds?:  WorkspaceCreds,
): Promise<string> {
  const { accessToken } = resolveCreds(creds);
  const data = await metaGet<{ url: string }>(`/${mediaId}`, accessToken);
  return data.url;
}

/**
 * Download media bytes from Meta's CDN (requires auth header).
 */
export async function downloadMetaMedia(
  url:    string,
  creds?: WorkspaceCreds,
): Promise<{ buffer: Buffer; contentType: string }> {
  const { accessToken } = resolveCreds(creds);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const buffer      = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}
