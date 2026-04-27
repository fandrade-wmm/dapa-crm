const BASE     = process.env.EVOLUTION_API_URL!;
const API_KEY  = process.env.EVOLUTION_API_KEY!;
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

function headers() {
  return { apikey: API_KEY, 'Content-Type': 'application/json' };
}

async function evoGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Evolution GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function evoPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────

export type ConnectionStatus = 'active' | 'loading' | 'qr' | 'offline' | 'not_configured';

export interface StatusResult {
  status: ConnectionStatus;
  phone?: string;
  name?: string;
  qrCode?: string;
}

export type MediaType = 'image' | 'video' | 'document' | 'audio';

// ── Helpers ──────────────────────────────────────────────

function normalizeState(state: string | undefined): ConnectionStatus {
  switch (state?.toLowerCase()) {
    case 'open':       return 'active';
    case 'connecting': return 'loading';
    case 'close':      return 'qr';
    default:           return 'offline';
  }
}

/** Strip non-digits: "+52 55 1234-5678" → "5215512345678" */
export function toEvolutionNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// ── Public API ────────────────────────────────────────────

export async function getInstanceStatus(): Promise<StatusResult> {
  if (!process.env.EVOLUTION_API_KEY) return { status: 'not_configured' };

  try {
    const data = await evoGet<{ instance?: { state?: string } }>(
      `/instance/connectionState/${INSTANCE}`
    );
    const status = normalizeState(data.instance?.state);

    if (status === 'qr') {
      try {
        const qr = await evoGet<{ base64?: string; code?: string }>(
          `/instance/connect/${INSTANCE}`
        );
        return { status: 'qr', qrCode: qr.base64 ?? qr.code };
      } catch {
        return { status: 'qr' };
      }
    }

    return { status };
  } catch {
    return { status: 'offline' };
  }
}

export async function sendText(
  to: string,
  text: string
): Promise<{ key?: { id?: string } }> {
  return evoPost(`/message/sendText/${INSTANCE}`, { number: to, text });
}

export async function sendMedia(
  to: string,
  mediatype: MediaType,
  media: string,
  caption?: string,
  fileName?: string
): Promise<{ key?: { id?: string } }> {
  return evoPost(`/message/sendMedia/${INSTANCE}`, {
    number: to,
    mediatype,
    media,
    ...(caption  ? { caption }  : {}),
    ...(fileName ? { fileName } : {}),
  });
}
