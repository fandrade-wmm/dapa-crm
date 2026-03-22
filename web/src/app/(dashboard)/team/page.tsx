'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Mail,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { teamApi, type TeamMember, type InviteTeamMemberInput } from '@/lib/api';
import { cn } from '@/lib/utils';

const PERMISSION_LABELS: {
  key: keyof TeamMember['permissions'];
  label: string;
  desc: string;
}[] = [
  { key: 'conversations', label: 'Conversaciones', desc: 'Ver y responder conversaciones' },
  { key: 'crm', label: 'CRM', desc: 'Gestionar leads y oportunidades' },
  { key: 'automations', label: 'Automatizaciones', desc: 'Crear y gestionar automatizaciones' },
  { key: 'quickResponses', label: 'Resp. Rápidas', desc: 'Gestionar respuestas predefinidas' },
  { key: 'settings', label: 'Configuración', desc: 'Acceder a la configuración del sistema' },
];

const DEFAULT_PERMISSIONS: TeamMember['permissions'] = {
  conversations: true,
  crm: false,
  automations: false,
  quickResponses: true,
  settings: false,
};

function avatarInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteTeamMemberInput>({
    email: '',
    displayName: '',
    role: 'agent',
    permissions: DEFAULT_PERMISSIONS,
  });
  const [inviteError, setInviteError] = useState<string | null>(null);

  const {
    data: members = [],
    isLoading,
    isError,
    error,
  } = useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: () => teamApi.getAll(),
  });

  const inviteMutation = useMutation({
    mutationFn: () => teamApi.invite(inviteForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setInviteOpen(false);
      resetInviteForm();
    },
    onError: (err: Error) => setInviteError(err.message),
  });

  const updatePermMutation = useMutation({
    mutationFn: (vars: { id: string; permissions: TeamMember['permissions'] }) =>
      teamApi.update({ id: vars.id, permissions: vars.permissions }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      teamApi.update({ id: vars.id, isActive: vars.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => teamApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setRemoveId(null);
    },
  });

  function resetInviteForm() {
    setInviteForm({ email: '', displayName: '', role: 'agent', permissions: DEFAULT_PERMISSIONS });
    setInviteError(null);
  }

  function openInvite() {
    resetInviteForm();
    setInviteOpen(true);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los agentes y sus permisos de acceso.
            </p>
          </div>
          <Button onClick={openInvite} className="gap-2">
            <Plus className="w-4 h-4" /> Invitar miembro
          </Button>
        </div>
      </motion.div>

      <div className="mt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mb-3 opacity-60" />
            <p className="font-semibold">No se pudo cargar el equipo</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-10 h-10 text-muted-foreground mb-3 opacity-40" />
                <p className="font-medium text-muted-foreground">No hay miembros registrados</p>
              </div>
            )}

            {members.map((m) => {
              const isCurrentUser = m.id === currentUser?.uid;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'bg-card border rounded-xl overflow-hidden',
                    isCurrentUser && 'ring-2 ring-primary/30'
                  )}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Avatar */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white',
                        m.role === 'admin' ? 'bg-primary' : 'bg-slate-500'
                      )}
                    >
                      {avatarInitials(m.displayName)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{m.displayName ?? m.email}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                            Tú
                          </span>
                        )}
                        <Badge
                          variant={m.role === 'admin' ? 'default' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {m.role === 'admin' ? 'Admin' : 'Agente'}
                        </Badge>
                        {!m.isActive && (
                          <Badge variant="destructive" className="text-[10px] h-5">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                    </div>

                    {/* Actions */}
                    {!isCurrentUser && m.role !== 'admin' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={m.isActive}
                          onCheckedChange={(v) =>
                            toggleActiveMutation.mutate({ id: m.id, isActive: v })
                          }
                          title={m.isActive ? 'Desactivar acceso' : 'Activar acceso'}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Shield className="w-3 h-3" />
                          Permisos
                          {expandedId === m.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </Button>
                        <button
                          onClick={() => setRemoveId(m.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Permissions panel */}
                  <AnimatePresence>
                    {expandedId === m.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t px-4 py-4 bg-muted/40">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                            Acceso a secciones
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {PERMISSION_LABELS.map(({ key, label, desc }) => (
                              <div
                                key={key}
                                className="flex items-start justify-between gap-3 bg-background p-3 rounded-lg border"
                              >
                                <div>
                                  <p className="text-sm font-medium">{label}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                                </div>
                                <Switch
                                  checked={m.permissions[key]}
                                  onCheckedChange={(v) =>
                                    updatePermMutation.mutate({
                                      id: m.id,
                                      permissions: { ...m.permissions, [key]: v },
                                    })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          if (!o) setInviteOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Invitar miembro
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invite-name">Nombre *</Label>
                <Input
                  id="invite-name"
                  value={inviteForm.displayName}
                  onChange={(e) =>
                    setInviteForm((p) => ({ ...p, displayName: e.target.value }))
                  }
                  placeholder="Nombre del agente"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="invite-email">Correo electrónico *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="correo@empresa.com"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Permisos iniciales</Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted border"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <Switch
                      checked={inviteForm.permissions?.[key] ?? false}
                      onCheckedChange={(v) =>
                        setInviteForm((p) => ({
                          ...p,
                          permissions: { ...DEFAULT_PERMISSIONS, ...p.permissions, [key]: v },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setInviteOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => inviteMutation.mutate()}
                disabled={
                  !inviteForm.displayName.trim() ||
                  !inviteForm.email.trim() ||
                  inviteMutation.isPending
                }
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Invitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog
        open={removeId !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar miembro?</AlertDialogTitle>
            <AlertDialogDescription>
              El miembro perderá acceso al sistema. Podrás reactivarlo más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => removeId !== null && removeMutation.mutate(removeId)}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
