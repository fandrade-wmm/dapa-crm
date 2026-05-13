'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { metaApi, type MetaStatus } from '@/lib/api';

// ---------- Status config ----------

const statusConfig: Record<
  MetaStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Conectado',
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
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
  return `${base}/api/webhooks/meta`;
}

// ---------- Page ----------

export default function WhatsAppSettingsPage() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = getWebhookUrl();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['metaStatus'],
    queryFn: () => metaApi.getStatus(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const status = data?.status ?? (isLoading ? 'not_configured' : 'not_configured');
  const cfg    = statusConfig[status] ?? statusConfig['not_configured'];

  const copyWebhookUrl = useCallback(() => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [webhookUrl]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integración con la API oficial de Meta WhatsApp Cloud.
        </p>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Estado de conexión</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="ml-1">Actualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              Error al verificar el estado. Revisa que{' '}
              <code className="rounded bg-red-50 px-1">META_ACCESS_TOKEN</code> esté configurado.
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {cfg.icon}
              <span className="font-medium">{cfg.label}</span>
              <Badge className={cfg.color} variant="outline">{cfg.label}</Badge>
              {data?.phone && <Badge variant="secondary">+{data.phone}</Badge>}
              {data?.name  && <span className="text-sm text-muted-foreground">{data.name}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active connection */}
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

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL del Webhook</CardTitle>
          <CardDescription>
            Configura esta URL en el panel de Meta para Developers (Webhooks de WhatsApp Business).
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
          <p className="text-xs text-muted-foreground">
            Token de verificación:{' '}
            <code className="rounded bg-muted px-1">META_VERIFY_TOKEN</code> (configura el mismo valor en Vercel y en Meta).
          </p>
        </CardContent>
      </Card>

      {/* Setup guide */}
      {status !== 'active' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base text-blue-800">Cómo configurar la API de Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-blue-800">
            <ol className="ml-4 list-decimal space-y-2">
              <li>
                Ve a{' '}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  developers.facebook.com <ExternalLink className="h-3 w-3" />
                </a>{' '}
                y crea (o abre) tu app de WhatsApp Business.
              </li>
              <li>
                En <strong>WhatsApp → Configuración</strong>, copia el{' '}
                <code className="rounded bg-blue-100 px-1">ID de número de teléfono</code> →{' '}
                variable <code className="rounded bg-blue-100 px-1">META_PHONE_NUMBER_ID</code>.
              </li>
              <li>
                Genera un <strong>Token de acceso permanente</strong> (o usa el temporal para pruebas) →{' '}
                variable <code className="rounded bg-blue-100 px-1">META_ACCESS_TOKEN</code>.
              </li>
              <li>
                En <strong>WhatsApp → Configuración → Webhooks</strong>:
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>Pega la URL del webhook que aparece arriba.</li>
                  <li>Inventa un token secreto y ponlo como <code className="rounded bg-blue-100 px-1">META_VERIFY_TOKEN</code> en Vercel.</li>
                  <li>Activa el campo <strong>messages</strong>.</li>
                </ul>
              </li>
              <li>
                Copia el <strong>App Secret</strong> de la app →{' '}
                variable <code className="rounded bg-blue-100 px-1">META_APP_SECRET</code>.
              </li>
              <li>
                En Vercel, añade el ID de usuario Supabase del administrador como{' '}
                <code className="rounded bg-blue-100 px-1">META_OWNER_ID</code>.
              </li>
              <li>Re-despliega en Vercel para activar las variables.</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
