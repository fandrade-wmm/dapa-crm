import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBotStatus, useBotTest } from "@/hooks/use-bot";
import {
  useBotTraining,
  useSaveBotConfig,
  useCreateQaPair,
  useUpdateQaPair,
  useDeleteQaPair,
} from "@/hooks/use-bot-training";
import type { BotQaPair } from "@/hooks/use-bot-training";
import { PageHeader, Card, LoadingScreen, ErrorState, Button, Input, Badge } from "@/components/ui-elements";
import { Link2, Copy, Send, Bot, CheckCircle2, Webhook, BrainCircuit, Plus, Trash2, Pencil, X, ToggleLeft, ToggleRight, BookOpen, Sparkles, Save, Clock, Power, LogIn, LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

/* ─── Types ─────────────────────────────────────────── */
interface ProductImage { name: string; imageUrl: string; price: number; }
interface ChatEntry { role: "user" | "bot"; content: string; images?: ProductImage[]; }

/* ─── Instagram Card ─────────────────────────────────── */
interface IgStatus { status: "connected" | "disconnected" | "error"; username?: string; error?: string; lastPollAt?: string; }

function InstagramCard() {
  const { toast } = useToast();
  const [igStatus, setIgStatus] = useState<IgStatus | null>(null);
  const [igLoading, setIgLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const r = await fetch(`${API}/instagram/status`, { credentials: "include" });
      if (r.ok) setIgStatus(await r.json());
    } catch { /* silent */ }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setIgLoading(true);
    setLoginError(null);
    try {
      const r = await fetch(`${API}/instagram/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        toast({ title: "Instagram conectado", description: `Sesión iniciada como @${username.trim()}` });
        setPassword("");
        setLoginError(null);
        await fetchStatus();
      } else {
        setLoginError(data.error || "Error al iniciar sesión. Verifica tus credenciales.");
      }
    } catch {
      setLoginError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIgLoading(false);
    }
  };

  const handleLogout = async () => {
    setIgLoading(true);
    try {
      await fetch(`${API}/instagram/logout`, { method: "POST", credentials: "include" });
      toast({ title: "Instagram desconectado" });
      await fetchStatus();
    } catch { /* silent */ } finally {
      setIgLoading(false);
    }
  };

  const connected = igStatus?.status === "connected";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-pink-600"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Instagram DM</h3>
          <p className="text-sm text-muted-foreground">Recibe y responde mensajes directos</p>
        </div>
        <button onClick={fetchStatus} className="ml-auto p-2 rounded-full hover:bg-slate-100 text-muted-foreground transition-colors" title="Actualizar estado">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            connected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            : igStatus?.status === "error" ? "bg-rose-500"
            : "bg-slate-300"
          )} />
          <span className="font-medium text-foreground">
            {connected ? `Conectado como @${igStatus?.username}` : "No conectado"}
          </span>
        </div>
        <Badge variant={connected ? "success" : "neutral"}>{connected ? "Activo" : "Inactivo"}</Badge>
      </div>

      {connected ? (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800">
            <p className="font-semibold mb-1">Sondeo activo</p>
            <p className="text-xs text-emerald-700">Los mensajes de Instagram DM se sincronizan automáticamente cada 30 segundos.</p>
            {igStatus?.lastPollAt && (
              <p className="text-xs text-emerald-600 mt-1">Última revisión: {new Date(igStatus.lastPollAt).toLocaleTimeString("es-EC")}</p>
            )}
          </div>
          <Button
            variant="secondary"
            className="w-full flex items-center gap-2 text-rose-600 hover:bg-rose-50 border-rose-200"
            onClick={handleLogout}
            disabled={igLoading}
          >
            <LogOut className="w-4 h-4" />
            {igLoading ? "Cerrando sesión..." : "Cerrar sesión de Instagram"}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">Usuario de Instagram</label>
            <Input
              placeholder="tu_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={igLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">Contraseña</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={igLoading}
            />
          </div>
          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
              {loginError}
            </div>
          )}
          <Button type="submit" className="w-full flex items-center gap-2" disabled={igLoading || !username.trim() || !password.trim()}>
            <LogIn className="w-4 h-4" />
            {igLoading ? "Iniciando sesión..." : "Conectar Instagram"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Se usa la API privada de Instagram. Usa una cuenta dedicada para el bot.
          </p>
        </form>
      )}
    </Card>
  );
}

/* ─── Connections Tab ────────────────────────────────── */
function ConnectionsTab() {
  const { data: status } = useBotStatus();
  const testMutation = useBotTest();
  const { toast } = useToast();
  const [testMessage, setTestMessage] = useState("");
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);

  if (!status) return null;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(status.webhookUrl);
    toast({ title: "Copiado", description: "URL de Webhook copiada al portapapeles" });
  };

  const handleTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    const userMsg = testMessage;
    setChatLog((prev) => [...prev, { role: "user", content: userMsg }]);
    setTestMessage("");
    testMutation.mutate(
      { data: { message: userMsg } },
      {
        onSuccess: (data) => {
          setChatLog((prev) => [...prev, {
            role: "bot",
            content: data.response,
            images: data.productImages as ProductImage[] | undefined,
          }]);
          if (data.productsFound > 0) {
            toast({ title: "Productos encontrados", description: `La IA consultó ${data.productsFound} productos.` });
          }
        },
        onError: () =>
          setChatLog((prev) => [...prev, { role: "bot", content: "Error de conexión con la IA. Intenta nuevamente." }]),
      }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        {/* Odoo */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600"><Link2 className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Conexión Odoo</h3>
              <p className="text-sm text-muted-foreground">Sincronización de catálogo</p>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", status.odooConnected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500")} />
              <span className="font-medium text-foreground">Estado API Odoo</span>
            </div>
            <Badge variant={status.odooConnected ? "success" : "error"}>{status.odooConnected ? "Conectado" : "Fallo"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Las credenciales de Odoo están configuradas en las variables de entorno (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY).</p>
        </Card>

        {/* WhatsApp */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><Webhook className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xl font-bold text-foreground">WhatsApp API</h3>
              <p className="text-sm text-muted-foreground">Configuración de Meta</p>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", status.whatsappConfigured ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-amber-500 animate-pulse")} />
              <span className="font-medium text-foreground">Recepción de Mensajes</span>
            </div>
            <Badge variant={status.whatsappConfigured ? "success" : "warning"}>{status.whatsappConfigured ? "Activo" : "Esperando Webhook"}</Badge>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-bold text-foreground">URL del Webhook</label>
            <p className="text-xs text-muted-foreground mb-2">Copia esta URL y pégala en la configuración de Webhooks de tu App de Meta.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900 text-emerald-400 p-3 rounded-xl text-xs sm:text-sm font-mono break-all border border-slate-800 shadow-inner">{status.webhookUrl}</code>
              <Button variant="secondary" size="icon" onClick={handleCopyWebhook} className="shrink-0 bg-slate-200 hover:bg-slate-300"><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
            <h4 className="font-bold text-primary mb-1 text-sm flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Instrucciones Meta</h4>
            <ol className="text-xs text-slate-600 list-decimal pl-4 space-y-1 mt-2">
              <li>Ve a developers.facebook.com</li>
              <li>Abre tu App {'>'} WhatsApp {'>'} Configuración</li>
              <li>En Webhooks, haz clic en Editar</li>
              <li>Pega la URL de arriba</li>
              <li>Usa cualquier texto como token de verificación</li>
              <li>Suscríbete al evento "messages"</li>
            </ol>
          </div>
        </Card>

        {/* Instagram */}
        <InstagramCard />
      </div>

      {/* Simulator */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <Card className="flex flex-col h-[600px] border-primary/20 shadow-lg shadow-primary/5">
          <div className="p-4 border-b border-border bg-slate-50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white"><Bot className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Simulador de IA</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold">Dapa Home Bot</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {chatLog.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-50">
                <Bot className="w-12 h-12 mb-3 text-slate-400" />
                <p className="text-sm font-medium text-slate-500">Envía un mensaje para probar cómo responde la IA.</p>
                <p className="text-xs text-slate-400 mt-1">La IA consultará los productos de Odoo reales.</p>
              </div>
            ) : (
              chatLog.map((msg, idx) => (
                <div key={idx} className={cn("flex flex-col w-full gap-2", msg.role === "bot" ? "items-start" : "items-end")}>
                  <div className={cn("px-4 py-2.5 rounded-2xl max-w-[85%] text-[15px] shadow-sm whitespace-pre-wrap", msg.role === "bot" ? "bg-white border border-slate-100 text-slate-800 rounded-bl-sm" : "bg-primary text-white rounded-br-sm")}>
                    {msg.content}
                  </div>
                  {msg.role === "bot" && msg.images && msg.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap max-w-[90%]">
                      {msg.images.map((img, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm w-32">
                          <img src={img.imageUrl} alt={img.name} className="w-full h-24 object-cover" onError={(e) => { (e.target as HTMLImageElement).parentElement?.remove(); }} />
                          <div className="p-2">
                            <p className="text-xs font-bold text-slate-700 line-clamp-1">{img.name}</p>
                            <p className="text-xs text-primary font-bold">{formatCurrency(img.price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {testMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-border bg-white">
            <form onSubmit={handleTestSubmit} className="flex gap-2">
              <Input placeholder="Pregunta por un producto..." value={testMessage} onChange={(e) => setTestMessage(e.target.value)} disabled={testMutation.isPending} className="rounded-full bg-slate-50" />
              <Button type="submit" size="icon" disabled={!testMessage.trim() || testMutation.isPending} className="rounded-full shrink-0"><Send className="w-4 h-4" /></Button>
            </form>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

/* ─── Q&A Row ────────────────────────────────────────── */
interface QaRowProps {
  pair: BotQaPair;
  onEdit: (pair: BotQaPair) => void;
  onToggle: (pair: BotQaPair) => void;
  onDelete: (id: number) => void;
}
function QaRow({ pair, onEdit, onToggle, onDelete }: QaRowProps) {
  return (
    <div className={cn("border border-border rounded-xl p-4 flex gap-3 transition-opacity", pair.active ? "bg-white" : "bg-slate-50 opacity-60")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">❓ {pair.question}</p>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">💬 {pair.answer}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onToggle(pair)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title={pair.active ? "Desactivar" : "Activar"}>
          {pair.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
        </button>
        <button onClick={() => onEdit(pair)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(pair.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/* ─── Q&A Modal ──────────────────────────────────────── */
interface QaModalProps {
  pair: BotQaPair | null;
  onClose: () => void;
  onSave: (q: string, a: string) => void;
  isSaving: boolean;
}
function QaModal({ pair, onClose, onSave, isSaving }: QaModalProps) {
  const [q, setQ] = useState(pair?.question ?? "");
  const [a, setA] = useState(pair?.answer ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">{pair ? "Editar pregunta" : "Nueva pregunta"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">Pregunta del cliente</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej: ¿Hacen envíos a todo el país?" />
          </div>
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">Respuesta del bot</label>
            <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Ej: Sí, realizamos envíos a todo Ecuador a través de Servientrega..." rows={4} className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-border bg-slate-50">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(q, a)} disabled={!q.trim() || !a.trim() || isSaving}>{isSaving ? "Guardando..." : pair ? "Guardar cambios" : "Añadir"}</Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Training Tab ───────────────────────────────────── */
function TrainingTab() {
  const { data, isLoading, error } = useBotTraining();
  const saveConfig = useSaveBotConfig();
  const createQa = useCreateQaPair();
  const updateQa = useUpdateQaPair();
  const deleteQa = useDeleteQaPair();
  const { toast } = useToast();

  const [instructions, setInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [qaModal, setQaModal] = useState<BotQaPair | null | undefined>(undefined);

  useEffect(() => {
    if (data?.config.customInstructions != null) {
      setInstructions(data.config.customInstructions ?? "");
      setInstructionsDirty(false);
    }
  }, [data?.config.customInstructions]);

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Cargando entrenamiento...</div>;
  if (error) return <div className="py-20 text-center text-rose-500">No se pudo cargar el entrenamiento.</div>;

  const qaPairs = data?.qaPairs ?? [];

  function handleSaveInstructions() {
    saveConfig.mutate(instructions, {
      onSuccess: () => {
        toast({ title: "Guardado", description: "Instrucciones del bot actualizadas." });
        setInstructionsDirty(false);
      },
      onError: () => toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" }),
    });
  }

  function handleSaveQa(q: string, a: string) {
    if (qaModal?.id) {
      updateQa.mutate({ id: qaModal.id, data: { question: q, answer: a } }, {
        onSuccess: () => { toast({ title: "Actualizado" }); setQaModal(undefined); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      createQa.mutate({ question: q, answer: a }, {
        onSuccess: () => { toast({ title: "Pregunta añadida" }); setQaModal(undefined); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  }

  function handleToggleQa(pair: BotQaPair) {
    updateQa.mutate({ id: pair.id, data: { active: !pair.active } }, {
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function handleDeleteQa(id: number) {
    deleteQa.mutate(id, {
      onSuccess: () => toast({ title: "Eliminado" }),
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Custom Instructions */}
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600"><Sparkles className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Personalidad e Instrucciones</h3>
              <p className="text-sm text-muted-foreground">Define cómo debe comportarse y comunicarse el bot</p>
            </div>
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 mb-5 text-xs text-violet-700">
            <strong>Ejemplos de lo que puedes escribir:</strong> tono formal/informal, productos a destacar, promociones actuales, políticas de la tienda, horarios de atención, información de envíos, etc.
          </div>

          <textarea
            value={instructions}
            onChange={(e) => { setInstructions(e.target.value); setInstructionsDirty(true); }}
            placeholder={`Ejemplos:\n- Usa un tono cálido y cercano, como si fuera un asesor de decoración.\n- Siempre menciona que tenemos envíos gratis en compras mayores a $80.\n- Cuando pregunten por precios, recuerda que aceptamos tarjetas y transferencia.\n- Horario de atención: lunes a sábado de 9am a 6pm.`}
            rows={12}
            className="w-full border border-input rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none font-sans"
          />

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">{instructions.length} caracteres</p>
            <Button
              onClick={handleSaveInstructions}
              disabled={!instructionsDirty || saveConfig.isPending}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveConfig.isPending ? "Guardando..." : "Guardar instrucciones"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Q&A Knowledge Base */}
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600"><BookOpen className="w-5 h-5" /></div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Base de Conocimiento</h3>
                <p className="text-sm text-muted-foreground">Preguntas frecuentes con respuestas exactas</p>
              </div>
            </div>
            <Button onClick={() => setQaModal(null)} className="flex items-center gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Añadir
            </Button>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5 text-xs text-amber-700">
            <strong>Cuándo usar esto:</strong> cuando quieras que el bot dé una respuesta específica y precisa a preguntas concretas: envíos, devoluciones, garantías, ubicación, métodos de pago, etc.
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {qaPairs.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Aún no hay preguntas guardadas</p>
                <p className="text-xs text-muted-foreground mt-1">Añade las preguntas más frecuentes de tus clientes</p>
              </div>
            ) : (
              qaPairs.map((pair) => (
                <QaRow
                  key={pair.id}
                  pair={pair}
                  onEdit={(p) => setQaModal(p)}
                  onToggle={handleToggleQa}
                  onDelete={handleDeleteQa}
                />
              ))
            )}
          </div>

          {qaPairs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-right">
              {qaPairs.filter((p) => p.active).length} de {qaPairs.length} activas
            </p>
          )}
        </Card>
      </div>

      <AnimatePresence>
        {qaModal !== undefined && (
          <QaModal
            pair={qaModal}
            onClose={() => setQaModal(undefined)}
            onSave={handleSaveQa}
            isSaving={createQa.isPending || updateQa.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Business Hours Tab ─────────────────────────────── */
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const DAY_LABELS: Record<string, string> = {
  mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves",
  fri: "Viernes", sat: "Sábado", sun: "Domingo",
};
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface DaySlot { enabled: boolean; start: string; end: string; }
interface HoursState {
  enabled: boolean;
  timezone: string;
  days: Record<string, DaySlot>;
  closedMessage: string;
}

const DEFAULT_HOURS: HoursState = {
  enabled: false,
  timezone: "America/Guayaquil",
  days: {
    mon: { enabled: true, start: "09:00", end: "18:00" },
    tue: { enabled: true, start: "09:00", end: "18:00" },
    wed: { enabled: true, start: "09:00", end: "18:00" },
    thu: { enabled: true, start: "09:00", end: "18:00" },
    fri: { enabled: true, start: "09:00", end: "18:00" },
    sat: { enabled: true, start: "09:00", end: "13:00" },
    sun: { enabled: false, start: "09:00", end: "13:00" },
  },
  closedMessage: "¡Hola! Gracias por escribirnos. En este momento estamos fuera de horario de atención. Nuestro horario es lunes a viernes 9:00–18:00 y sábados 9:00–13:00. Te responderemos pronto. 🏠",
};

function BusinessHoursTab() {
  const { toast } = useToast();
  const [state, setState] = React.useState<HoursState | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API_URL}/bot/hours`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setState({
          enabled: data.enabled ?? false,
          timezone: data.hours?.timezone ?? "America/Guayaquil",
          days: data.hours?.days ?? DEFAULT_HOURS.days,
          closedMessage: data.hours?.closedMessage ?? DEFAULT_HOURS.closedMessage,
        });
      })
      .catch(() => setState(DEFAULT_HOURS));
  }, []);

  function update(partial: Partial<HoursState>) {
    setState(prev => prev ? { ...prev, ...partial } : prev);
    setDirty(true);
  }

  function updateDay(day: string, partial: Partial<DaySlot>) {
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, days: { ...prev.days, [day]: { ...prev.days[day], ...partial } } };
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!state) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/bot/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: state.enabled,
          hours: { timezone: state.timezone, days: state.days, closedMessage: state.closedMessage },
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast({ title: "Horario guardado" });
      setDirty(false);
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!state) return <div className="py-12 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600"><Clock className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Horarios de Atención</h3>
              <p className="text-sm text-muted-foreground">El bot responde "fuera de horario" automáticamente</p>
            </div>
          </div>
          <button
            onClick={() => update({ enabled: !state.enabled })}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-all",
              state.enabled
                ? "border-teal-400 bg-teal-50 text-teal-700"
                : "border-border bg-white text-muted-foreground"
            )}
          >
            <Power className="w-4 h-4" />
            {state.enabled ? "Activado" : "Desactivado"}
          </button>
        </div>

        <div className={cn("space-y-3 transition-opacity", !state.enabled && "opacity-50 pointer-events-none")}>
          {DAY_KEYS.map((day) => {
            const slot = state.days[day];
            return (
              <div key={day} className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                slot.enabled ? "bg-white border-border" : "bg-slate-50 border-slate-100"
              )}>
                <button
                  onClick={() => updateDay(day, { enabled: !slot.enabled })}
                  className={cn("w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0",
                    slot.enabled ? "bg-teal-500 border-teal-500 text-white" : "border-slate-300"
                  )}
                >
                  {slot.enabled && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <span className={cn("w-24 font-medium text-sm shrink-0", !slot.enabled && "text-muted-foreground")}>
                  {DAY_LABELS[day]}
                </span>
                {slot.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateDay(day, { start: e.target.value })}
                      className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <span className="text-muted-foreground text-sm">a</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateDay(day, { end: e.target.value })}
                      className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-bold text-foreground mb-3">Mensaje fuera de horario</h3>
        <p className="text-xs text-muted-foreground mb-3">Este mensaje se enviará automáticamente cuando un cliente escriba fuera del horario configurado.</p>
        <textarea
          value={state.closedMessage}
          onChange={(e) => update({ closedMessage: e.target.value })}
          rows={4}
          className="w-full border border-input rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Guardando..." : "Guardar horario"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */
const TABS = [
  { id: "connections", label: "Conexiones", icon: Link2 },
  { id: "training", label: "Entrenamiento del Bot", icon: BrainCircuit },
  { id: "hours", label: "Horario", icon: Clock },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Settings() {
  const { isLoading, error } = useBotStatus();
  const [activeTab, setActiveTab] = useState<TabId>("connections");

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorState message="No se pudo cargar la configuración." />;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      <PageHeader title="Configuración" description="Administra las conexiones, entrena la IA y prueba el comportamiento del bot." />

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-muted/60 p-1 rounded-xl w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                activeTab === tab.id
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "training" && <TrainingTab />}
          {activeTab === "hours" && <BusinessHoursTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
