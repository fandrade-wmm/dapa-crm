import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, LoadingScreen, ErrorState, Badge, Input } from "@/components/ui-elements";
import { Search, Phone, ChevronRight, MessageSquare, Tag, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface ConvItem {
  id: number;
  customerPhone: string;
  customerName: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  messageCount: number;
  status: string;
  aiEnabled: boolean;
  labels: string[];
  assignedAgentId: number | null;
  assignedAgent: { id: number; name: string } | null;
  unreadCount: number;
  channel: string;
}

const LABEL_COLORS: Record<string, string> = {
  "Interesado":         "bg-blue-100 text-blue-700",
  "Cotización enviada": "bg-amber-100 text-amber-700",
  "Compró":             "bg-emerald-100 text-emerald-700",
  "Seguimiento":        "bg-purple-100 text-purple-700",
  "Sin stock":          "bg-rose-100 text-rose-700",
  "VIP":                "bg-yellow-100 text-yellow-700",
};

function labelColor(label: string) {
  return LABEL_COLORS[label] || "bg-slate-100 text-slate-600";
}

const ALL_LABELS = Object.keys(LABEL_COLORS);

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "instagram") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shrink-0">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        IG
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shrink-0">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      WA
    </span>
  );
}

export default function Conversations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<"all" | "whatsapp" | "instagram">("all");

  const { data: conversations = [], isLoading, error } = useQuery<ConvItem[]>({
    queryKey: ["conversations", searchTerm, activeLabel, activeChannel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (activeLabel) params.set("label", activeLabel);
      if (activeChannel !== "all") params.set("channel", activeChannel);
      const res = await fetch(`${API}/conversations?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorState message="No se pudieron cargar las conversaciones." />;

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const waCount = conversations.filter(c => (c.channel || "whatsapp") === "whatsapp").length;
  const igCount = conversations.filter(c => c.channel === "instagram").length;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Conversaciones"
          description="Gestiona todos los chats de WhatsApp e Instagram."
        />
        {unreadTotal > 0 && (
          <div className="shrink-0 mt-1 flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            {unreadTotal} sin leer
          </div>
        )}
      </div>

      {/* Channel filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "all",       label: `Todos (${conversations.length})` },
          { key: "whatsapp",  label: `WhatsApp (${waCount})` },
          { key: "instagram", label: `Instagram (${igCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveChannel(key as any)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold border transition-all flex items-center gap-2",
              activeChannel === key
                ? "bg-primary text-white border-primary"
                : "bg-white text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            {key === "whatsapp" && <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-emerald-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
            {key === "instagram" && <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-pink-500"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>}
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 max-w-md relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o mensaje..."
          className="pl-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Label filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setActiveLabel(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5",
            !activeLabel
              ? "bg-primary text-white border-primary"
              : "bg-white text-muted-foreground border-border hover:border-primary/40"
          )}
        >
          <Tag className="w-3 h-3" />
          Todas
        </button>
        {ALL_LABELS.map((label) => (
          <button
            key={label}
            onClick={() => setActiveLabel(activeLabel === label ? null : label)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              activeLabel === label
                ? "bg-primary text-white border-primary"
                : `${labelColor(label)} border-transparent hover:opacity-80`
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden bg-white/50 backdrop-blur-sm">
        {conversations.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Sin resultados</h3>
            <p className="text-muted-foreground">
              {searchTerm || activeLabel || activeChannel !== "all"
                ? "No hay conversaciones que coincidan con tus filtros."
                : "Aún no hay conversaciones registradas."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conv, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                key={conv.id}
              >
                <Link href={`/conversations/${conv.id}`}>
                  <div className={cn(
                    "p-4 sm:p-5 hover:bg-slate-50/80 transition-all duration-200 cursor-pointer group",
                    conv.unreadCount > 0 && "bg-blue-50/40"
                  )}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-4">
                        {/* Avatar with channel indicator */}
                        <div className="relative shrink-0">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner",
                            conv.channel === "instagram"
                              ? "bg-gradient-to-br from-purple-200 to-pink-100 text-purple-700"
                              : "bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
                          )}>
                            {conv.customerName ? conv.customerName.charAt(0).toUpperCase() : <Phone className="w-5 h-5" />}
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <h4 className={cn("font-bold text-foreground", conv.unreadCount > 0 && "text-blue-900")}>
                              {conv.customerName || conv.customerPhone}
                            </h4>
                            <ChannelBadge channel={conv.channel || "whatsapp"} />
                            <Badge variant={conv.status === 'active' ? 'success' : 'neutral'} className="text-[10px] py-0.5 px-2">
                              {conv.status === 'active' ? 'Activo' : 'Resuelto'}
                            </Badge>
                          </div>

                          {conv.labels && conv.labels.length > 0 && (
                            <div className="flex gap-1 flex-wrap mb-1">
                              {conv.labels.map((lbl) => (
                                <span key={lbl} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", labelColor(lbl))}>
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="text-muted-foreground text-sm line-clamp-1 max-w-2xl">
                            {conv.lastMessage || "Conversación iniciada."}
                          </p>

                          {conv.assignedAgent && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              {conv.assignedAgent.name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-40 pl-16 sm:pl-0 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {format(new Date(conv.lastMessageAt), "d MMM", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(conv.lastMessageAt), "HH:mm")}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors text-slate-400">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
