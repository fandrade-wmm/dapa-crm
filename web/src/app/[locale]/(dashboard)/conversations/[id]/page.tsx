'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Send,
  Loader2,
  Bot,
  BotOff,
  StickyNote,
  Tag,
  CheckCheck,
  Phone,
  Smile,
  ImageIcon,
  Video,
  FileText,
  Mic,
  X,
  BookOpen,
  Zap,
  UserRound,
  Mail,
  MapPin,
  CreditCard,
  Pencil,
  ExternalLink,
  Check,
  Users,
} from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  conversationsApi,
  agentsApi,
  mediaApi,
  catalogsApi,
  quickResponsesApi,
  clientsApi,
  type ConversationMessage,
  type Catalog,
  type QuickResponse,
  type Contact,
  type UpdateContactInput,
  type AgentInfo,
} from '@/lib/api';
import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const AVAILABLE_LABELS = ['Interesado', 'Cotización enviada', 'Compró', 'Seguimiento', 'Sin stock', 'VIP'];
const LABEL_COLORS: Record<string, string> = {
  Interesado: 'bg-blue-100 text-blue-700 border-blue-200',
  'Cotización enviada': 'bg-amber-100 text-amber-700 border-amber-200',
  Compró: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Seguimiento: 'bg-purple-100 text-purple-700 border-purple-200',
  'Sin stock': 'bg-rose-100 text-rose-700 border-rose-200',
  VIP: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};
function lc(label: string) {
  return LABEL_COLORS[label] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Strips legacy placeholder text like "[Imagen]", "[gif]", "[Audio]" etc.
function isLegacyPlaceholder(content: string) {
  return /^\[.{1,40}\]$/.test(content.trim());
}

function MediaPlaceholder({
  type,
  filename,
  isUser,
}: {
  type: ConversationMessage['messageType'];
  filename?: string;
  isUser: boolean;
}) {
  const cfg: Record<string, { icon: React.ReactNode; label: string }> = {
    image:    { icon: <ImageIcon className="w-5 h-5" />, label: 'Imagen' },
    video:    { icon: <Video className="w-5 h-5" />,     label: 'Video' },
    audio:    { icon: <Mic className="w-4 h-4" />,       label: 'Nota de voz' },
    document: { icon: <FileText className="w-4 h-4" />,  label: filename ?? 'Documento' },
    sticker:  { icon: <span className="text-lg">🎭</span>, label: 'Sticker' },
    note:     { icon: null,                              label: '' },
    text:     { icon: null,                              label: '' },
  };
  const { icon, label } = cfg[type] ?? cfg.text;
  if (!icon) return null;
  return (
    <div className={cn(
      'flex items-center gap-2 text-xs px-1 py-0.5 mb-1 opacity-70',
      isUser ? 'text-muted-foreground' : 'text-primary-foreground/80'
    )}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const time = (() => {
    try { return format(toDate(msg.createdAt), 'HH:mm'); } catch { return ''; }
  })();

  if (msg.isInternalNote) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[80%] bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-800">
          <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-yellow-600">
            <StickyNote className="w-3 h-3" /> Internal note
          </div>
          <p className="whitespace-pre-wrap">{msg.content}</p>
          <p className="text-[10px] text-yellow-500 text-right mt-1">{time}</p>
        </div>
      </div>
    );
  }

  const isUser = msg.role === 'user';
  // Don't show legacy bracket placeholders as text
  const displayContent =
    msg.content && !isLegacyPlaceholder(msg.content) ? msg.content : null;

  return (
    <div className={cn('flex mb-2', isUser ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2.5 text-sm shadow-sm',
          isUser
            ? 'bg-white border border-slate-200 text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}
      >
        {/* ── Image ── */}
        {msg.messageType === 'image' && (
          msg.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.mediaUrl}
              alt="imagen"
              className="rounded-lg max-w-full mb-1 max-h-80 object-contain"
            />
          ) : (
            <MediaPlaceholder type="image" isUser={isUser} />
          )
        )}

        {/* ── Video ── */}
        {msg.messageType === 'video' && (
          msg.mediaUrl ? (
            <video
              src={msg.mediaUrl}
              controls
              className="rounded-lg max-w-full mb-1 max-h-72"
            />
          ) : (
            <MediaPlaceholder type="video" isUser={isUser} />
          )
        )}

        {/* ── Audio / Voice ── */}
        {msg.messageType === 'audio' && (
          msg.mediaUrl ? (
            <audio controls src={msg.mediaUrl} className="w-full max-w-xs mb-1" />
          ) : (
            <MediaPlaceholder type="audio" isUser={isUser} />
          )
        )}

        {/* ── Document ── */}
        {msg.messageType === 'document' && (
          msg.mediaUrl ? (
            <a
              href={msg.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'flex items-center gap-2 text-xs underline underline-offset-2 mb-1',
                isUser ? 'text-primary' : 'text-primary-foreground/90'
              )}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {msg.filename ?? 'Documento'}
            </a>
          ) : (
            <MediaPlaceholder type="document" filename={msg.filename} isUser={isUser} />
          )
        )}

        {/* ── Sticker ── */}
        {msg.messageType === 'sticker' && (
          msg.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.mediaUrl}
              alt="sticker"
              className="max-w-[120px] mb-1"
            />
          ) : (
            <MediaPlaceholder type="sticker" isUser={isUser} />
          )
        )}

        {/* ── Text caption / body ── */}
        {displayContent && (
          <p className="whitespace-pre-wrap">{displayContent}</p>
        )}

        <p className={cn(
          'text-[10px] text-right mt-1',
          isUser ? 'text-muted-foreground' : 'text-primary-foreground/70'
        )}>
          {time}
        </p>
      </div>
    </div>
  );
}

