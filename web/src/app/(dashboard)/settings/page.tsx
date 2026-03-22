'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, User, MessageSquare, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { statsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [botSaved, setBotSaved] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getStats(),
  });

  const toggleBotMutation = useMutation({
    mutationFn: (enabled: boolean) => statsApi.toggleBot(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setBotSaved(true);
      setTimeout(() => setBotSaved(false), 2000);
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu cuenta y la configuración del sistema.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" />
            Perfil
          </CardTitle>
          <CardDescription>Tu información de cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="display-name">Nombre</Label>
            <Input
              id="display-name"
              value={user?.displayName ?? ''}
              readOnly
              className="mt-1 bg-muted cursor-not-allowed"
            />
          </div>
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              value={user?.email ?? ''}
              readOnly
              className="mt-1 bg-muted cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>Rol</Label>
            <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
              {user?.role ?? 'agente'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Bot Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4" />
            Configuración del Bot
          </CardTitle>
          <CardDescription>
            Controla el comportamiento del asistente de IA globalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
            <div>
              <p className="font-medium text-sm">Respuestas automáticas de IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                El bot responderá automáticamente a los mensajes entrantes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {toggleBotMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {botSaved && !toggleBotMutation.isPending && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <Switch
                checked={stats?.botEnabled ?? false}
                onCheckedChange={(v) => toggleBotMutation.mutate(v)}
                disabled={toggleBotMutation.isPending || stats === undefined}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            Integración de WhatsApp
          </CardTitle>
          <CardDescription>
            Información sobre la conexión con WhatsApp Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Canal configurado por el administrador</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                WhatsApp Business está conectado a través de la API de Meta.
                Las conversaciones entrantes se gestionan en la sección de Conversaciones.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Para modificar la integración de WhatsApp o agregar nuevos canales, contacta
            al administrador del sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
