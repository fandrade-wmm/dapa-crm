import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, LoadingScreen, ErrorState, Button, Input, Badge } from "@/components/ui-elements";
import { LayoutTemplate, Plus, Pencil, Trash2, X, Save, Copy, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Template {
  id: number;
  name: string;
  category: string;
  language: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { value: "utility",        label: "Utilidad",       color: "bg-blue-100 text-blue-700" },
  { value: "marketing",      label: "Marketing",      color: "bg-purple-100 text-purple-700" },
  { value: "authentication", label: "Autenticación",  color: "bg-amber-100 text-amber-700" },
];

const CATEGORY_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, { label: c.label, color: c.color }])
);

function getCategoryInfo(cat: string) {
  return CATEGORY_MAP[cat] || { label: cat, color: "bg-slate-100 text-slate-700" };
}

interface TemplateModalProps {
  template: Template | null;
  onClose: () => void;
  onSave: (data: { name: string; category: string; content: string }) => void;
  isSaving: boolean;
}

function TemplateModal({ template, onClose, onSave, isSaving }: TemplateModalProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "utility");
  const [content, setContent] = useState(template?.content ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl z-10"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutTemplate className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{template ? "Editar plantilla" : "Nueva plantilla"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-bold text-foreground block mb-1.5">Nombre de la plantilla</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bienvenida, Seguimiento pedido..."
            />
          </div>

          <div>
            <label className="text-sm font-bold text-foreground block mb-2">Categoría</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all",
                    category === cat.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-foreground block mb-1.5">Contenido del mensaje</label>
            <p className="text-xs text-muted-foreground mb-2">
              Usa {"{{1}}"}, {"{{2}}"}, etc. para variables personalizadas (nombre, número de pedido, etc.)
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Ej: Hola {{1}}, gracias por contactar a DAPA Home. Estamos revisando tu consulta sobre {{2}} y te responderemos pronto. 🏠`}
              rows={6}
              className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{content.length} caracteres</p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <strong>Nota Meta:</strong> Para usar plantillas en conversaciones nuevas (fuera de las 24h), deben ser aprobadas por Meta. Esta interfaz te ayuda a preparar y organizar tus mensajes.
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-border bg-slate-50 rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave({ name, category, content })}
            disabled={!name.trim() || !content.trim() || isSaving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Guardando..." : template ? "Guardar cambios" : "Crear plantilla"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Templates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Template | null | undefined>(undefined);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: templates = [], isLoading, error } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch(`${API}/templates`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; content: string }) => {
      const res = await fetch(`${API}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Plantilla creada" });
      setModal(undefined);
    },
    onError: () => toast({ title: "Error al crear plantilla", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Template> }) => {
      const res = await fetch(`${API}/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Plantilla actualizada" });
      setModal(undefined);
    },
    onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Plantilla eliminada" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  function handleSave(data: { name: string; category: string; content: string }) {
    if (modal?.id) {
      updateMutation.mutate({ id: modal.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleCopy(template: Template) {
    navigator.clipboard.writeText(template.content);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Contenido copiado al portapapeles" });
  }

  function handleToggle(template: Template) {
    updateMutation.mutate({ id: template.id, data: { isActive: !template.isActive } });
  }

  const filtered = filterCategory === "all"
    ? templates
    : templates.filter(t => t.category === filterCategory);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorState message="No se pudieron cargar las plantillas." />;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <PageHeader
          title="Plantillas de WhatsApp"
          description="Crea y gestiona mensajes predefinidos para respuestas rápidas y campañas."
        />
        <Button onClick={() => setModal(null)} className="flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setFilterCategory("all")}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
            filterCategory === "all"
              ? "bg-primary text-white border-primary"
              : "bg-white text-muted-foreground border-border hover:border-primary/30"
          )}
        >
          Todas ({templates.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = templates.filter(t => t.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                filterCategory === cat.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutTemplate className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            {templates.length === 0 ? "Sin plantillas" : "Sin resultados"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {templates.length === 0
              ? "Crea tu primera plantilla para enviar mensajes estructurados a tus clientes."
              : "No hay plantillas en esta categoría."}
          </p>
          {templates.length === 0 && (
            <Button onClick={() => setModal(null)} className="mx-auto flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Crear primera plantilla
            </Button>
          )}
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
                  "p-5 flex flex-col gap-4 hover:shadow-md transition-shadow",
                  !template.isActive && "opacity-60"
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{template.name}</h3>
                      <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1", catInfo.color)}>
                        {catInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopy(template)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copiar contenido"
                      >
                        {copiedId === template.id ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setModal(template)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(template.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 flex-1 whitespace-pre-wrap">
                    {template.content}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      onClick={() => handleToggle(template)}
                      className={cn(
                        "text-xs font-medium px-3 py-1 rounded-full transition-colors",
                        template.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {template.isActive ? "✓ Activa" : "Inactiva"}
                    </button>
                    <button
                      onClick={() => handleCopy(template)}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Usar plantilla
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modal !== undefined && (
          <TemplateModal
            template={modal}
            onClose={() => setModal(undefined)}
            onSave={handleSave}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
