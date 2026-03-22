'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, DollarSign, Trash2, Pencil, User, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STAGES = [
  { id: 'nuevos', label: 'Nuevos', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  { id: 'proforma', label: 'Proforma', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  { id: 'venta', label: 'Venta', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'completado', label: 'Completado', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'perdido', label: 'Perdido', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
] as const;

type CrmStage = typeof STAGES[number]['id'];

interface CrmLead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  stage: CrmStage;
  value?: string | null;
  notes?: string | null;
  source?: string | null;
}

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
  const s = stageColors(lead.stage);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'bg-white border border-gray-200 rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow',
        isDragging ? 'opacity-0' : 'hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <User className="w-4 h-4" />
          </div>
          <p className="font-bold text-sm text-gray-900 leading-tight truncate">{lead.name}</p>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
          className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone className="w-3 h-3" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
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
          <p className="text-xs text-gray-500 italic line-clamp-2 mt-1">{lead.notes}</p>
        )}
      </div>
    </div>
  );
}

interface ColumnProps {
  stage: typeof STAGES[number];
  leads: CrmLead[];
  onEdit: (lead: CrmLead) => void;
}

function Column({ stage, leads, onEdit }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border-2 border-dashed min-h-[600px] flex-1 min-w-[280px]',
        stage.bg,
        stage.border
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className={cn('font-bold text-sm uppercase tracking-wide', stage.color)}>
          {stage.label}
        </h3>
        <span className={cn('text-xs font-bold px-2 py-1 rounded-full', stage.bg, stage.color)}>
          {leads.length}
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {leads.map((lead) => (
            <motion.div
              key={lead.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <LeadCard lead={lead} onEdit={onEdit} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface CrmKanbanProps {
  leads: CrmLead[];
  onUpdateLead: (id: string, updates: Partial<CrmLead>) => Promise<void>;
  onCreateLead: (lead: Omit<CrmLead, 'id'>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
}

export function CrmKanban({ leads, onUpdateLead, onCreateLead, onDeleteLead }: CrmKanbanProps) {
  const [activeLead, setActiveLead] = useState<CrmLead | null>(null);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    value: '',
    notes: '',
    source: '',
    stage: 'nuevos' as CrmStage,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const leadId = active.id as string;
    const newStage = over.id as CrmStage;

    onUpdateLead(leadId, { stage: newStage });
  };

  const handleEdit = (lead: CrmLead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      phone: lead.phone || '',
      email: lead.email || '',
      value: lead.value || '',
      notes: lead.notes || '',
      source: lead.source || '',
      stage: lead.stage,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    const data = {
      ...formData,
      phone: formData.phone || null,
      email: formData.email || null,
      value: formData.value || null,
      notes: formData.notes || null,
      source: formData.source || null,
    };

    if (editingLead) {
      await onUpdateLead(editingLead.id, data);
      setEditingLead(null);
    } else {
      await onCreateLead(data);
      setIsCreateDialogOpen(false);
    }

    setFormData({
      name: '',
      phone: '',
      email: '',
      value: '',
      notes: '',
      source: '',
      stage: 'nuevos',
    });
  };

  const handleDelete = async () => {
    if (editingLead) {
      await onDeleteLead(editingLead.id);
      setEditingLead(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM Leads</h1>
          <p className="text-muted-foreground">
            Drag and drop leads across stages to update their status
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              leads={leads.filter((l) => l.stage === stage.id)}
              onEdit={handleEdit}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} onEdit={() => {}} isDragging />}
        </DragOverlay>
      </DndContext>

      <Dialog open={isCreateDialogOpen || !!editingLead} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingLead(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
            <DialogDescription>
              {editingLead ? 'Update the lead information' : 'Add a new lead to your CRM pipeline'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value">Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="1000.00"
                />
              </div>
              <div>
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Website, referral, etc."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            {editingLead && (
              <Button variant="destructive" onClick={handleDelete} className="mr-auto">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingLead(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name.trim()}>
                {editingLead ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
