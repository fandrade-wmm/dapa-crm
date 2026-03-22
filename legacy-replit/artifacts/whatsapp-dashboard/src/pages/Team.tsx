import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Mail, Shield, UserCheck, UserX, Trash2, Copy, Clock,
  CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type UserPermissions } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface TeamMember {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  permissions: UserPermissions;
  isActive: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  isCurrentUser: boolean;
  isPendingInvite: boolean;
  lastLoginAt?: string;
  createdAt: string;
  inviteToken?: string;
  inviteExpires?: string;
}

const PERMISSION_LABELS: { key: keyof UserPermissions; label: string; desc: string }[] = [
  { key: "conversations", label: "Conversaciones", desc: "Ver y responder conversaciones de WhatsApp" },
  { key: "products", label: "Productos", desc: "Ver catálogo de productos de Odoo" },
  { key: "crm", label: "CRM", desc: "Gestionar leads y oportunidades de venta" },
  { key: "catalogues", label: "Catálogos PDF", desc: "Subir y gestionar catálogos en PDF" },
  { key: "bot", label: "Entrenamiento IA", desc: "Modificar base de conocimiento del bot" },
  { key: "automations", label: "Automatizaciones", desc: "Crear y gestionar workflows automáticos" },
  { key: "quickResponses", label: "Respuestas Rápidas", desc: "Gestionar mensajes predefinidos" },
  { key: "settings", label: "Configuración", desc: "Acceder a configuración del sistema" },
];

const DEFAULT_NEW_PERMISSIONS: UserPermissions = {
  conversations: true,
  products: true,
  crm: false,
  catalogues: false,
  bot: false,
  automations: false,
  quickResponses: true,
  settings: false,
};

function avatarInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function Team() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string; name: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", permissions: DEFAULT_NEW_PERMISSIONS });

  const { data: members = [], isLoading, isError, error } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: async () => {
      const res = await fetch(`${API}/team`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/auth/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(inviteForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setInviteResult({ inviteUrl: data.inviteUrl, name: data.name });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updatePermMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: number; permissions: UserPermissions }) => {
      const res = await fetch(`${API}/team/${id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Permisos actualizados" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`${API}/team/${id}/toggle-active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/team/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Agente eliminado" });
      setDeleteId(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  function copyInviteLink(url: string) {
    navigator.clipboard.writeText(url);
    toast({ title: "Enlace copiado al portapapeles" });
  }

  function openInvite() {
    setInviteForm({ name: "", email: "", permissions: DEFAULT_NEW_PERMISSIONS });
    setInviteResult(null);
    setInviteOpen(true);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Equipo</h1>
            <p className="text-muted-foreground mt-1">Gestiona los agentes y sus permisos de acceso.</p>
          </div>
          <Button onClick={openInvite} className="gap-2">
            <Plus className="w-4 h-4" /> Invitar agente
          </Button>
        </div>
      </motion.div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mb-3 opacity-60" />
            <p className="font-semibold text-foreground">No se pudo cargar el equipo</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-10 h-10 text-muted-foreground mb-3 opacity-40" />
                <p className="font-medium text-muted-foreground">No hay agentes registrados</p>
              </div>
            )}
            {members.map((m) => (
              <motion.div key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border border-border rounded-2xl overflow-hidden">
                {/* Member header */}
                <div className="flex items-center gap-4 p-4">
                  <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white", m.role === "admin" ? "bg-primary" : "bg-slate-500")}>
                    {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full rounded-full object-cover" /> : avatarInitials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{m.name}</span>
                      {m.isCurrentUser && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">Tú</span>}
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", m.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                        {m.role === "admin" ? "Administrador" : "Agente"}
                      </span>
                      {m.isPendingInvite && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><Clock className="w-3 h-3" />Pendiente</span>}
                      {!m.isActive && !m.isPendingInvite && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Inactivo</span>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!m.isCurrentUser && m.role !== "admin" && (
                      <>
                        <Switch
                          checked={m.isActive}
                          onCheckedChange={(v) => toggleActiveMutation.mutate({ id: m.id, isActive: v })}
                          title={m.isActive ? "Desactivar acceso" : "Activar acceso"}
                        />
                        <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className="h-8 gap-1 text-xs">
                          Permisos {expandedId === m.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                        <button onClick={() => setDeleteId(m.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {m.isPendingInvite && m.inviteToken && (
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => {
                        const url = process.env.NODE_ENV === "production"
                          ? `${window.location.origin}${BASE}/accept-invite?token=${m.inviteToken}`
                          : `${window.location.origin}${BASE}/accept-invite?token=${m.inviteToken}`;
                        copyInviteLink(url);
                      }}>
                        <Copy className="w-3 h-3" /> Copiar enlace
                      </Button>
                    )}
                  </div>
                </div>

                {/* Permissions panel */}
                <AnimatePresence>
                  {expandedId === m.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border-t border-border px-4 py-4 bg-slate-50/60">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Acceso a secciones</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {PERMISSION_LABELS.map(({ key, label, desc }) => (
                            <div key={key} className="flex items-start justify-between gap-3 bg-white p-3 rounded-xl border border-border">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                              </div>
                              <Switch
                                checked={m.permissions[key]}
                                onCheckedChange={(v) => {
                                  const newPerms = { ...m.permissions, [key]: v };
                                  updatePermMutation.mutate({ id: m.id, permissions: newPerms });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">Los cambios se aplican inmediatamente al próximo inicio de sesión.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) setInviteOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {inviteResult ? "Invitación creada" : "Invitar agente"}
            </DialogTitle>
          </DialogHeader>

          {inviteResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Invitación creada para {inviteResult.name}</p>
                  <p className="text-sm text-emerald-700 mt-0.5">Comparte este enlace para que active su cuenta. El enlace expira en 7 días.</p>
                </div>
              </div>

              <div className="relative">
                <div className="bg-muted rounded-xl p-3 pr-10 font-mono text-xs break-all text-foreground border border-border select-all">
                  {inviteResult.inviteUrl}
                </div>
                <button
                  onClick={() => copyInviteLink(inviteResult.inviteUrl)}
                  className="absolute right-2 top-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Copiar"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {window.location.hostname.includes("janeway") && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Nota:</strong> Estás en el entorno de vista previa. Para compartir un enlace estable, envía invitaciones desde el sitio publicado.
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => copyInviteLink(inviteResult.inviteUrl)}>
                  <Copy className="w-4 h-4" /> Copiar enlace
                </Button>
                <Button className="flex-1" onClick={() => setInviteOpen(false)}>Listo</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={inviteForm.name} onChange={(e) => setInviteForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del agente" className="mt-1" />
                </div>
                <div>
                  <Label>Correo electrónico *</Label>
                  <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@empresa.com" className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Permisos iniciales</Label>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {PERMISSION_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted border border-border">
                      <span className="text-xs font-medium">{label}</span>
                      <Switch
                        checked={inviteForm.permissions[key]}
                        onCheckedChange={(v) => setInviteForm(p => ({ ...p, permissions: { ...p.permissions, [key]: v } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteForm.name.trim() || !inviteForm.email.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Generar invitación
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar agente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. El agente perderá todo acceso.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
