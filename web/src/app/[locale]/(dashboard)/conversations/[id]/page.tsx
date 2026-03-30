'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { conversationsApi, type ConversationMessage } from '@/lib/api';
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

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const time = (() => {
    try { return format(new Date(msg.createdAt), 'HH:mm'); } catch { return ''; }
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

  return (
    <div className={cn('flex mb-2', isUser ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
          isUser
            ? 'bg-white border border-slate-200 text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <p className={cn('text-[10px] text-right mt-1', isUser ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
          {time}
        </p>
      </div>
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messageText, setMessageText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const { data: conversation, isLoading, error } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.getById(id),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const markedReadRef = useRef(false);

  // Mark as read once when conversation first loads with unread messages
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

  const sendMutation = useMutation({
    mutationFn: ({ content, note }: { content: string; note: boolean }) =>
      note
        ? conversationsApi.addNote(id, content)
        : conversationsApi.sendMessage(id, content),
    onSuccess: () => {
      setMessageText('');
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const toggleAIMutation = useMutation({
    mutationFn: (enabled: boolean) => conversationsApi.toggleAI(id, enabled),
    onSuccess: () => { invalidate(); toast({ title: 'Success', description: 'AI setting updated.' }); },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const labelsMutation = useMutation({
    mutationFn: (labels: string[]) => conversationsApi.updateLabels(id, labels),
    onSuccess: () => { invalidate(); setShowLabelPicker(false); },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
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
          {/* Labels */}
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
          {/* Toggle AI */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleAIMutation.mutate(!conversation.aiEnabled)}
            disabled={toggleAIMutation.isPending}
            className={cn('gap-1.5 text-xs', conversation.aiEnabled ? 'text-primary' : 'text-muted-foreground')}
            title={conversation.aiEnabled ? 'Disable AI' : 'Enable AI'}
          >
            {conversation.aiEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
            <span className="hidden sm:inline">AI {conversation.aiEnabled ? 'On' : 'Off'}</span>
          </Button>

          {/* Labels picker */}
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
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-slate-50/50">
        {conversation.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Phone className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Send the first message below</p>
          </div>
        )}
        {conversation.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="border-t bg-background px-4 py-3 shrink-0">
        {/* Note toggle */}
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
            Reply
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
            <StickyNote className="w-3 h-3" /> Note
          </button>
        </div>

        <div className="flex gap-2 items-end">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isNote ? 'Write an internal note...' : 'Type a message... (Enter to send)'}
            className={cn(
              'min-h-[44px] max-h-32 resize-none text-sm',
              isNote && 'bg-yellow-50 border-yellow-200 placeholder:text-yellow-600'
            )}
            rows={1}
          />
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
    </div>
  );
}
