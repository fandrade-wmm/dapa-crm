import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getGetBotStatusQueryKey } from "@workspace/api-client-react";
import { useBotStatus } from "@/hooks/use-bot";
import { useConversations } from "@/hooks/use-conversations";
import { PageHeader, Card, LoadingScreen, ErrorState, Badge } from "@/components/ui-elements";
import {
  MessageCircle, Zap, Phone,
  ArrowRight, Package, Power, PowerOff, Loader2, Bell, BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Stats {
  messagesPerDay: { date: string; messages: number; inbound: number; outbound: number }[];
  totalUnread: number;
  totalConversations: number;
  todayConversations: number;
  totalMessages: number;
  labelData: { name: string; value: number }[];
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#f97316"];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading, error: statusError } = useBotStatus();
  const { data: conversations, isLoading: convLoading } = useConversations();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch(`${API}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (botEnabled: boolean) => {
      const res = await fetch(`${API}/bot/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botEnabled }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      return res.json() as Promise<{ botEnabled: boolean }>;
    },
    onMutate: (botEnabled: boolean) => {
      queryClient.setQueryData(getGetBotStatusQueryKey(), (old: typeof status) =>
        old ? { ...old, botEnabled } : old
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
      toast({
        title: data.botEnabled ? "IA activada" : "IA desactivada",
        description: data.botEnabled
          ? "El bot responderá automáticamente a los clientes."
          : "Las respuestas automáticas están pausadas.",
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      toast({ title: "Error al cambiar estado del bot", variant: "destructive" });
    },
  });

  if (statusLoading || convLoading) return <LoadingScreen />;
  if (statusError) return <ErrorState message="No se pudo conectar con el servidor." />;

  const botEnabled = status?.botEnabled ?? true;
  const recentConversations = conversations?.slice(0, 5) || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <PageHeader
          title="Panel de Control"
          description="Resumen del rendimiento de tu asistente de IA para DAPA Home."
        />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="shrink-0">
          <button
            onClick={() => toggleMutation.mutate(!botEnabled)}
            disabled={toggleMutation.isPending}
            className={cn(
              "relative flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 shadow-lg border-2 min-w-[200px] justify-center",
              botEnabled
                ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white shadow-emerald-200"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-slate-100",
              toggleMutation.isPending && "opacity-70 cursor-not-allowed"
            )}
          >
            {toggleMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : botEnabled ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5 text-slate-400" />}
            <span className="flex flex-col items-start leading-tight">
              <span className={cn("text-xs font-medium", botEnabled ? "text-emerald-100" : "text-slate-400")}>Respuestas IA</span>
              <span className="text-base font-bold">{toggleMutation.isPending ? "Cambiando..." : botEnabled ? "Encendida" : "Apagada"}</span>
            </span>
            {botEnabled && !toggleMutation.isPending && (
              <span className="absolute top-2 right-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
              </span>
            )}
          </button>
        </motion.div>
      </div>

      {/* Stats cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <motion.div variants={itemVariants}>
          <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <MessageCircle className="w-14 h-14" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Hoy</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{stats?.todayConversations ?? status?.todayConversations ?? 0}</h2>
            <p className="text-xs text-muted-foreground mt-2">conversaciones nuevas</p>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Phone className="w-14 h-14" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total histórico</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{stats?.totalConversations ?? status?.totalConversations ?? 0}</h2>
            <p className="text-xs text-muted-foreground mt-2">clientes atendidos</p>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Bell className="w-14 h-14" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Sin leer</p>
            <h2 className={cn("text-4xl font-display font-bold", (stats?.totalUnread ?? 0) > 0 ? "text-rose-600" : "text-foreground")}>
              {stats?.totalUnread ?? 0}
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              {(stats?.totalUnread ?? 0) > 0 ? "mensajes pendientes" : "al día ✓"}
            </p>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart3 className="w-14 h-14" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Mensajes totales</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{stats?.totalMessages ?? 0}</h2>
            <p className="text-xs text-muted-foreground mt-2">enviados y recibidos</p>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts row */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Messages per day */}
          <motion.div variants={itemVariants} initial="hidden" animate="show" className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-5">Mensajes — últimos 7 días</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.messagesPerDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                    formatter={(val, name) => [val, name === "inbound" ? "Recibidos" : "Enviados"]}
                  />
                  <Bar dataKey="inbound" name="inbound" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                  <Bar dataKey="outbound" name="outbound" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Recibidos</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Enviados</span>
              </div>
            </Card>
          </motion.div>

          {/* Labels pie */}
          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <Card className="p-6 flex flex-col h-full">
              <h3 className="text-lg font-bold text-foreground mb-4">Por etiqueta</h3>
              {stats.labelData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <Package className="w-10 h-10 text-slate-400 mb-2" />
                  <p className="text-sm text-muted-foreground">Sin etiquetas asignadas aún</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.labelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stats.labelData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Legend iconSize={10} iconType="circle" formatter={(v) => <span style={{ fontSize: 11, color: "#64748b" }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </motion.div>
        </div>
      )}


      {/* Recent conversations */}
      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">Conversaciones Recientes</h3>
          <Link href="/conversations">
            <span className="text-sm font-medium text-primary hover:text-primary/80 flex items-center cursor-pointer transition-colors">
              Ver todas <ArrowRight className="w-4 h-4 ml-1" />
            </span>
          </Link>
        </div>
        <Card className="overflow-hidden">
          {recentConversations.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">Aún no hay conversaciones registradas.</p>
              <p className="text-sm text-muted-foreground mt-1">Los mensajes de WhatsApp aparecerán aquí.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentConversations.map((conv) => (
                <Link key={conv.id} href={`/conversations/${conv.id}`}>
                  <div className="p-4 sm:p-5 hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                          {conv.customerName ? conv.customerName.charAt(0).toUpperCase() : <Phone className="w-4 h-4" />}
                        </div>
                        {(conv as any).unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-0.5 rounded-full flex items-center justify-center">
                            {(conv as any).unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-foreground truncate">{conv.customerName || conv.customerPhone}</h4>
                        <p className="text-sm text-muted-foreground truncate max-w-[250px] sm:max-w-md">
                          {(conv as any).lastMessage || "Sin mensajes"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-4">
                      <span className="text-xs font-medium text-muted-foreground mb-1.5">
                        {format(new Date(conv.lastMessageAt), "d MMM, HH:mm", { locale: es })}
                      </span>
                      <Badge variant={conv.status === 'active' ? 'success' : 'neutral'}>
                        {conv.status === 'active' ? 'Activo' : 'Resuelto'}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
