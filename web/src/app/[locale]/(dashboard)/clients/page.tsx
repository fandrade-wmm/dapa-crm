'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, type Contact, type CreateContactInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
  GitMerge,
  Download,
  Upload,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

// ---------- CSV helpers ----------
const CSV_HEADERS = ['firstName', 'lastName', 'phone', 'email', 'cedulaRuc', 'company', 'city', 'address', 'tags'];
const CSV_LABELS  = ['Nombres', 'Apellidos', 'Teléfono', 'Email', 'Cédula/RUC', 'Empresa', 'Ciudad', 'Dirección', 'Etiquetas'];

function contactsToCsv(contacts: Contact[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = CSV_LABELS.join(',');
  const rows = contacts.map((c) => [
    c.firstName ?? '',
    c.lastName ?? '',
    c.phone ?? '',
    c.email ?? '',
    c.cedulaRuc ?? '',
    c.company ?? '',
    c.city ?? '',
    c.address ?? '',
    (c.tags ?? []).join('; '),
  ].map(escape).join(','));
  return [header, ...rows].join('\r\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): CreateContactInput[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  // Detect header row and map column indices
  const rawHeader = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const labelMap: Record<string, string> = {
    'nombres': 'firstName', 'nombre': 'firstName', 'firstname': 'firstName', 'first name': 'firstName',
    'apellidos': 'lastName', 'apellido': 'lastName', 'lastname': 'lastName', 'last name': 'lastName',
    'teléfono': 'phone', 'telefono': 'phone', 'phone': 'phone', 'celular': 'phone', 'móvil': 'phone',
    'email': 'email', 'correo': 'email', 'correo electrónico': 'email',
    'cédula/ruc': 'cedulaRuc', 'cedula/ruc': 'cedulaRuc', 'cédula': 'cedulaRuc', 'cedula': 'cedulaRuc', 'ruc': 'cedulaRuc',
    'empresa': 'company', 'company': 'company',
    'ciudad': 'city', 'city': 'city',
    'dirección': 'address', 'direccion': 'address', 'address': 'address',
    'etiquetas': 'tags', 'tags': 'tags', 'labels': 'tags',
  };
  const colMap = rawHeader.map((h) => labelMap[h] ?? null);

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
      else cur += ch;
    }
    result.push(cur);
    return result;
  };

  return lines.slice(1).map((line) => {
    const cells = parseRow(line);
    const row: Record<string, string> = {};
    colMap.forEach((key, i) => { if (key) row[key] = (cells[i] ?? '').trim(); });
    if (!row['firstName']) return null;
    return {
      firstName: row['firstName'],
      lastName: row['lastName'] || null,
      phone: row['phone'] || null,
      email: row['email'] || null,
      cedulaRuc: row['cedulaRuc'] || null,
      company: row['company'] || null,
      city: row['city'] || null,
      address: row['address'] || null,
      tags: row['tags'] ? row['tags'].split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
    } as CreateContactInput;
  }).filter(Boolean) as CreateContactInput[];
}