// ---------- Catalog Picker Modal ----------
function CatalogPicker({
  catalogs,
  isLoading,
  onSend,
  onClose,
}: {
  catalogs: Catalog[];
  isLoading: boolean;
  onSend: (catalog: Catalog) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = catalogs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Enviar catálogo
          </h2>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-3 border-b shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar catálogo..."
            className="w-full text-sm px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {search ? 'Sin resultados.' : 'No hay catálogos. Agrégalos en la sección Catálogos.'}
            </div>
          ) : (
            filtered.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSend(cat)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Quick Replies Picker ----------
function QuickRepliesPicker({
  responses,
  isLoading,
  onSelect,
  onClose,
}: {
  responses: QuickResponse[];
  isLoading: boolean;
  onSelect: (content: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = responses.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filtered.reduce<Record<string, QuickResponse[]>>((acc, r) => {
    const cat = r.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 z-50 shadow-xl rounded-xl overflow-hidden border border-border bg-background">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar y enviar respuesta rápida..."
          className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {search
              ? 'Sin resultados para esa búsqueda.'
              : 'No hay respuestas rápidas. Agrégalas en la sección Resp. Rápidas.'}
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20 border-b border-border/50">
                {category}
              </div>
              {items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.content)}
                  className="w-full text-left px-3 py-2.5 hover:bg-primary/5 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <Zap className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.content}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- Contact Info Panel ----------
function ContactPanel({
  contact,
  phone,
  onClose,
  onUpdated,
}: {
  contact: Contact | null;
  phone: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    cedulaRuc: contact?.cedulaRuc ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? phone,
    address: contact?.address ?? '',
    city: contact?.city ?? '',
    company: contact?.company ?? '',
    tags: (contact?.tags ?? []).join(', '),
  });

  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: UpdateContactInput = {
        id: contact!.id,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || null,
        cedulaRuc: form.cedulaRuc.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        company: form.company.trim() || null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      return clientsApi.update(payload);
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['clients'] });
      onUpdated();
      toast({ title: 'Cliente actualizado' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const displayName = contact?.fullName || contact?.firstName
    || (contact as unknown as Record<string, string> | null)?.name
    || contact?.phone || phone;

  const initials = (
    (contact?.firstName || (contact as unknown as Record<string, string> | null)?.name || '?').charAt(0)
    + (contact?.lastName?.charAt(0) ?? '')
  ).toUpperCase();

  const fields = [
    { label: 'Nombres', key: 'firstName' as const, placeholder: 'Juan' },
    { label: 'Apellidos', key: 'lastName' as const, placeholder: 'Pérez' },
    { label: 'Teléfono', key: 'phone' as const, placeholder: '+593...' },
    { label: 'Cédula / RUC', key: 'cedulaRuc' as const, placeholder: '1712345678' },
    { label: 'Email', key: 'email' as const, placeholder: 'correo@ejemplo.com' },
    { label: 'Empresa', key: 'company' as const, placeholder: 'Mi Empresa S.A.' },
    { label: 'Ciudad', key: 'city' as const, placeholder: 'Quito' },
    { label: 'Dirección', key: 'address' as const, placeholder: 'Calle principal 123' },
    { label: 'Etiquetas', key: 'tags' as const, placeholder: 'VIP, Mayorista' },
  ] as const;

  return (
    <div className="w-72 border-l bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <UserRound className="w-4 h-4 text-primary" /> Ficha del cliente
        </span>
        <div className="flex items-center gap-1">
          {contact && (
            <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
              <a href="/clients" target="_blank" rel="noreferrer" title="Ver en base de clientes">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!contact ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <UserRound className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p>No hay un cliente vinculado a este número.</p>
            <p className="text-xs mt-1 text-muted-foreground/70">Se crea automáticamente en el próximo mensaje.</p>
          </div>
        ) : editing ? (
          /* ── Edit mode ── */
          <div className="p-4 space-y-3">
            {fields.map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5 block">{label}</label>
                <input
                  className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                  value={form[key]}
                  onChange={(e) => set(key)(e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div className="p-4 space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{displayName}</p>
                {contact.company && <p className="text-xs text-muted-foreground truncate">{contact.company}</p>}
                {(contact.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags.map((t) => (
                      <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* All fields — always visible */}
            <div className="space-y-3">
              {[
                { label: 'Teléfono', value: contact.phone },
                { label: 'Cédula / RUC', value: contact.cedulaRuc },
                { label: 'Email', value: contact.email },
                { label: 'Empresa', value: contact.company },
                { label: 'Ciudad', value: contact.city },
                { label: 'Dirección', value: contact.address },
                { label: 'Etiquetas', value: (contact.tags ?? []).join(', ') || null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className={`text-sm mt-0.5 ${value ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                    {value || 'Sin datos'}
                  </p>
                </div>
              ))}
            </div>

            {/* Edit button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 mt-2"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar datos del cliente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Text + mode state
  const [messageText, setMessageText] = useState('');
  const [isNote, setIsNote] = useState(false);

  // Contact panel
  const [showContactPanel, setShowContactPanel] = useState(false);

  // Assignment panel
  const [showAssignPicker, setShowAssignPicker] = useState(false);

  // Media UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ---------- Queries ----------
  const { data: conversation, isLoading, error } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.getById(id),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const { data: catalogs = [], isLoading: catalogsLoading } = useQuery({
    queryKey: ['catalogs'],
    queryFn: () => catalogsApi.getAll(),
    enabled: showCatalogPicker,
  });

  const { data: quickResponses = [], isLoading: quickResponsesLoading } = useQuery({
    queryKey: ['quickResponses'],
    queryFn: () => quickResponsesApi.getAll(),
    enabled: showQuickReplies,
    staleTime: 60_000,
  });

  const { data: contactData, refetch: refetchContact } = useQuery({
    queryKey: ['contact-by-phone', conversation?.customerPhone],
    queryFn: () => clientsApi.getByPhone(conversation!.customerPhone),
    enabled: !!conversation?.customerPhone && showContactPanel,
    staleTime: 30_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['activeAgents'],
    queryFn: () => agentsApi.getAll(),
    enabled: showAssignPicker,
    staleTime: 60_000,
  });

  // Auto-scroll to bottom when messages load or a new message arrives
  const initialScrollDone = useRef(false);
  // Reset when conversation changes
  useEffect(() => { initialScrollDone.current = false; }, [id]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !conversation?.messages?.length) return;

    if (!initialScrollDone.current) {
      // First load: wait for paint then jump instantly to bottom
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
      initialScrollDone.current = true;
    } else {
      // New message: smooth scroll only if already near the bottom
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (nearBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [conversation?.messages, id]);

  const markedReadRef = useRef(false);
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0 && !markedReadRef.current) {
      markedReadRef.current = true;
      conversationsApi.markRead(id).catch(() => null);
    }
  }, [id, conversation]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  // ---------- Mutations ----------
  const sendMutation = useMutation({
    mutationFn: ({ content, note }: { content: string; note: boolean }) =>
      note
        ? conversationsApi.addNote(id, content)
        : conversationsApi.sendMessage(id, content),
    onSuccess: () => { setMessageText(''); invalidate(); },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const sendMediaMutation = useMutation({
    mutationFn: (input: Parameters<typeof mediaApi.send>[1]) => mediaApi.send(id, input),
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast({ title: 'Error al enviar', description: err.message, variant: 'destructive' });
    },
  });

  const toggleAIMutation = useMutation({
    mutationFn: (enabled: boolean) => conversationsApi.toggleAI(id, enabled),
    onSuccess: () => { invalidate(); toast({ title: 'Éxito', description: 'Configuración de IA actualizada.' }); },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const labelsMutation = useMutation({
    mutationFn: (labels: string[]) => conversationsApi.updateLabels(id, labels),
    onSuccess: () => { invalidate(); setShowLabelPicker(false); },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ agent }: { agent: AgentInfo | null }) =>
      conversationsApi.assign(id, agent?.id ?? null, agent?.displayName ?? null),
    onSuccess: (_, { agent }) => {
      invalidate();
      setShowAssignPicker(false);
      toast({
        title: agent ? `Asignado a ${agent.displayName ?? agent.email}` : 'Asignación removida',
      });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ---------- Handlers ----------
  const handleSend = () => {
    const text = messageText.trim();
    if (!text) return;
    sendMutation.mutate({ content: text, note: isNote });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleLabel = (label: string) => {
    if (!conversation) return;
    const current = conversation.labels ?? [];
    const next = current.includes(label)
      ? current.filter((l) => l !== label)
      : [...current, label];
    labelsMutation.mutate(next);
  };

  const handleEmojiClick = (data: EmojiClickData) => {
    setMessageText((prev) => prev + data.emoji);
    setShowEmojiPicker(false);
  };

  const handleSelectQuickReply = (content: string) => {
    setShowQuickReplies(false);
    sendMutation.mutate({ content, note: false });
  };

  const closeAllPanels = () => {
    setShowEmojiPicker(false);
    setShowQuickReplies(false);
    setShowLabelPicker(false);
    setShowAssignPicker(false);
  };

  const uploadAndSend = async (
    file: File,
    mediaType: 'image' | 'video' | 'audio',
    filename?: string
  ) => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const supabase = createClient();
      const path = `media/${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      setUploadProgress(100);
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      const url = urlData.publicUrl;
      await sendMediaMutation.mutateAsync({ mediaUrl: url, mediaType, filename });
    } catch (err) {
      toast({ title: 'Error al subir', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAndSend(file, 'image');
    e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAndSend(file, 'video');
    e.target.value = '';
  };

  const handleSendCatalog = async (catalog: Catalog) => {
    setShowCatalogPicker(false);
    await sendMediaMutation.mutateAsync({
      mediaUrl: catalog.fileUrl,
      mediaType: 'document',
      filename: catalog.fileName,
      caption: catalog.name,
    });
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        uploadAndSend(file, 'audio', file.name);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast({ title: 'Micrófono no disponible', description: 'Permite el acceso al micrófono.', variant: 'destructive' });
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingSeconds(0);
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  // ---------- Render ----------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-destructive">Failed to load conversation.</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const displayName = conversation.customerName ?? conversation.customerPhone;
  const initial = conversation.customerName?.charAt(0).toUpperCase();
  const isBusy = isUploading || sendMediaMutation.isPending;

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Catalog picker modal */}
      {showCatalogPicker && (
        <CatalogPicker
          catalogs={catalogs}
          isLoading={catalogsLoading}
          onSend={handleSendCatalog}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Avatar */}
        <div
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0',
            conversation.channel === 'instagram'
              ? 'bg-gradient-to-br from-purple-200 to-pink-100 text-purple-700'
              : 'bg-primary/10 text-primary'
          )}
        >
          {initial ?? <Phone className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{displayName}</span>
            {conversation.customerName && (
              <span className="text-xs text-muted-foreground">{conversation.customerPhone}</span>
            )}
            <span
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full text-white',
                conversation.channel === 'instagram'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-emerald-500'
              )}
            >
              {conversation.channel === 'instagram' ? 'IG' : 'WA'}
            </span>
            <Badge
              variant={conversation.status === 'active' ? 'default' : 'secondary'}
              className="text-[10px] py-0 px-1.5"
            >
              {conversation.status === 'active' ? 'Active' : 'Resolved'}
            </Badge>
          </div>
          {conversation.labels.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-0.5">
              {conversation.labels.map((lbl) => (
                <span key={lbl} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', lc(lbl))}>
                  {lbl}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowContactPanel((v) => !v)}
            className={cn('gap-1.5 text-xs', showContactPanel ? 'text-primary' : 'text-muted-foreground')}
            title="Ficha del cliente"
          >
            <UserRound className="w-4 h-4" />
            <span className="hidden sm:inline">Cliente</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleAIMutation.mutate(!conversation.aiEnabled)}
            disabled={toggleAIMutation.isPending}
            className={cn('gap-1.5 text-xs', conversation.aiEnabled ? 'text-primary' : 'text-muted-foreground')}
            title={conversation.aiEnabled ? 'Deshabilitar IA' : 'Habilitar IA'}
          >
            {conversation.aiEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
            <span className="hidden sm:inline">AI {conversation.aiEnabled ? 'On' : 'Off'}</span>
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLabelPicker((v) => !v)}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Labels</span>
            </Button>
            {showLabelPicker && (
              <Card className="absolute right-0 top-full mt-1 z-50 p-2 w-52 shadow-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Select labels</p>
                <div className="flex flex-col gap-1">
                  {AVAILABLE_LABELS.map((lbl) => {
                    const active = conversation.labels.includes(lbl);
                    return (
                      <button
                        key={lbl}
                        onClick={() => toggleLabel(lbl)}
                        className={cn(
                          'flex items-center justify-between text-xs px-2 py-1.5 rounded-lg border transition-colors text-left',
                          active ? lc(lbl) : 'border-transparent hover:bg-slate-50 text-foreground'
                        )}
                      >
                        {lbl}
                        {active && <CheckCheck className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Assign button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssignPicker((v) => !v)}
              className={cn(
                'gap-1.5 text-xs',
                conversation.assignedTo ? 'text-indigo-600' : 'text-muted-foreground'
              )}
              title="Asignar agente"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">
                {conversation.assignedToName ? conversation.assignedToName.split(' ')[0] : 'Asignar'}
              </span>
            </Button>
            {showAssignPicker && (
              <Card className="absolute right-0 top-full mt-1 z-50 p-2 w-52 shadow-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Asignar a</p>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => assignMutation.mutate({ agent: null })}
                    className={cn(
                      'flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border transition-colors text-left',
                      !conversation.assignedTo ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-transparent hover:bg-slate-50 text-muted-foreground'
                    )}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold">–</span>
                    Sin asignar
                    {!conversation.assignedTo && <CheckCheck className="w-3 h-3 ml-auto shrink-0" />}
                  </button>
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => assignMutation.mutate({ agent })}
                      className={cn(
                        'flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border transition-colors text-left',
                        conversation.assignedTo === agent.id
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-transparent hover:bg-slate-50 text-foreground'
                      )}
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {(agent.displayName ?? agent.email).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate">{agent.displayName ?? agent.email}</span>
                      {conversation.assignedTo === agent.id && <CheckCheck className="w-3 h-3 ml-auto shrink-0" />}
                    </button>
                  ))}
                  {agents.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1.5">
                      No hay agentes disponibles.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-slate-50/50">
        {conversation.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Phone className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin mensajes aún</p>
            <p className="text-xs text-muted-foreground mt-1">Envía el primer mensaje abajo</p>
          </div>
        )}
        {conversation.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="border-t bg-background px-4 py-3 shrink-0">
        {/* Reply / Note toggle */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsNote(false)}
            className={cn(
              'text-xs font-medium px-3 py-1 rounded-full border transition-colors',
              !isNote
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            Responder
          </button>
          <button
            onClick={() => setIsNote(true)}
            className={cn(
              'text-xs font-medium px-3 py-1 rounded-full border transition-colors flex items-center gap-1',
              isNote
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'text-muted-foreground border-border hover:border-yellow-300'
            )}
          >
            <StickyNote className="w-3 h-3" /> Nota
          </button>
        </div>

        {/* Upload progress bar */}
        {uploadProgress !== null && (
          <div className="mb-2 space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">Subiendo… {uploadProgress}%</p>
          </div>
        )}

        {/* Recording UI */}
        {isRecording ? (
          <div className="flex items-center gap-3 py-2">
            <span className="flex items-center gap-1.5 text-rose-600 font-medium text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              Grabando {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelRecording}
              className="text-muted-foreground gap-1.5"
            >
              <X className="w-4 h-4" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleStopRecording}
              className="gap-1.5 bg-rose-500 hover:bg-rose-600 text-white"
            >
              <Send className="w-4 h-4" /> Enviar
            </Button>
          </div>
        ) : (
          <>
            {/* Media toolbar + textarea row */}
            <div className="relative">
              {/* Quick replies panel */}
              {showQuickReplies && (
                <QuickRepliesPicker
                  responses={quickResponses}
                  isLoading={quickResponsesLoading}
                  onSelect={handleSelectQuickReply}
                  onClose={() => setShowQuickReplies(false)}
                />
              )}

              {/* Emoji picker popup */}
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 left-0 z-50 shadow-xl rounded-xl overflow-hidden">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    lazyLoadEmojis
                    height={350}
                    width={320}
                  />
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* Media action buttons */}
                <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                  {/* Quick Replies */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(false);
                      setShowQuickReplies((v) => !v);
                    }}
                    title="Respuestas rápidas"
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                      showQuickReplies
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                    )}
                  >
                    <Zap className="w-4 h-4" />
                  </button>

                  {/* Emoji */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickReplies(false);
                      setShowEmojiPicker((v) => !v);
                    }}
                    title="Emoji"
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                      showEmojiPicker
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                    )}
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  {/* Image */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isBusy}
                    title="Enviar imagen"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  {/* Video */}
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isBusy}
                    title="Enviar video"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  {/* Catalog */}
                  <button
                    type="button"
                    onClick={() => { closeAllPanels(); setShowCatalogPicker(true); }}
                    disabled={isBusy}
                    title="Enviar catálogo"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  {/* Voice */}
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={isBusy}
                    title="Nota de voz"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>

                {/* Hidden file inputs */}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />

                {/* Textarea */}
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isNote ? 'Escribe una nota interna...' : 'Escribe un mensaje... (Enter para enviar)'}
                  className={cn(
                    'min-h-[44px] max-h-32 resize-none text-sm',
                    isNote && 'bg-yellow-50 border-yellow-200 placeholder:text-yellow-600'
                  )}
                  rows={1}
                  onClick={() => closeAllPanels()}
                />

                {/* Send button */}
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  size="icon"
                  className="shrink-0 h-10 w-10"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Uploading indicator */}
            {isBusy && uploadProgress === null && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Enviando archivo...
              </div>
            )}
          </>
        )}
      </div>
      </div>{/* end main chat column */}

      {/* Contact panel */}
      {showContactPanel && (
        <ContactPanel
          contact={contactData ?? null}
          phone={conversation.customerPhone}
          onClose={() => setShowContactPanel(false)}
          onUpdated={() => refetchContact()}
        />
      )}
    </div>
  );
}
