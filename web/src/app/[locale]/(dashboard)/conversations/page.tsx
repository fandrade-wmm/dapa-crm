'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, MessageSquare, Phone, ChevronRight, Tag, Bot } from 'lucide-react';
import { conversationsApi, type Conversation, type ConversationChannel, type ConversationStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

function ConversationRow({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  const initial = conv.customerName?.charAt(0).toUpperCase();
  const displayName = conv.customerName ?? conv.customerPhone;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 sm:p-5 hover:bg-slate-50 transition-colors cursor-pointer group',
        conv.unreadCount > 0 && 'bg-blue-50/40'
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
            <p className="text-xs font-medium">{format(new Date(conv.updatedAt), 'd MMM')}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(conv.updatedAt), 'HH:mm')}</p>
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
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<ConversationChannel>('all');
  const [status, setStatus] = useState<ConversationStatus>('all');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['conversations', search, channel, status],
    queryFn: () => conversationsApi.getAll({ search: search || undefined, channel, status }),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const filtered = activeLabel
    ? conversations.filter((c) => c.labels.includes(activeLabel))
    : conversations;

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
      </div>

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

