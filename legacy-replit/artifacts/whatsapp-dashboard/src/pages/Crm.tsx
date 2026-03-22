import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  useCrmLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
} from "@/hooks/use-crm";
import type { CrmLead, CrmStage } from "@/hooks/use-crm";
import { PageHeader, Card, LoadingScreen, ErrorState, Button, Input, Badge } from "@/components/ui-elements";
import { Plus, Phone, Mail, DollarSign, Trash2, Pencil, X, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STAGES: { id: CrmStage; label: string; color: string; bg: string; border: string }[] = [
  { id: "nuevos",     label: "Nuevos",     color: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-200" },
  { id: "proforma",   label: "Proforma",   color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  { id: "venta",      label: "Venta",      color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200" },
  { id: "completado", label: "Completado", color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200" },
  { id: "perdido",    label: "Perdido",    color: "text-rose-700",   bg: "bg-rose-50",    border: "border-rose-200" },
];

function stageColors(stageId: CrmStage) {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0];
}

interface LeadCardProps {
  lead: CrmLead;
  onEdit: (lead: CrmLead) => void;
  isDragging?: boolean;
}

function LeadCard({ lead, onEdit, isDragging = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id });
  const style = { transform: CSS.Translate.toString(transform) };
  const s = stageColors(lead.stage as CrmStage);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "bg-white border border-border rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow",
        isDragging ? "opacity-0" : "hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <User className="w-4 h-4" />
          </div>
          <p className="font-bold text-sm text-foreground leading-tight truncate">{lead.name}</p>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.value && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <DollarSign className="w-3 h-3" />
            <span>${parseFloat(lead.value).toFixed(2)}</span>
          </div>
        )}
        {lead.notes && (
          <p className="text-xs text-muted-foreground italic line-clamp-2 mt-1">{lead.notes}</p>
        )}
      </div>

      {lead.source && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", s.bg, s.color)}>
            {lead.source}
          </span>
        </div>
      )}
    </div>
  );
}

interface ColumnProps {
  stage: typeof STAGES[number];
  leads: CrmLead[];
  onEdit: (lead: CrmLead) => void;
  onAddNew: (stage: CrmStage) => void;
  activeId: number | null;
}

function KanbanColumn({ stage, leads, onEdit, onAddNew, activeId }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      <div className={cn("flex items-center justify-between mb-3 px-1")}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full", stage.bg, stage.color, `border ${stage.border}`)}>
            {stage.label}
          </span>
          <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center">
            {leads.length}
          </span>
        </div>
        <button
          onClick={() => onAddNew(stage.id)}
          className="w-6 h-6 rounded-lg bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-3 min-h-[200px] rounded-xl p-2 transition-colors",
          isOver ? `${stage.bg} border-2 border-dashed ${stage.border}` : "bg-slate-50/80 border-2 border-transparent"
        )}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onEdit={onEdit}
            isDragging={activeId === lead.id}
          />
        ))}

        {leads.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground text-center">Arrastra un contacto aquí</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface LeadFormData {
  name: string;
  phone: string;
  email: string;
  stage: CrmStage;
  notes: string;
  value: string;
  source: string;
}

const EMPTY_FORM: LeadFormData = { name: "", phone: "", email: "", stage: "nuevos", notes: "", value: "", source: "" };

interface LeadModalProps {
  lead: CrmLead | null;
  defaultStage: CrmStage;
  onClose: () => void;
  onSave: (data: LeadFormData) => void;
  onDelete?: () => void;
  isSaving: boolean;
}

