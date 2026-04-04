'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  MessageSquare,
  Hash,
  Clock,
  Tag,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  automationsApi,
  type Automation,
  type CreateAutomationInput,
  type AutomationTriggerType,
  type AutomationActionType,
} from '@/lib/api';

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string; icon: React.ElementType }[] =
  [
    { value: 'message_received', label: 'Mensaje recibido', icon: MessageSquare },
    { value: 'keyword_match', label: 'Coincidencia de palabra clave', icon: Hash },
    { value: 'time_based', label: 'Basado en tiempo', icon: Clock },
  ];

const ACTION_OPTIONS: { value: AutomationActionType; label: string; icon: React.ElementType }[] = [
  { value: 'send_message', label: 'Enviar mensaje', icon: MessageSquare },
  { value: 'assign_agent', label: 'Asignar agente', icon: UserCheck },
  { value: 'add_label', label: 'Agregar etiqueta', icon: Tag },
];

function triggerLabel(type: AutomationTriggerType): string {
  return TRIGGER_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

const EMPTY_FORM: CreateAutomationInput = {
  name: '',
  description: '',
  trigger: { type: 'message_received' },
  actions: [],
  isActive: true,
};

export default function AutomationsPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [form, setForm] = useState<CreateAutomationInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: automations = [],
    isLoading,
    isError,
    error,
  } = useQuery<Automation[]>({
    queryKey: ['automations'],
    queryFn: () => automationsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAutomationInput) => automationsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      closeDialog();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string } & Partial<CreateAutomationInput>) =>
      automationsApi.update(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      closeDialog();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      setDeleteId(null);
    },
  });

  function openCreate() {
    setEditingAutomation(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(a: Automation) {
    setEditingAutomation(a);
    setForm({
      name: a.name,
      description: a.description ?? '',
      trigger: a.trigger,
      actions: a.actions,
      isActive: a.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingAutomation(null);
    setFormError(null);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      setFormError('El nombre es requerido.');
      return;
    }
    if (editingAutomation) {
      updateMutation.mutate({ id: editingAutomation.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  function addAction(type: AutomationActionType) {
    setForm((p) => ({ ...p, actions: [...p.actions, { type }] }));
  }

  function removeAction(index: number) {
    setForm((p) => ({ ...p, actions: p.actions.filter((_, i) => i !== index) }));
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Automatizaciones</h1>
            <p className="text-muted-foreground mt-1">
              Automatiza acciones en base a disparadores y condiciones.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva automatización
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3 opacity-60" />
          <p className="font-semibold">No se pudieron cargar las automatizaciones</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message}</p>
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
          <p className="font-medium text-muted-foreground">No hay automatizaciones</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crea tu primera automatización para comenzar.
          </p>
          <Button onClick={openCreate} className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Nueva automatización
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {automations.map((a) => {
            const TriggerIcon =
              TRIGGER_OPTIONS.find((t) => t.value === a.trigger.type)?.icon ?? Zap;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold line-clamp-1">
                        {a.name}
                      </CardTitle>
                      <Switch
                        checked={a.isActive}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: a.id, isActive: v })
                        }
                        className="shrink-0 mt-0.5"
                      />
                    </div>
                    {a.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {a.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TriggerIcon className="w-4 h-4 shrink-0" />
                      <span>{triggerLabel(a.trigger.type)}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {a.actions.length} acción{a.actions.length !== 1 ? 'es' : ''}
                      </Badge>
                      <Badge
                        variant={a.isActive ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {a.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:bg-red-50"
                        onClick={() => setDeleteId(a.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {editingAutomation ? 'Editar automatización' : 'Nueva automatización'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="auto-name">Nombre *</Label>
              <Input
                id="auto-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Respuesta bienvenida"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="auto-desc">Descripción</Label>
              <Textarea
                id="auto-desc"
                value={form.description ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descripción opcional"
                className="mt-1 resize-none"
                rows={2}
              />
            </div>

            <div>
              <Label className="mb-2 block">Disparador</Label>
              <div className="grid grid-cols-1 gap-2">
                {TRIGGER_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, trigger: { type: value } }))}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors ${
                      form.trigger.type === value
                        ? 'bg-primary/5 border-primary/40 text-primary font-medium'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Acciones</Label>
                <span className="text-xs text-muted-foreground">
                  {form.actions.length} configurada{form.actions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {form.actions.length > 0 && (
                <div className="space-y-2 mb-2">
                  {form.actions.map((action, i) => {
                    const opt = ACTION_OPTIONS.find((a) => a.value === action.type);
                    const Icon = opt?.icon ?? Zap;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 bg-muted rounded-lg border"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span>{opt?.label ?? action.type}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAction(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {ACTION_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => addAction(value)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-dashed hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
              <div>
                <p className="text-sm font-medium">Activa</p>
                <p className="text-xs text-muted-foreground">La automatización se ejecutará inmediatamente</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingAutomation ? (
                  'Guardar cambios'
                ) : (
                  'Crear automatización'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
