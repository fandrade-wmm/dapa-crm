'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Phone,
  Bell,
  BarChart3,
  ArrowRight,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react';
import { statsApi, type DashboardStats } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ---------- Animation variants ----------

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

// ---------- Stat card ----------

interface StatCardProps {
  label: string;
  sublabel: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}

function StatCard({ label, sublabel, value, icon, highlight }: StatCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            {icon}
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
          <h2
            className={cn(
              'text-4xl font-bold',
              highlight && value > 0 ? 'text-rose-600' : 'text-foreground'
            )}
          >
            {value}
          </h2>
          <p className="text-xs text-muted-foreground mt-2">
            {highlight && value === 0 ? 'al día ✓' : sublabel}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- Dashboard page ----------

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.getStats,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (botEnabled: boolean) => statsApi.toggleBot(botEnabled),
    onMutate: async (botEnabled) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard-stats'] });
      const prev = queryClient.getQueryData<DashboardStats>(['dashboard-stats']);
      if (prev) {
        queryClient.setQueryData<DashboardStats>(['dashboard-stats'], { ...prev, botEnabled });
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: data.botEnabled ? 'IA activada' : 'IA desactivada',
        description: data.botEnabled
          ? 'El bot responderá automáticamente a los clientes.'
          : 'Las respuestas automáticas están pausadas.',
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['dashboard-stats'], context.prev);
      }
      toast({ title: 'Error al cambiar estado del bot', variant: 'destructive' });
    },
  });

  const botEnabled = stats?.botEnabled ?? false;
  const botKnown = !isLoading && stats !== undefined;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel de Control</h1>
          <p className="text-muted-foreground mt-1">
            Resumen del rendimiento de tu asistente de IA.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="shrink-0"
        >
          <button
            onClick={() => toggleMutation.mutate(!botEnabled)}
            disabled={toggleMutation.isPending || !botKnown}
            className={cn(
              'relative flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm',
              'transition-all duration-300 shadow-lg border-2 min-w-[200px] justify-center',
              botKnown && botEnabled
                ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white shadow-emerald-200'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-slate-100',
              (toggleMutation.isPending || !botKnown) && 'opacity-70 cursor-not-allowed'
            )}
          >
            {isLoading || toggleMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : botEnabled ? (
              <Power className="w-5 h-5" />
            ) : (
              <PowerOff className="w-5 h-5 text-slate-400" />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span
                className={cn(
                  'text-xs font-medium',
                  botKnown && botEnabled ? 'text-emerald-100' : 'text-slate-400'
                )}
              >
                Respuestas IA
              </span>
              <span className="text-base font-bold">
                {isLoading ? 'Cargando...' : toggleMutation.isPending ? 'Cambiando...' : botEnabled ? 'Encendida' : 'Apagada'}
              </span>
            </span>
            {botKnown && botEnabled && !toggleMutation.isPending && (
              <span className="absolute top-2 right-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
              </span>
            )}
          </button>
        </motion.div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          No se pudieron cargar las estadísticas. Mostrando valores por defecto.
        </div>
      )}

      {/* Stats cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8"
      >
        <StatCard
          label="Hoy"
          sublabel="conversaciones nuevas"
          value={isLoading ? 0 : (stats?.todayConversations ?? 0)}
          icon={<MessageCircle className="w-14 h-14" />}
        />
        <StatCard
          label="Total histórico"
          sublabel="clientes atendidos"
          value={isLoading ? 0 : (stats?.totalConversations ?? 0)}
          icon={<Phone className="w-14 h-14" />}
        />
        <StatCard
          label="Sin leer"
          sublabel="mensajes pendientes"
          value={isLoading ? 0 : (stats?.totalUnread ?? 0)}
          icon={<Bell className="w-14 h-14" />}
          highlight
        />
        <StatCard
          label="Mensajes totales"
          sublabel="enviados y recibidos"
          value={isLoading ? 0 : (stats?.totalMessages ?? 0)}
          icon={<BarChart3 className="w-14 h-14" />}
        />
      </motion.div>

      {/* Recent conversations */}
      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">Conversaciones Recientes</h3>
          <Link
            href="/conversations"
            className="text-sm font-medium text-primary hover:text-primary/80 flex items-center transition-colors"
          >
            Ver todas <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 text-center flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">Cargando conversaciones...</p>
              </div>
            ) : (
              <div className="p-10 text-center flex flex-col items-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground font-medium">
                  Aún no hay conversaciones registradas.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Los mensajes de WhatsApp aparecerán aquí.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