function LeadModal({ lead, defaultStage, onClose, onSave, onDelete, isSaving }: LeadModalProps) {
  const [form, setForm] = useState<LeadFormData>(
    lead
      ? {
          name: lead.name,
          phone: lead.phone ?? "",
          email: lead.email ?? "",
          stage: lead.stage as CrmStage,
          notes: lead.notes ?? "",
          value: lead.value ?? "",
          source: lead.source ?? "",
        }
      : { ...EMPTY_FORM, stage: defaultStage }
  );

  const set = (k: keyof LeadFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            {lead ? "Editar Contacto" : "Nuevo Contacto"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">Nombre *</label>
            <Input value={form.name} onChange={set("name")} placeholder="Nombre del contacto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-foreground block mb-1">Teléfono</label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+593..." />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground block mb-1">Email</label>
              <Input value={form.email} onChange={set("email")} placeholder="correo@..." type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-foreground block mb-1">Etapa</label>
              <select
                value={form.stage}
                onChange={set("stage")}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-foreground block mb-1">Valor ($)</label>
              <Input value={form.value} onChange={set("value")} placeholder="0.00" type="number" />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">Fuente</label>
            <Input value={form.source} onChange={set("source")} placeholder="WhatsApp, Instagram, Referido..." />
          </div>
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Observaciones, productos de interés..."
              rows={3}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-border bg-slate-50">
          {lead && onDelete ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-700 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => onSave(form)} disabled={!form.name.trim() || isSaving}>
              {isSaving ? "Guardando..." : lead ? "Guardar cambios" : "Crear contacto"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Crm() {
  const { data: leads = [], isLoading, error } = useCrmLeads();
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const deleteMutation = useDeleteLead();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [modalLead, setModalLead] = useState<CrmLead | null | undefined>(undefined);
  const [defaultStage, setDefaultStage] = useState<CrmStage>("nuevos");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorState message="No se pudo cargar el CRM." />;

  const leadsByStage = (stageId: CrmStage) => leads.filter((l) => l.stage === stageId);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as number);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const lead = leads.find((l) => l.id === active.id);
    const newStage = over.id as CrmStage;
    if (!lead || lead.stage === newStage) return;

    updateMutation.mutate(
      { id: lead.id, data: { stage: newStage } },
      {
        onError: () => toast({ title: "Error", description: "No se pudo mover el contacto.", variant: "destructive" }),
      }
    );
  }

  function handleAddNew(stage: CrmStage) {
    setDefaultStage(stage);
    setModalLead(null);
  }

  function handleEdit(lead: CrmLead) {
    setModalLead(lead);
  }

  function handleCloseModal() {
    setModalLead(undefined);
  }

  function handleSave(form: LeadFormData) {
    if (modalLead) {
      updateMutation.mutate(
        { id: modalLead.id, data: form },
        {
          onSuccess: () => {
            toast({ title: "Guardado", description: "Contacto actualizado correctamente." });
            handleCloseModal();
          },
          onError: () => toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { ...form, stage: form.stage },
        {
          onSuccess: () => {
            toast({ title: "Creado", description: "Nuevo contacto añadido al CRM." });
            handleCloseModal();
          },
          onError: () => toast({ title: "Error", description: "No se pudo crear el contacto.", variant: "destructive" }),
        }
      );
    }
  }

  function handleDelete() {
    if (!modalLead) return;
    deleteMutation.mutate(modalLead.id, {
      onSuccess: () => {
        toast({ title: "Eliminado", description: "Contacto eliminado del CRM." });
        handleCloseModal();
      },
      onError: () => toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" }),
    });
  }

  const totalValue = leads
    .filter((l) => l.stage === "venta" || l.stage === "completado")
    .reduce((sum, l) => sum + (l.value ? parseFloat(l.value) : 0), 0);

  return (
    <div className="p-6 md:p-8 flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <PageHeader
            title="CRM"
            description="Gestiona tus contactos y sigue el progreso de cada venta."
          />
        </div>
        <div className="flex items-center gap-4">
          {totalValue > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pipeline activo</p>
              <p className="text-xl font-bold text-primary">${totalValue.toFixed(2)}</p>
            </div>
          )}
          <Button onClick={() => handleAddNew("nuevos")} className="flex items-center gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Nuevo contacto
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage(stage.id)}
              onEdit={handleEdit}
              onAddNew={handleAddNew}
              activeId={activeId}
            />
          ))}

          <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
            {activeLead ? (
              <div className="bg-white border border-primary/30 rounded-xl p-4 shadow-2xl w-[260px] rotate-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-sm text-foreground truncate">{activeLead.name}</p>
                </div>
                {activeLead.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                    <Phone className="w-3 h-3" />
                    <span>{activeLead.phone}</span>
                  </div>
                )}
                {activeLead.value && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary mt-1">
                    <DollarSign className="w-3 h-3" />
                    <span>${parseFloat(activeLead.value).toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <AnimatePresence>
        {modalLead !== undefined && (
          <LeadModal
            lead={modalLead}
            defaultStage={defaultStage}
            onClose={handleCloseModal}
            onSave={handleSave}
            onDelete={modalLead ? handleDelete : undefined}
            isSaving={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
