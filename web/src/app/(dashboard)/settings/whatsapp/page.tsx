'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { whapiApi, type WhapiStatus } from '@/lib/api';

// ---------- Status helpers ----------

const statusConfig: Record<
  WhapiStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Conectado',
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  },
  loading: {
    label: 'Conectando…',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />,
  },
  qr: {
    label: 'Escanear QR',
    color: 'bg-blue-100 text-blue-800',
    icon: <Smartphone className="h-4 w-4 text-blue-600" />,
  },
  offline: {
    label: 'Desconectado',
    color: 'bg-red-100 text-red-800',
    icon: <XCircle className="h-4 w-4 text-red-600" />,
  },
  not_configured: {
    label: 'No configurado',
    color: 'bg-gray-100 text-gray-600',
    icon: <AlertCircle className="h-4 w-4 text-gray-500" />,
  },
};

// ---------- Webhook URL helper ----------

function getWebhookUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/webhooks/evolution`;
}

// ---------- Page ----------

export default function WhatsAppSettingsPage() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = getWebhookUrl();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['whapiStatus'],
    queryFn: () => whapiApi.getStatus(),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll more frequently while waiting for QR scan or connection
      if (status === 'qr' || status === 'loading') return 5000;
      return 30000;
    },
    retry: 1,
  });

  const status = data?.status ?? (isLoading ? 'loading' : 'not_configured');
  const cfg = statusConfig[status] ?? statusConfig['not_configured'];

  const copyWebhookUrl = useCallback(() => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [webhookUrl]);

  // Auto-refetch when loading or qr so user sees transition to active
  useEffect(() => {
    if (status === 'qr' || status === 'loading') {
      const t = setInterval(() => refetch(), 5000);
      return () => clearInterval(t);
    }
  }, [status, refetch]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta tu número de WhatsApp Business para recibir y responder mensajes desde el CRM.
        </p>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Estado de conexión</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="ml-1">Actualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              Error al obtener el estado. Verifica que{' '}
              <code className="rounded bg-red-50 px-1">WHAPI_API_TOKEN</code> esté configurado.
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {cfg.icon}
              <span className="font-medium">{cfg.label}</span>
              {data?.phone && (
                <Badge variant="secondary">+{data.phone}</Badge>
              )}
              {data?.name && (
                <span className="text-sm text-muted-foreground">{data.name}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR code card — only shown when status is 'qr' */}
      {status === 'qr' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escanea el código QR</CardTitle>
            <CardDescription>
              Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular un dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {data?.qrCode ? (
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <img
                  src={data.qrCode}
                  alt="WhatsApp QR Code"
                  className="h-64 w-64"
                />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-xl border bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              El código se actualiza automáticamente. Una vez escaneado, la página mostrará{' '}
              <span className="font-medium text-green-600">Conectado</span>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active connection info */}
      {status === 'active' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">¡WhatsApp conectado!</p>
                <p className="text-sm text-green-700">
                  Los mensajes entrantes llegarán automáticamente a{' '}
                  <strong>Conversaciones</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook URL card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL del Webhook</CardTitle>
          <CardDescription>
            Configura esta URL en Evolution API (Railway → Instancia → Webhooks) para recibir mensajes entrantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
            <code className="flex-1 break-all text-sm">{webhookUrl}</code>
            <Button variant="ghost" size="icon" onClick={copyWebhookUrl} className="shrink-0">
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <ol className="space-y-1 text-sm text-muted-foreground">
            <li>1. Ve a <strong>whapi.cloud</strong> → tu canal → <strong>Settings</strong></li>
            <li>2. En <strong>Webhooks</strong>, pega la URL de arriba</li>
            <li>3. Activa el evento <strong>messages</strong></li>
            <li>4. Guarda los cambios</li>
          </ol>
        </CardContent>
      </Card>

      {/* Setup guide for not_configured */}
      {status === 'not_configured' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-base text-orange-800">
              Configuración requerida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-orange-700">
            <p>Para activar WhatsApp configura estas variables en Vercel:</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Despliega <strong>Evolution API</strong> en Railway (plantilla disponible en evolutionapi.com)</li>
              <li>Copia la URL de Railway → <code className="rounded bg-orange-100 px-1">EVOLUTION_API_URL</code></li>
              <li>Copia la API Key → <code className="rounded bg-orange-100 px-1">EVOLUTION_API_KEY</code></li>
              <li>Define un nombre de instancia (ej. <em>pancho-dapa-crm</em>) → <code className="rounded bg-orange-100 px-1">EVOLUTION_INSTANCE_NAME</code></li>
              <li>Define un secreto para webhooks → <code className="rounded bg-orange-100 px-1">EVOLUTION_WEBHOOK_SECRET</code></li>
              <li>En Evolution API, configura el webhook apuntando a la URL mostrada arriba</li>
              <li>Re-despliega en Vercel — el QR aparecerá aquí para escanear</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
