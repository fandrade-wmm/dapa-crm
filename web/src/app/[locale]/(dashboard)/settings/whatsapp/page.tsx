'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { metaApi, workspacesApi, type MetaStatus } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

// ---------- Status config ----------

const statusConfig: Record<
  MetaStatus,
  { label: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Conectado',
    icon:  <CheckCircle2 className="h-4 w-4 text-green-600" />,
  },
  offline: {
    label: 'Desconectado',
    icon:  <XCircle className="h-4 w-4 text-red-600" />,
  },
  not_configured: {
    label: 'No configurado',
    icon:  <AlertCircle className="h-4 w-4 text-gray-500" />,
  },
};

// ---------- Webhook URL ----------

function getWebhookUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/webhooks/meta`;
}

// ---------- Page ----------

export default function WhatsAppSettingsPage() {
  const { profile, workspace } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';

  const [copied,  setCopied]  = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saved,   setSaved]   = useState(false);
  const webhookUrl = getWebhookUrl();

  // Form state — pre-fill from workspace
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId,        setWabaId]        = useState('');
  const [accessToken,   setAccessToken]   = useState('');

  useEffect(() => {
    if (workspace) {
      setPhoneNumberId(workspace.metaPhoneNumberId ?? '');
      setWabaId(workspace.metaWabaId ?? '');
      // Don't pre-fill the token for security — show placeholder if set
      setAccessToken('');
    }
  }, [workspace]);

  // Connection status
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['metaStatus'],
    queryFn:  () => metaApi.getStatus(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const status = data?.status ?? (isLoading ? 'not_configured' : 'not_configured');
  const cfg    = statusConfig[status] ?? statusConfig['not_configured'];

  // Save credentials mutation
  const saveMutation = useMutation({
    mutationFn: () => workspacesApi.updateMetaCreds({
      metaPhoneNumberId: phoneNumberId,
      metaWabaId:        wabaId || undefined,
      metaAccessToken:   accessToken,
    }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['metaStatus'] });
      refetch();
    },
  });

  const copyWebhookUrl = useCallback(() => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [webhookUrl]);

  const canSave = isAdmin && phoneNumberId.trim() && accessToken.trim();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integración con la API oficial de Meta WhatsApp Cloud.
          {workspace && (
            <span className="ml-2 text-xs font-medium text-indigo-600">
              Workspace: {workspace.name}
            </span>
          )}
        </p>
      </div>

      {/* ── Connection status ── */}
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
              Error al verificar. Revisa que el Access Token sea válido.
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {cfg.icon}
              <span className="font-medium text-sm">{cfg.label}</span>
              {data?.phone && <Badge variant="secondary">+{data.phone}</Badge>}
              {data?.name  && <span className="text-sm text-muted-foreground">{data.name}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Active banner ── */}
      {status === 'active' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">¡WhatsApp conectado!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Los mensajes entrantes llegan automáticamente a <strong>Conversaciones</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Webhook URL ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL del Webhook</CardTitle>
          <CardDescription>
            Copia esta URL en Meta Developers → tu app → WhatsApp → Webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
            <code className="flex-1 break-all text-xs">{webhookUrl}</code>
            <Button variant="ghost" size="icon" onClick={copyWebhookUrl} className="shrink-0">
              {copied
                ? <Check className="h-4 w-4 text-green-600" />
                : <Copy className="h-4 w-4" />
              }
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Token de verificación: coincide con <code className="rounded bg-muted px-1">META_VERIFY_TOKEN</code> en tus variables de entorno de Vercel.
          </p>
        </CardContent>
      </Card>

      {/* ── Meta credentials form (admin only) ── */}
      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credenciales de Meta</CardTitle>
            <CardDescription>
              Configura las credenciales del número de WhatsApp Business de este workspace.
              Encuéntralas en{' '}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline text-blue-600"
              >
                developers.facebook.com <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone-number-id">Phone Number ID</Label>
              <Input
                id="phone-number-id"
                placeholder="123456789012345"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp → Configuration → Phone number ID
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="waba-id">WhatsApp Business Account ID <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="waba-id"
                placeholder="987654321098765"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="access-token">Access Token</Label>
              <div className="relative">
                <Input
                  id="access-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder={workspace?.metaAccessToken ? '••••••••  (ya configurado — pega uno nuevo para reemplazar)' : 'EAAxxxxx...'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Genera un System User Token permanente en Meta Business Settings para evitar expiración.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />
                }
                Guardar credenciales
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Guardado
                </span>
              )}
              {saveMutation.isError && (
                <span className="text-sm text-red-600">
                  {saveMutation.error instanceof Error
                    ? saveMutation.error.message
                    : 'Error al guardar'}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 text-sm text-amber-800">
            Las credenciales de WhatsApp solo pueden ser configuradas por un administrador.
            Contacta al admin de tu workspace para actualizar la integración.
          </CardContent>
        </Card>
      )}

      {/* ── Setup guide ── */}
      {status !== 'active' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guía de configuración</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="ml-4 list-decimal space-y-2">
              <li>
                Ve a{' '}
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">
                  developers.facebook.com <ExternalLink className="h-3 w-3" />
                </a>{' '}
                y abre tu app → <strong>WhatsApp → Configuration</strong>.
              </li>
              <li>Copia el <strong>Phone Number ID</strong> y pégalo arriba.</li>
              <li>
                En <strong>Meta Business Settings → System Users</strong>, crea un System User con rol <em>Admin</em>, genera un token permanente con permisos <code>whatsapp_business_messaging</code> y pégalo arriba.
              </li>
              <li>
                En la app → <strong>Webhooks</strong>, agrega la URL del webhook que aparece arriba y el <code>META_VERIFY_TOKEN</code> que pusiste en Vercel. Activa el campo <strong>messages</strong>.
              </li>
              <li>Guarda las credenciales y presiona <strong>Actualizar</strong> para verificar la conexión.</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
