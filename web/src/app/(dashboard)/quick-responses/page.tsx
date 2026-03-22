'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Plus, Trash2, Pencil, Save, Loader2, Tag, Search, Copy, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  quickResponsesApi,
  type QuickResponse,
  type CreateQuickResponseInput,
} from '@/lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  Bienvenida:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  Precios:     'bg-blue-100 text-blue-700 border-blue-200',
  'Envíos':    'bg-purple-100 text-purple-700 border-purple-200',
  Horarios:    'bg-amber-100 text-amber-700 border-amber-200',
  'Catálogo':  'bg-red-100 text-red-700 border-red-200',
  Seguimiento: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

function getCategoryColor(cat: string | null) {
  if (!cat) return 'bg-slate-100 text-slate-600 border-slate-200';
  return CATEGORY_COLORS[cat] ?? 'bg-indigo-100 text-indigo-700 border-indigo-200';
}

const emptyForm = (): { title: string; content: string; category: string; sortOrder: number } => ({
  title: '',
  content: '',
  category: '',
  sortOrder: 0,
});

export default function QuickResponsesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['quick-responses'],
    queryFn: quickResponsesApi.getAll,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return quickResponsesApi.update({ ...form, id: editingId });
      }
      return quickResponsesApi.create(form as CreateQuickResponseInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-responses'] });
      setEditorOpen(false);
      toast({ title: editingId ? 'Respuesta actualizada' : 'Respuesta creada' });
    },
    onError: () => toast({ title: 'Error al guardar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: quickResponsesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-responses'] });
      toast({ title: 'Respuesta eliminada' });
      setDeleteId(null);
    },
    onError: () => toast({ title: 'Error al eliminar', variant: 'destructive' }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(true);
  }

  function openEdit(r: QuickResponse) {
    setEditingId(r.id);
    setForm({ title: r.title, content: r.content, category: r.category ?? '', sortOrder: r.sortOrder });
    setEditorOpen(true);
  }

  function handleCopy(r: QuickResponse) {
    navigator.clipboard.writeText(r.content);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Contenido copiado al portapapeles' });
  }

  const categories = Array.from(new Set(responses.map((r) => r.category).filter(Boolean)));

  const filtered = search
    ? responses.filter((r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.content.toLowerCase().includes(search.toLowerCase()) ||
        r.category?.toLowerCase().includes(search.toLowerCase()),
      )
    : responses;

  const grouped = filtered.reduce<Record<string, QuickResponse[]>>((acc, r) => {
    const key = r.category || 'Sin categoría';
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Respuestas Rápidas</h1>
            <p className="text-muted-foreground mt-1">
              Crea mensajes predefinidos para responder al instante desde el chat.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Nueva respuesta
          </Button>
        </div>
      </motion.div>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm flex gap-3">
        <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <span>
          Las respuestas rápidas aparecen en el chat de cualquier conversación. Úsalas para enviar mensajes
          frecuentes con un solo clic — como horarios, precios, saludos de bienvenida o políticas de envío.
        </span>
      </div>

      {/* Search */}
      {responses.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, contenido o categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : responses.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="flex flex-col items-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Sin respuestas rápidas</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Crea tu primera respuesta rápida para ahorrar tiempo respondiendo clientes.
              </p>
              <Button onClick={openCreate} className="mt-6 gap-2" variant="outline">
                <Plus className="w-4 h-4" /> Crear primera respuesta
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">
          No se encontraron resultados para &quot;{search}&quot;.
        </p>
      ) : (
        <AnimatePresence>
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">
                    {category}
                  </h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((r) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <Card className="hover:shadow-sm transition-all group h-full">
                        <CardContent className="p-4 flex flex-col gap-3 h-full">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-bold text-sm truncate">{r.title}</span>
                                {r.category && (
                                  <span className={cn(
                                    'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border',
                                    getCategoryColor(r.category),
                                  )}>
                                    {r.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                                {r.content}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(r)}
                              className="h-7 text-xs gap-1 flex-1"
                            >
                              {copiedId === r.id
                                ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Copiado</>
                                : <><Copy className="w-3 h-3" /> Copiar</>}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(r)}
                              className="h-7 text-xs gap-1 flex-1"
                            >
                              <Pencil className="w-3 h-3" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(r.id)}
                              className="h-7 text-xs gap-1 flex-1 text-destructive hover:text-destructive hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" /> Eliminar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Editor Dialog */}
      <Dialog
        open={editorOpen}
        onOpenChange={(o) => { if (!o && !saveMutation.isPending) setEditorOpen(false); }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {editingId ? 'Editar Respuesta' : 'Nueva Respuesta Rápida'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="ej. Horarios, Precios, Bienvenida, Seguimiento de pedido..."
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría (opcional)</Label>
              <Input
                placeholder="ej. Bienvenida, Precios, Envíos, Horarios..."
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, category: c ?? '' }))}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full border transition-colors',
                        form.category === c
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje *</Label>
              <Textarea
                placeholder="Escribe el mensaje que se enviará al cliente..."
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={5}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">{form.content.length} caracteres</p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditorOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={!form.title.trim() || !form.content.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4" /> Guardar</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar respuesta rápida?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
