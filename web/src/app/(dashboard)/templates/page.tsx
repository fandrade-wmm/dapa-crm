'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutTemplate, Plus, Pencil, Trash2, X, Save, Copy, CheckCircle2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  templatesApi,
  type Template,
  type CreateTemplateInput,
} from '@/lib/api';

const CATEGORIES = [
  { value: 'utility',        label: 'Utilidad',      className: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'marketing',      label: 'Marketing',     className: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'authentication', label: 'Autenticación', className: 'bg-amber-100 text-amber-700 border-amber-200' },
];

function getCategoryInfo(cat: string) {
  return (
    CATEGORIES.find((c) => c.value === cat) ?? {
      value: cat,
      label: cat,
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface TemplateModalProps {
  template: Template | null;
  onClose: () => void;
  onSave: (data: CreateTemplateInput) => void;
  isSaving: boolean;
}

function TemplateModal({ template, onClose, onSave, isSaving }: TemplateModalProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState(template?.category ?? 'utility');
  const [content, setContent] = useState(template?.content ?? '');

  const isValid = name.trim().length > 0 && content.trim().length > 0;

  function buildPayload(): CreateTemplateInput {
    return {
      name,
      category,
      content,
      language: template?.language ?? 'es',
      isActive: template?.isActive ?? true,
    };
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutTemplate className="w-4 h-4 text-primary" />
            </div>
            {template ? 'Editar plantilla' : 'Nueva plantilla'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nombre de la plantilla</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bienvenida, Seguimiento pedido..."
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all',
                    category === cat.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label>Contenido del mensaje</Label>
            <p className="text-xs text-muted-foreground">
              Usa {'{{1}}'}, {'{{2}}'}, etc. para variables personalizadas (nombre, número de pedido, etc.)
            </p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ej: Hola {{1}}, gracias por contactar a DAPA Home. Estamos revisando tu consulta sobre {{2}} y te responderemos pronto. 🏠"
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{content.length} caracteres</p>
          </div>

          {/* Meta note */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <strong>Nota Meta:</strong> Para usar plantillas en conversaciones nuevas (fuera de las 24h), deben ser aprobadas por Meta. Esta interfaz te ayuda a preparar y organizar tus mensajes.
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => onSave(buildPayload())}
              disabled={!isValid || isSaving}
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="w-4 h-4" /> {template ? 'Guardar cambios' : 'Crear plantilla'}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // undefined = modal closed; null = creating; Template = editing
  const [modal, setModal] = useState<Template | null | undefined>(undefined);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({ title: 'Plantilla creada' });
      setModal(undefined);
    },
    onError: () => toast({ title: 'Error al crear plantilla', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: templatesApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({ title: 'Plantilla actualizada' });
      setModal(undefined);
    },
    onError: () => toast({ title: 'Error al actualizar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({ title: 'Plantilla eliminada' });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: 'Error al eliminar', variant: 'destructive' }),
  });

  function handleSave(data: CreateTemplateInput) {
    if (modal?.id) {
      updateMutation.mutate({ ...data, id: modal.id });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleCopy(template: Template) {
    navigator.clipboard.writeText(template.content);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Contenido copiado al portapapeles' });
  }

  function handleToggle(template: Template) {
    updateMutation.mutate({ id: template.id, isActive: !template.isActive });
  }

  const filtered = filterCategory === 'all'
    ? templates
    : templates.filter((t) => t.category === filterCategory);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plantillas de WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Crea y gestiona mensajes predefinidos para respuestas rápidas y campañas.
          </p>
        </div>
        <Button onClick={() => setModal(null)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
            filterCategory === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/30',
          )}
        >
          Todas ({templates.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = templates.filter((t) => t.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                filterCategory === cat.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/30',
              )}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <p className="text-muted-foreground">No se pudieron cargar las plantillas.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutTemplate className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-1">
              {templates.length === 0 ? 'Sin plantillas' : 'Sin resultados'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {templates.length === 0
                ? 'Crea tu primera plantilla para enviar mensajes estructurados a tus clientes.'
                : 'No hay plantillas en esta categoría.'}
            </p>
            {templates.length === 0 && (
              <Button onClick={() => setModal(null)} className="gap-2">
                <Plus className="w-4 h-4" />
                Crear primera plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template, i) => {
            const catInfo = getCategoryInfo(template.category);
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className={cn(
                  'flex flex-col gap-0 hover:shadow-md transition-shadow h-full',
                  !template.isActive && 'opacity-60',
                )}>
                  <CardContent className="p-5 flex flex-col gap-4 h-full">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{template.name}</h3>
                        <span className={cn(
                          'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border',
                          catInfo.className,
                        )}>
                          {catInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopy(template)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Copiar contenido"
                        >
                          {copiedId === template.id
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setModal(template)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(template.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 flex-1 whitespace-pre-wrap">
                      {template.content}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={() => handleToggle(template)}
                          disabled={updateMutation.isPending}
                        />
                        <span className={cn(
                          'text-xs font-medium',
                          template.isActive ? 'text-emerald-600' : 'text-muted-foreground',
                        )}>
                          {template.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(template)}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Usar plantilla
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modal !== undefined && (
          <TemplateModal
            template={modal}
            onClose={() => setModal(undefined)}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
