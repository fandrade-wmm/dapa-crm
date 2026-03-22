import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  MessageSquare, Image, Video, BookOpen, GripVertical, X, Save, Loader2,
  AlertCircle, Tag, RadioTower, PlayCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface AutomationStep {
  id?: number;
  stepType: "text" | "image" | "video" | "catalogue";
  stepOrder: number;
  textContent?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  catalogueId?: number;
}

interface AutomationWorkflow {
  id: number;
  name: string;
  description: string | null;
  triggerType: "keyword" | "any" | "first_message";
  triggerKeywords: string | null;
  active: boolean;
  stopAi: boolean;
  steps: AutomationStep[];
  createdAt: string;
}

interface Catalogue {
  id: number;
  name: string;
  originalFilename: string;
}

const STEP_TYPE_CONFIG = {
  text: { label: "Texto", icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
  image: { label: "Imagen", icon: Image, color: "text-purple-600 bg-purple-50" },
  video: { label: "Video", icon: Video, color: "text-orange-600 bg-orange-50" },
  catalogue: { label: "Catálogo PDF", icon: BookOpen, color: "text-red-600 bg-red-50" },
};

const TRIGGER_LABELS = {
  keyword: { label: "Palabra clave", icon: Tag, desc: "Se activa cuando el mensaje contiene ciertas palabras" },
  any: { label: "Cualquier mensaje", icon: RadioTower, desc: "Se activa con cualquier mensaje entrante" },
  first_message: { label: "Primer mensaje", icon: PlayCircle, desc: "Se activa solo en el primer mensaje del cliente" },
};

function StepCard({
  step,
  index,
  catalogues,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  step: AutomationStep;
  index: number;
  catalogues: Catalogue[];
  onChange: (s: AutomationStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const cfg = STEP_TYPE_CONFIG[step.stepType];
  const Icon = cfg.icon;

  return (
    <div className="border border-border rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", cfg.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <Select value={step.stepType} onValueChange={(v) => onChange({ ...step, stepType: v as AutomationStep["stepType"], textContent: "", mediaUrl: "", mediaCaption: "", catalogueId: undefined })}>
            <SelectTrigger className="h-8 text-sm font-medium w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STEP_TYPE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-2">
                    <v.icon className="w-3.5 h-3.5" />
                    {v.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-full">Paso {index + 1}</span>
        <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors ml-auto">
          <X className="w-4 h-4" />
        </button>
      </div>

      {step.stepType === "text" && (
        <Textarea
          placeholder="Escribe el mensaje de texto que se enviará al cliente..."
          value={step.textContent || ""}
          onChange={(e) => onChange({ ...step, textContent: e.target.value })}
          rows={3}
          className="text-sm"
        />
      )}

      {(step.stepType === "image" || step.stepType === "video") && (
        <div className="space-y-2">
          <Input
            placeholder={`URL de la ${step.stepType === "image" ? "imagen" : "video"} (https://...)`}
            value={step.mediaUrl || ""}
            onChange={(e) => onChange({ ...step, mediaUrl: e.target.value })}
            className="text-sm"
          />
          <Input
            placeholder="Subtítulo opcional..."
            value={step.mediaCaption || ""}
            onChange={(e) => onChange({ ...step, mediaCaption: e.target.value })}
            className="text-sm"
          />
        </div>
      )}

      {step.stepType === "catalogue" && (
        <div className="space-y-2">
          {catalogues.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No tienes catálogos subidos. Ve a "Catálogos" para subir uno.
            </div>
          ) : (
            <Select
              value={step.catalogueId ? String(step.catalogueId) : ""}
              onValueChange={(v) => onChange({ ...step, catalogueId: parseInt(v) })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecciona un catálogo..." />
              </SelectTrigger>
              <SelectContent>
                {catalogues.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-red-500" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder="Mensaje que acompañará el PDF (opcional)..."
            value={step.mediaCaption || ""}
            onChange={(e) => onChange({ ...step, mediaCaption: e.target.value })}
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  workflow,
  catalogues,
  onEdit,
  onDelete,
  onToggle,
}: {
  workflow: AutomationWorkflow;
  catalogues: Catalogue[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const triggerCfg = TRIGGER_LABELS[workflow.triggerType];
  const TriggerIcon = triggerCfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200",
        workflow.active ? "border-border" : "border-dashed border-slate-300 opacity-70"
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
              workflow.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground truncate">{workflow.name}</h3>
              {workflow.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{workflow.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  <TriggerIcon className="w-3 h-3" />
                  {triggerCfg.label}
                </span>
                {workflow.triggerType === "keyword" && workflow.triggerKeywords && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[160px]">
                    "{workflow.triggerKeywords}"
                  </span>
                )}
              </div>
            </div>
          </div>

          <button onClick={onToggle} className="shrink-0 mt-0.5">
            {workflow.active ? (
              <ToggleRight className="w-7 h-7 text-primary" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-slate-300" />
            )}
          </button>
        </div>

        {workflow.steps.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {workflow.steps.map((step, i) => {
              const cfg = STEP_TYPE_CONFIG[step.stepType as keyof typeof STEP_TYPE_CONFIG];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <span key={i} className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full", cfg.color)}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              );
            })}
            {!workflow.stopAi && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full text-emerald-700 bg-emerald-50">
                <Zap className="w-3 h-3" />
                + IA
              </span>
            )}
          </div>
        )}
        {workflow.steps.length === 0 && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Sin pasos definidos — este workflow no hará nada al activarse.
          </p>
        )}
      </div>

      <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-slate-50/50 rounded-b-2xl">
        <span className="text-xs text-muted-foreground">{workflow.steps.length} paso{workflow.steps.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 text-xs gap-1.5">
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

const emptyWorkflow = (): Partial<AutomationWorkflow> & { steps: AutomationStep[] } => ({
  name: "",
  description: "",
  triggerType: "keyword",
  triggerKeywords: "",
  active: true,
  stopAi: true,
  steps: [],
});

export default function Automations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<ReturnType<typeof emptyWorkflow>>(emptyWorkflow());
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const res = await fetch(`${API}/automations`);
      if (!res.ok) throw new Error("Error al cargar automatizaciones");
      return res.json() as Promise<{ workflows: AutomationWorkflow[]; catalogues: Catalogue[] }>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isNew = editingId === null;
      const url = isNew ? `${API}/automations` : `${API}/automations/${editingId}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingWorkflow.name,
          description: editingWorkflow.description || null,
          triggerType: editingWorkflow.triggerType,
          triggerKeywords: editingWorkflow.triggerKeywords || null,
          active: editingWorkflow.active,
          stopAi: editingWorkflow.stopAi,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const { workflow } = await res.json();

      // Save steps: delete all existing and re-insert
      if (!isNew) {
        // We need to reconcile: existing steps with IDs are updated, new ones are created
        const existingSteps = data?.workflows.find(w => w.id === editingId)?.steps || [];

        // Delete steps not in editing
        const editingIds = new Set(editingWorkflow.steps.filter(s => s.id).map(s => s.id));
        for (const es of existingSteps) {
          if (!editingIds.has(es.id)) {
            await fetch(`${API}/automations/${editingId}/steps/${es.id}`, { method: "DELETE" });
          }
        }

        // Update or create each step
        for (let i = 0; i < editingWorkflow.steps.length; i++) {
          const step = { ...editingWorkflow.steps[i], stepOrder: i };
          if (step.id) {
            await fetch(`${API}/automations/${editingId}/steps/${step.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(step),
            });
          } else {
            await fetch(`${API}/automations/${editingId}/steps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(step),
            });
          }
        }
      } else {
        // Create all steps for new workflow
        for (let i = 0; i < editingWorkflow.steps.length; i++) {
          const step = { ...editingWorkflow.steps[i], stepOrder: i };
          await fetch(`${API}/automations/${workflow.id}/steps`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(step),
          });
        }
      }

      return workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setEditorOpen(false);
      toast({ title: editingId ? "Automatización actualizada" : "Automatización creada" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/automations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Automatización eliminada" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await fetch(`${API}/automations/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations"] }),
    onError: () => toast({ title: "Error al cambiar estado", variant: "destructive" }),
  });

  function openCreate() {
    setEditingId(null);
    setEditingWorkflow(emptyWorkflow());
    setEditorOpen(true);
  }

  function openEdit(workflow: AutomationWorkflow) {
    setEditingId(workflow.id);
    setEditingWorkflow({
      name: workflow.name,
      description: workflow.description || "",
      triggerType: workflow.triggerType,
      triggerKeywords: workflow.triggerKeywords || "",
      active: workflow.active,
      stopAi: workflow.stopAi,
      steps: workflow.steps.map(s => ({ ...s })),
    });
    setEditorOpen(true);
  }

  function addStep(type: AutomationStep["stepType"]) {
    setEditingWorkflow(prev => ({
      ...prev,
      steps: [...prev.steps, { stepType: type, stepOrder: prev.steps.length }],
    }));
  }

  function updateStep(index: number, updated: AutomationStep) {
    setEditingWorkflow(prev => {
      const steps = [...prev.steps];
      steps[index] = updated;
      return { ...prev, steps };
    });
  }

  function deleteStep(index: number) {
    setEditingWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  function moveStep(from: number, to: number) {
    setEditingWorkflow(prev => {
      const steps = [...prev.steps];
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      return { ...prev, steps };
    });
  }

  const workflows = data?.workflows ?? [];
  const catalogues = data?.catalogues ?? [];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Automatizaciones</h1>
            <p className="text-muted-foreground mt-1">
              Define respuestas automáticas cuando lleguen mensajes de WhatsApp.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Automatización
          </Button>
        </div>
      </motion.div>

      {/* Info banner */}
      <div className="mt-6 bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground flex gap-3">
        <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <strong>¿Cómo funciona?</strong> Cuando llega un mensaje de WhatsApp, el sistema revisa tus automatizaciones activas en orden. Si el mensaje coincide con el disparador, ejecuta los pasos definidos. Si ninguna coincide, el bot de IA responde (si está encendido).
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : workflows.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Zap className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin automatizaciones aún</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Crea tu primera automatización para responder automáticamente con textos, imágenes, videos o catálogos.
            </p>
            <Button onClick={openCreate} className="mt-6 gap-2" variant="outline">
              <Plus className="w-4 h-4" />
              Crear primera automatización
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  catalogues={catalogues}
                  onEdit={() => openEdit(workflow)}
                  onDelete={() => setDeleteId(workflow.id)}
                  onToggle={() => toggleMutation.mutate({ id: workflow.id, active: !workflow.active })}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Workflow Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o && !saveMutation.isPending) setEditorOpen(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {editingId ? "Editar Automatización" : "Nueva Automatización"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Name & Description */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input
                  placeholder="ej. Bienvenida, Catálogo en PDF, Respuesta de horarios..."
                  value={editingWorkflow.name}
                  onChange={(e) => setEditingWorkflow(p => ({ ...p, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Input
                  placeholder="Para qué sirve esta automatización..."
                  value={editingWorkflow.description || ""}
                  onChange={(e) => setEditingWorkflow(p => ({ ...p, description: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="border border-border rounded-xl p-4 space-y-3 bg-slate-50/50">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" /> Disparador
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TRIGGER_LABELS) as [keyof typeof TRIGGER_LABELS, typeof TRIGGER_LABELS[keyof typeof TRIGGER_LABELS]][]).map(([k, v]) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={k}
                      onClick={() => setEditingWorkflow(p => ({ ...p, triggerType: k }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all text-xs font-medium",
                        editingWorkflow.triggerType === k
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {v.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {TRIGGER_LABELS[editingWorkflow.triggerType as keyof typeof TRIGGER_LABELS]?.desc}
              </p>
              {editingWorkflow.triggerType === "keyword" && (
                <div>
                  <Label className="text-xs">Palabras clave (separadas por coma)</Label>
                  <Input
                    placeholder="ej. catálogo, precios, horario, hola"
                    value={editingWorkflow.triggerKeywords || ""}
                    onChange={(e) => setEditingWorkflow(p => ({ ...p, triggerKeywords: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se activará si el mensaje contiene al menos una de estas palabras (sin distinguir mayúsculas).
                  </p>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-primary" />
                Pasos de respuesta ({editingWorkflow.steps.length})
              </Label>

              {editingWorkflow.steps.length === 0 && (
                <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4 text-center">
                  Sin pasos aún. Agrega al menos uno para que la automatización funcione.
                </div>
              )}

              <div className="space-y-2">
                {editingWorkflow.steps.map((step, i) => (
                  <StepCard
                    key={i}
                    step={step}
                    index={i}
                    catalogues={catalogues}
                    onChange={(s) => updateStep(i, s)}
                    onDelete={() => deleteStep(i)}
                    onMoveUp={() => moveStep(i, i - 1)}
                    onMoveDown={() => moveStep(i, i + 1)}
                    isFirst={i === 0}
                    isLast={i === editingWorkflow.steps.length - 1}
                  />
                ))}
              </div>

              {/* Add step buttons */}
              <div className="border-2 border-dashed border-border rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3 text-center">Agregar paso</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(STEP_TYPE_CONFIG) as [AutomationStep["stepType"], typeof STEP_TYPE_CONFIG[keyof typeof STEP_TYPE_CONFIG]][]).map(([type, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => addStep(type)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-white hover:border-primary/40 hover:shadow-sm transition-all text-xs font-medium text-foreground"
                        )}
                      >
                        <span className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", cfg.color)}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-border">
              <input
                type="checkbox"
                id="stop-ai"
                checked={editingWorkflow.stopAi}
                onChange={(e) => setEditingWorkflow(p => ({ ...p, stopAi: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="stop-ai" className="text-sm font-medium text-foreground cursor-pointer">
                Parar respuesta de IA cuando esta automatización se active
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditorOpen(false)} disabled={saveMutation.isPending}>
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={!editingWorkflow.name?.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán la automatización y todos sus pasos.
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
