'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, MessageSquare, Phone, ChevronRight, Tag, Bot, UserCheck } from 'lucide-react';
import { conversationsApi, agentsApi, type Conversation, type ConversationChannel, type ConversationStatus, type AgentInfo } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Firestore Timestamps come as { seconds, nanoseconds } — convert safely
function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

const AVAILABLE_LABELS = ['Interesado', 'Cotización enviada', 'Compró', 'Seguimiento', 'Sin stock', 'VIP'];
const LABEL_COLORS: Record<string, string> = {
  Interesado: 'bg-blue-100 text-blue-700',
  'Cotización enviada': 'bg-amber-100 text-amber-700',
  Compró: 'bg-emerald-100 text-emerald-700',
  Seguimiento: 'bg-purple-100 text-purple-700',
  'Sin stock': 'bg-rose-100 text-rose-700',
  VIP: 'bg-yellow-100 text-yellow-700',
};
function labelColor(label: string) {
  return LABEL_COLORS[label] ?? 'bg-slate-100 text-slate-600';
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'instagram') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shrink-0">
        IG
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shrink-0">
      WA
    </span>
  );
}

function AgentAvatar({ name }: { name: string | null }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold shrink-0"
      title={name ?? 'Asignado'}
    >
      {initials}
    </span>
  );
}

function ConversationRow({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  const initial = conv.customerName?.charAt(0).toUpperCase();
  const displayName = conv.customerName ?? conv.customerPhone;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 sm:p-5 transition-colors cursor-pointer group',
        conv.unreadCount > 0
          ? 'bg-slate-100 hover:bg-slate-200/70'
          : 'hover:bg-slate-50'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base',
                conv.channel === 'instagram'
                  ? 'bg-gradient-to-br from-purple-200 to-pink-100 text-purple-700'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {initial ?? <Phone className="w-4 h-4" />}
            </div>
            {conv.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
              <span className={cn('font-semibold text-sm', conv.unreadCount > 0 && 'text-blue-900')}>
                {displayName}
              </span>
              {conv.customerPhone && (
                <span className="text-[11px] text-muted-foreground font-normal">+{conv.customerPhone.replace(/^\+/, '')}</span>
              )}
              <ChannelIcon channel={conv.channel} />
              <Badge
                variant={conv.status === 'active' ? 'default' : 'secondary'}
                className="text-[10px] py-0 px-1.5"
              >
                {conv.status === 'active' ? 'Active' : 'Resolved'}
              </Badge>
              {conv.aiEnabled && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                  <Bot className="w-2.5 h-2.5" /> AI
                </Badge>
              )}
              {conv.assignedTo && (
                <span className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium">
                  <AgentAvatar name={conv.assignedToName ?? null} />
                  <span className="hidden sm:inline truncate max-w-[80px]">{conv.assignedToName ?? 'Asignado'}</span>
                </span>
              )}
            </div>
            {conv.labels.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-0.5">
                {conv.labels.map((lbl) => (
                  <span key={lbl} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', labelColor(lbl))}>
                    {lbl}
                  </span>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-xs line-clamp-1">
              {conv.lastMessage ?? 'Conversation started.'}
            </p>
          </div>
        </div>

        {/* Timestamp + arrow */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium">{format(toDate(conv.updatedAt), 'd MMM')}</p>
            <p className="text-xs text-muted-foreground">{format(toDate(conv.updatedAt), 'HH:mm')}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors text-slate-400">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channel, setChannel] = useState<ConversationChannel>('all');
  const [status, setStatus] = useState<ConversationStatus>('all');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'me' | 'unassigned' | string>('all');

  // Debounce: only trigger query 400ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['conversations', debouncedSearch, channel, status],
    queryFn: () => conversationsApi.getAll({ search: debouncedSearch || undefined, channel, status }),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['activeAgents'],
    queryFn: () => agentsApi.getAll(),
    staleTime: 60_000,
  });

  const filtered = conversations
    .filter((c) => !activeLabel || c.labels.includes(activeLabel))
    .filter((c) => !onlyUnread || (c.unreadCount ?? 0) > 0)
    .filter((c) => {
      if (assignedFilter === 'all') return true;
      if (assignedFilter === 'me') return c.assignedTo === user?.id;
      if (assignedFilter === 'unassigned') return !c.assignedTo;
      return c.assignedTo === assignedFilter;
    });

  const waCount = conversations.filter((c) => c.channel === 'whatsapp').length;
  const igCount = conversations.filter((c) => c.channel === 'instagram').length;
  const unreadTotal = conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-destructive">Error loading conversations. Please try again.</div>
      </div>
    );
  }

  const channelTabs: { key: ConversationChannel; label: string }[] = [
    { key: 'all', label: `All (${conversations.length})` },
    { key: 'whatsapp', label: `WhatsApp (${waCount})` },
    { key: 'instagram', label: `Instagram (${igCount})` },
  ];

  const statusTabs: { key: ConversationStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">
            View and manage all customer conversations across channels
          </p>
        </div>
        {unreadTotal > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            {unreadTotal} unread
          </div>
        )}
      </div>

      {/* Channel tabs */}
      <div className="flex gap-2 flex-wrap">
        {channelTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setChannel(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              channel === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            {label}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {statusTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              status === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setOnlyUnread((v) => !v)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
            onlyUnread
              ? 'bg-rose-500 text-white border-rose-500'
              : 'bg-background text-muted-foreground border-border hover:border-rose-300'
          )}
        >
          {unreadTotal > 0 && (
            <span className={cn('w-2 h-2 rounded-full', onlyUnread ? 'bg-white' : 'bg-rose-500 animate-pulse')} />
          )}
          No leídos{unreadTotal > 0 ? ` (${unreadTotal})` : ''}
        </button>
      </div>

      {/* Assignment filter */}
      {agents.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <UserCheck className="w-3.5 h-3.5" /> Asignado a:
          </span>
          {([
            { key: 'all', label: 'Todos' },
            { key: 'me', label: 'Yo' },
            { key: 'unassigned', label: 'Sin asignar' },
            ...agents.map((a: AgentInfo) => ({ key: a.id, label: a.displayName ?? a.email })),
          ] as { key: string; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAssignedFilter(key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                assignedFilter === key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-background text-muted-foreground border-border hover:border-indigo-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone or message..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Label filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveLabel(null)}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1',
            !activeLabel
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/40'
          )}
        >
          <Tag className="w-3 h-3" /> All labels
        </button>
        {AVAILABLE_LABELS.map((lbl) => (
          <button
            key={lbl}
            onClick={() => setActiveLabel(activeLabel === lbl ? null : lbl)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold border transition-opacity',
              activeLabel === lbl
                ? 'bg-primary text-primary-foreground border-primary'
                : `${labelColor(lbl)} border-transparent hover:opacity-80`
            )}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">No conversations found</h3>
            <p className="text-sm text-muted-foreground">
              {search || activeLabel || channel !== 'all' || status !== 'all'
                ? 'No conversations match your filters.'
                : 'Conversations will appear here when customers reach out.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                onClick={() => router.push(`/conversations/${conv.id}`)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