// ---------- ImportDialog ----------
function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CreateContactInput[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = (f: File) => {
    setFile(f);
    setErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setErrors(['No se encontraron contactos válidos. Asegúrate que el CSV tenga una columna "Nombres".']);
      }
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleImport = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) return;
      setImporting(true);
      setProgress(0);
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < rows.length; i++) {
        try {
          await clientsApi.create(rows[i]);
          ok++;
        } catch {
          fail++;
        }
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }
      setImporting(false);
      toast({
        title: 'Importación completada',
        description: `${ok} importado${ok !== 1 ? 's' : ''}${fail > 0 ? ` · ${fail} error${fail !== 1 ? 'es' : ''}` : ''}`,
      });
      onDone();
      onClose();
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-background rounded-xl border shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-base">Importar clientes desde CSV</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Template download */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              El CSV debe tener columnas: <strong>Nombres, Apellidos, Teléfono, Email, Cédula/RUC, Empresa, Ciudad, Dirección, Etiquetas</strong>.{' '}
              <button
                className="underline font-medium"
                onClick={() => downloadCsv(CSV_LABELS.join(','), 'plantilla_clientes.csv')}
              >
                Descargar plantilla
              </button>
            </div>
          </div>

          {/* File picker */}
          <div>
            <input id="csv-import-input" type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <label htmlFor="csv-import-input"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
              {file ? (
                <p className="text-sm font-medium text-primary">{file.name}</p>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Haz clic para seleccionar un archivo CSV</p>
                </>
              )}
            </label>
          </div>

          {/* Errors */}
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-destructive">{e}</p>
          ))}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Vista previa ({preview.length} de {preview.length === 5 ? '5+' : preview.length} filas)
              </p>
              <div className="border rounded-lg divide-y text-xs overflow-hidden">
                {preview.map((c, i) => (
                  <div key={i} className="flex gap-2 px-3 py-2">
                    <span className="font-medium truncate flex-1">{c.firstName} {c.lastName}</span>
                    <span className="text-muted-foreground shrink-0">{c.phone}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={importing}>Cancelar</Button>
          <Button
            className="flex-1 gap-2"
            disabled={!file || preview.length === 0 || importing || errors.length > 0}
            onClick={handleImport}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Contact Form ----------
interface ContactFormData {
  firstName: string;
  lastName: string;
  cedulaRuc: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  company: string;
  tags: string;
}

const EMPTY_FORM: ContactFormData = {
  firstName: '', lastName: '', cedulaRuc: '', email: '',
  phone: '', address: '', city: '', company: '', tags: '',
};

function toApiInput(f: ContactFormData): CreateContactInput {
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim() || null,
    cedulaRuc: f.cedulaRuc.trim() || null,
    email: f.email.trim() || null,
    phone: f.phone.trim() || null,
    address: f.address.trim() || null,
    city: f.city.trim() || null,
    company: f.company.trim() || null,
    tags: f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
  };
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );
}

// ---------- Contact Drawer ----------
function ContactDrawer({
  contact,
  onClose,
}: {
  contact: Contact | 'new';
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isNew = contact === 'new';

  const [form, setForm] = useState<ContactFormData>(
    isNew
      ? EMPTY_FORM
      : {
          firstName: (contact as Contact).firstName,
          lastName: (contact as Contact).lastName ?? '',
          cedulaRuc: (contact as Contact).cedulaRuc ?? '',
          email: (contact as Contact).email ?? '',
          phone: (contact as Contact).phone ?? '',
          address: (contact as Contact).address ?? '',
          city: (contact as Contact).city ?? '',
          company: (contact as Contact).company ?? '',
          tags: ((contact as Contact).tags ?? []).join(', '),
        }
  );

  const set = (key: keyof ContactFormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const createMutation = useMutation({
    mutationFn: () => clientsApi.create(toApiInput(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente creado' });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: () => clientsApi.update({ id: (contact as Contact).id, ...toApiInput(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente actualizado' });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-background border-l shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-base">
            {isNew ? 'Nuevo cliente' : 'Editar cliente'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombres *" value={form.firstName} onChange={set('firstName')} placeholder="Juan" />
            <FormField label="Apellidos" value={form.lastName} onChange={set('lastName')} placeholder="Pérez" />
          </div>
          <FormField label="Teléfono" value={form.phone} onChange={set('phone')} placeholder="+593 99 000 0000" type="tel" />
          <FormField label="Cédula / RUC" value={form.cedulaRuc} onChange={set('cedulaRuc')} placeholder="1712345678" />
          <FormField label="Correo electrónico" value={form.email} onChange={set('email')} placeholder="juan@email.com" type="email" />
          <FormField label="Empresa" value={form.company} onChange={set('company')} placeholder="Mi Empresa S.A." />
          <FormField label="Dirección" value={form.address} onChange={set('address')} placeholder="Calle principal 123" />
          <FormField label="Ciudad" value={form.city} onChange={set('city')} placeholder="Quito" />
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">
              Etiquetas <span className="font-normal normal-case">(separadas por coma)</span>
            </label>
            <Input
              value={form.tags}
              onChange={(e) => set('tags')(e.target.value)}
              placeholder="VIP, Mayorista, Quito"
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!form.firstName.trim() || busy}
            onClick={() => isNew ? createMutation.mutate() : updateMutation.mutate()}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isNew ? 'Crear cliente' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Contact Row ----------
function ContactRow({ contact, onEdit }: { contact: Contact; onEdit: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.delete(contact.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente eliminado' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/80 transition-colors group">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
        {(contact.firstName || (contact as unknown as Record<string, string>).name || '?').charAt(0).toUpperCase()}
        {contact.lastName?.charAt(0).toUpperCase() ?? ''}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{contact.fullName || contact.firstName || (contact as unknown as Record<string, string>).name || contact.phone || '—'}</span>
          {contact.source === 'whatsapp' && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">WA</span>
          )}
          {(contact.tags ?? []).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{tag}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {contact.phone && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />{contact.phone}
            </span>
          )}
          {contact.email && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" />{contact.email}
            </span>
          )}
          {contact.city && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{contact.city}
            </span>
          )}
          {contact.cedulaRuc && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CreditCard className="w-3 h-3" />{contact.cedulaRuc}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onEdit} title="Editar">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          title="Eliminar"
        >
          {deleteMutation.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<Contact | 'new' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.getAll(search || undefined),
    staleTime: 30_000,
  });

  const dedupMutation = useMutation({
    mutationFn: () => clientsApi.deduplicate(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: 'Duplicados eliminados',
        description: `Se unificaron ${result.merged} grupo${result.merged !== 1 ? 's' : ''} · ${result.deleted} contacto${result.deleted !== 1 ? 's' : ''} eliminado${result.deleted !== 1 ? 's' : ''}.`,
      });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-5">
      {drawer && <ContactDrawer contact={drawer} onClose={() => setDrawer(null)} />}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ['clients'] })}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Base de datos de clientes · vinculados automáticamente desde WhatsApp
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            onClick={() => dedupMutation.mutate()}
            disabled={dedupMutation.isPending}
            className="gap-2"
            title="Unificar clientes con el mismo número"
          >
            {dedupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            Unificar
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => downloadCsv(contactsToCsv(contacts), `clientes_${new Date().toISOString().slice(0, 10)}.csv`)}
            disabled={contacts.length === 0}
          >
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Importar
          </Button>
          <Button onClick={() => setDrawer('new')} className="gap-2">
            <Plus className="w-4 h-4" /> Nuevo cliente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono, cédula..."
          className="pl-9"
        />
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-base mb-1">
              {search ? 'Sin resultados' : 'Sin clientes todavía'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? 'Intenta con otro término de búsqueda.'
                : 'Los clientes se crean automáticamente cuando envían un mensaje por WhatsApp, o puedes crearlos manualmente.'}
            </p>
            {!search && (
              <Button onClick={() => setDrawer('new')} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" /> Crear cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} onEdit={() => setDrawer(c)} />
            ))}
          </div>
        )}
      </Card>

      {contacts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {contacts.length} cliente{contacts.length !== 1 ? 's' : ''}
          {search ? ` · búsqueda: "${search}"` : ''}
        </p>
      )}
    </div>
  );
}
