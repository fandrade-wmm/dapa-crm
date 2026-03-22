import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingScreen, ErrorState } from "@/components/ui-elements";
import {
  ArrowLeft, User, Bot, Clock, Zap, ZapOff, Send, Loader2, PenLine,
  Image as ImageIcon, Video, FileText, BookOpen, X,
  ChevronDown, MessageSquarePlus, Smile, Package, Search,
  CheckCircle2, XCircle, Tag, StickyNote, UserRound, Plus, Check,
} from "lucide-react";
import EmojiPicker, { Theme, EmojiStyle } from "emoji-picker-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const AVAILABLE_LABELS = ["Interesado", "Cotización enviada", "Compró", "Seguimiento", "Sin stock", "VIP"];
const LABEL_COLORS: Record<string, string> = {
  "Interesado": "bg-blue-100 text-blue-700 border-blue-200",
  "Cotización enviada": "bg-amber-100 text-amber-700 border-amber-200",
  "Compró": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Seguimiento": "bg-purple-100 text-purple-700 border-purple-200",
  "Sin stock": "bg-rose-100 text-rose-700 border-rose-200",
  "VIP": "bg-yellow-100 text-yellow-700 border-yellow-200",
};
function lc(label: string) { return LABEL_COLORS[label] || "bg-slate-100 text-slate-600 border-slate-200"; }

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  messageType: string;
  mediaUrl: string | null;
  isInternalNote: boolean;
  createdAt: string;
}

interface ConversationDetail {
  id: number;
  customerPhone: string;
  customerName: string | null;
  status: string;
  aiEnabled: boolean;
  labels: string[];
  assignedAgentId: number | null;
  assignedAgent: { id: number; name: string } | null;
  messages: ChatMessage[];
  channel?: string;
  instagramThreadId?: string | null;
}

interface TeamMember { id: number; name: string; email: string; role: string; }

interface Catalogue {
  id: number;
  name: string;
  originalFilename: string;
  objectPath: string;
}

interface QuickResponse {
  id: number;
  title: string;
  content: string;
  category: string | null;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
}

type AttachmentType = "image" | "video" | "document" | "catalogue" | "product";

interface Attachment {
  type: AttachmentType;
  file?: File;
  preview?: string;
  objectPath?: string;
  publicUrl?: string;
  filename?: string;
  uploading?: boolean;
  uploadError?: string;
  catalogueId?: number;
  catalogueName?: string;
  productId?: number;
  productName?: string;
  productPrice?: number;
  productStock?: number;
  productImageUrl?: string;
}

// Upload a file using presigned URL flow
async function uploadFile(file: File): Promise<{ objectPath: string; publicUrl: string }> {
  // Step 1: get presigned URL
  const metaRes = await fetch(`${API}/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!metaRes.ok) throw new Error("No se pudo obtener URL de subida");
  const { uploadURL, objectPath } = await metaRes.json();

  // Step 2: PUT file directly to presigned URL
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Error al subir el archivo");

  // Build public URL
  const origin = window.location.origin;
  const basePath = BASE || "";
  const publicUrl = `${origin}${basePath}/api/storage${objectPath}`;

  return { objectPath, publicUrl };
}

function AttachmentPreview({ attachment, onRemove, onCaptionChange, caption }: {
  attachment: Attachment;
  onRemove: () => void;
  caption: string;
  onCaptionChange: (v: string) => void;
}) {
  // Product type gets its own rich preview card
  if (attachment.type === "product") {
    const inStock = (attachment.productStock ?? 0) > 0;
    return (
      <div className="border border-emerald-200 rounded-xl p-3 mx-4 mb-2 bg-emerald-50">
        <div className="flex items-start gap-3">
          {attachment.productImageUrl ? (
            <img
              src={attachment.productImageUrl}
              alt={attachment.productName}
              className="w-16 h-16 rounded-lg object-cover shrink-0 border border-emerald-200"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Package className="w-7 h-7 text-emerald-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-800">Producto</span>
              <button onClick={onRemove} className="p-1 rounded-full hover:bg-emerald-200 transition-colors shrink-0">
                <X className="w-3.5 h-3.5 text-emerald-700" />
              </button>
            </div>
            <p className="text-xs font-semibold text-foreground truncate mt-0.5">{attachment.productName}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-emerald-700">${attachment.productPrice?.toFixed(2)}</span>
              {inStock ? (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Disponible
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-rose-500">
                  <XCircle className="w-3 h-3" /> Sin stock
                </span>
              )}
            </div>
            <Input
              placeholder="Mensaje adicional opcional..."
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              className="mt-2 h-7 text-xs bg-white/60"
            />
          </div>
        </div>
      </div>
    );
  }

  const icons = {
    image: ImageIcon,
    video: Video,
    document: FileText,
    catalogue: BookOpen,
    product: Package,
  };
  const colors = {
    image: "text-purple-600 bg-purple-50 border-purple-200",
    video: "text-orange-600 bg-orange-50 border-orange-200",
    document: "text-blue-600 bg-blue-50 border-blue-200",
    catalogue: "text-red-600 bg-red-50 border-red-200",
    product: "text-emerald-600 bg-emerald-50 border-emerald-200",
  };
  const labels = {
    image: "Imagen",
    video: "Video",
    document: "Documento",
    catalogue: "Catálogo PDF",
    product: "Producto",
  };
  const Icon = icons[attachment.type];

  return (
    <div className={cn("border rounded-xl p-3 mx-4 mb-2 bg-white", colors[attachment.type])}>
      <div className="flex items-start gap-3">
        {attachment.type === "image" && attachment.preview ? (
          <img src={attachment.preview} alt="preview" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-slate-200" />
        ) : (
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", colors[attachment.type])}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{labels[attachment.type]}</span>
            <button onClick={onRemove} className="p-1 rounded-full hover:bg-black/10 transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs truncate text-current opacity-70 mt-0.5">
            {attachment.catalogueName || attachment.filename || attachment.file?.name || "Archivo listo"}
          </p>
          {attachment.uploading && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Subiendo...</span>
            </div>
          )}
          {attachment.uploadError && (
            <p className="text-xs text-red-600 mt-1">{attachment.uploadError}</p>
          )}
          {!attachment.uploading && !attachment.uploadError && attachment.type !== "catalogue" && (
            <Input
              placeholder="Subtítulo opcional..."
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              className="mt-2 h-7 text-xs bg-white/60"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationDetail() {
  const [, params] = useRoute("/conversations/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [replyText, setReplyText] = useState("");
  const [caption, setCaption] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  const { data: conversation, isLoading, error } = useQuery<ConversationDetail>({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const res = await fetch(`${API}/conversations/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 8000,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members-list"],
    queryFn: async () => {
      const res = await fetch(`${API}/team`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Mark as read on mount / when conversation changes
  useEffect(() => {
    if (!id) return;
    fetch(`${API}/conversations/${id}/mark-read`, {
      method: "PATCH",
      credentials: "include",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["layout-stats"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }).catch(() => {});
  }, [id]);

  const labelsMutation = useMutation({
    mutationFn: async (labels: string[]) => {
      const res = await fetch(`${API}/conversations/${id}/labels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ labels }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["conversation", id], (old: ConversationDetail | undefined) =>
        old ? { ...old, labels: data.labels } : old
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast({ title: "Error al actualizar etiquetas", variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (agentId: number | null) => {
      const res = await fetch(`${API}/conversations/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["conversation", id], (old: ConversationDetail | undefined) => {
        if (!old) return old;
        const agent = teamMembers.find(m => m.id === data.assignedAgentId) || null;
        return { ...old, assignedAgentId: data.assignedAgentId, assignedAgent: agent ? { id: agent.id, name: agent.name } : null };
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: data.assignedAgentId ? "Agente asignado" : "Asignación removida" });
    },
    onError: () => toast({ title: "Error al asignar agente", variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch(`${API}/conversations/${id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      setNoteMode(false);
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      toast({ title: "Nota interna guardada" });
    },
    onError: () => toast({ title: "Error al guardar nota", variant: "destructive" }),
  });

  const { data: catalogues = [] } = useQuery<Catalogue[]>({
    queryKey: ["catalogues-list"],
    queryFn: async () => {
      const res = await fetch(`${API}/catalogues`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.catalogues || [];
    },
  });

  const { data: quickResponses = [] } = useQuery<QuickResponse[]>({
    queryKey: ["quick-responses"],
    queryFn: async () => {
      const res = await fetch(`${API}/quick-responses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ["products-picker", productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (productSearch.trim()) params.set("search", productSearch.trim());
      const res = await fetch(`${API}/products?${params}`, { credentials: "include" });
      if (!res.ok) return { products: [], total: 0 };
      return res.json();
    },
    enabled: productOpen,
    staleTime: 30_000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length]);

  // Paste image from clipboard
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!conversation || conversation.aiEnabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFileSelected(file, "image");
          break;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [conversation]);

  async function handleFileSelected(file: File, type: AttachmentType) {
    // Image preview
    let preview: string | undefined;
    if (type === "image") {
      preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }

    const att: Attachment = {
      type,
      file,
      filename: file.name,
      preview,
      uploading: true,
    };
    setAttachment(att);
    setCaption("");

    try {
      const { objectPath, publicUrl } = await uploadFile(file);
      setAttachment((prev) => prev ? { ...prev, uploading: false, objectPath, publicUrl } : null);
    } catch (err) {
      setAttachment((prev) => prev ? { ...prev, uploading: false, uploadError: "Error al subir. Intenta de nuevo." } : null);
    }
  }

  const toggleAiMutation = useMutation({
    mutationFn: async (aiEnabled: boolean) => {
      const res = await fetch(`${API}/conversations/${id}/toggle-ai`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["conversation", id], (old: ConversationDetail | undefined) =>
        old ? { ...old, aiEnabled: data.aiEnabled } : old
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: data.aiEnabled ? "IA activada" : "IA pausada — modo manual" });
    },
    onError: () => toast({ title: "Error al cambiar IA", variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};

      if (attachment?.type === "catalogue" && attachment.catalogueId) {
        body.type = "catalogue";
        body.catalogueId = attachment.catalogueId;
        body.caption = caption || undefined;
      } else if (attachment?.type === "product" && attachment.productImageUrl) {
        const inStock = (attachment.productStock ?? 0) > 0;
        const defaultCaption = `🛍️ *${attachment.productName}*\n💰 Precio: $${attachment.productPrice?.toFixed(2)}\n${inStock ? "✅ Disponible en stock" : "❌ Sin stock"}`;
        body.type = "image";
        body.mediaUrl = attachment.productImageUrl;
        body.caption = caption ? `${defaultCaption}\n\n${caption}` : defaultCaption;
      } else if (attachment && attachment.publicUrl) {
        body.type = attachment.type;
        body.mediaUrl = attachment.publicUrl;
        body.filename = attachment.filename;
        body.caption = caption || undefined;
      } else {
        body.type = "text";
        body.message = replyText.trim();
        if (!body.message) throw new Error("Empty message");
      }

      const res = await fetch(`${API}/conversations/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      setCaption("");
      setAttachment(null);
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      textareaRef.current?.focus();
    },
    onError: (err) => toast({ title: `Error: ${err.message}`, variant: "destructive" }),
  });

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setReplyText((prev) => prev + emoji);
      return;
    }
    const start = ta.selectionStart ?? replyText.length;
    const end = ta.selectionEnd ?? replyText.length;
    const newText = replyText.substring(0, start) + emoji + replyText.substring(end);
    setReplyText(newText);
    // Restore cursor position after emoji
    requestAnimationFrame(() => {
      ta.selectionStart = start + emoji.length;
      ta.selectionEnd = start + emoji.length;
      ta.focus();
    });
    setEmojiOpen(false);
  }

  function handleSend() {
    if (replyMutation.isPending) return;
    if (!attachment && !replyText.trim()) return;
    if (attachment?.uploading) {
      toast({ title: "Espera a que termine la subida", variant: "destructive" });
      return;
    }
    replyMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = (!!attachment && !attachment.uploading && !attachment.uploadError && (attachment.type !== "product" || !!attachment.productImageUrl)) || !!replyText.trim();

  if (isLoading) return <LoadingScreen />;
  if (error || !conversation) return <ErrorState message="No se pudo cargar esta conversación." />;

  const aiEnabled = conversation.aiEnabled;

  return (
    <div className="relative bg-slate-50" style={{ minHeight: "calc(100vh - 0px)" }}>
      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (f) handleFileSelected(f, "image"); e.target.value = "";
      }} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (f) handleFileSelected(f, "video"); e.target.value = "";
      }} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (f) handleFileSelected(f, "document"); e.target.value = "";
      }} />

      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white border-b border-border shadow-sm">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/conversations">
              <button className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-muted-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                conversation.channel === "instagram"
                  ? "bg-gradient-to-br from-purple-200 to-pink-100 text-purple-700"
                  : "bg-primary/10 text-primary"
              )}>
                {conversation.customerName
                  ? conversation.customerName.charAt(0).toUpperCase()
                  : <User className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-foreground leading-tight text-sm">
                    {conversation.customerName || conversation.customerPhone}
                  </h2>
                  {conversation.channel === "instagram" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      Instagram
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{conversation.customerPhone}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleAiMutation.mutate(!aiEnabled)}
            disabled={toggleAiMutation.isPending}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 font-semibold text-xs transition-all",
              aiEnabled
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            )}
          >
            {toggleAiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : aiEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{aiEnabled ? "IA Activa" : "IA Pausada"}</span>
          </button>
        </div>

        {/* Labels + Agent row */}
        <div className="px-4 sm:px-6 pb-2 flex flex-wrap items-center gap-2">
          {/* Current labels */}
          {(conversation.labels || []).map((label) => (
            <button
              key={label}
              onClick={() => labelsMutation.mutate((conversation.labels || []).filter(l => l !== label))}
              className={cn("flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border hover:opacity-70 transition-opacity", lc(label))}
            >
              {label} <X className="w-3 h-3 ml-0.5" />
            </button>
          ))}

          {/* Add label */}
          <div className="relative">
            <button
              onClick={() => setLabelMenuOpen(p => !p)}
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary transition-colors"
            >
              <Tag className="w-3 h-3" /> Etiqueta
            </button>
            {labelMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-30 py-1 min-w-[180px]">
                {AVAILABLE_LABELS.map(label => {
                  const active = (conversation.labels || []).includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        const current = conversation.labels || [];
                        const next = active ? current.filter(l => l !== label) : [...current, label];
                        labelsMutation.mutate(next);
                        setLabelMenuOpen(false);
                      }}
                      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors", active && "font-bold")}
                    >
                      <span className={cn("w-2 h-2 rounded-full", lc(label).split(" ")[0].replace("bg-", "bg-"))} />
                      {label}
                      {active && <Check className="w-3 h-3 ml-auto text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Agent assignment */}
          <div className="relative ml-auto">
            <button
              onClick={() => setAgentMenuOpen(p => !p)}
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                conversation.assignedAgent
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary"
              )}
            >
              <UserRound className="w-3 h-3" />
              {conversation.assignedAgent ? conversation.assignedAgent.name : "Asignar agente"}
            </button>
            {agentMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-30 py-1 min-w-[180px]">
                <button
                  onClick={() => { assignMutation.mutate(null); setAgentMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-3 h-3" /> Sin asignación
                </button>
                {teamMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => { assignMutation.mutate(member.id); setAgentMenuOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors", conversation.assignedAgentId === member.id && "font-bold text-primary")}
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {member.name}
                    {conversation.assignedAgentId === member.id && <Check className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Manual mode banner */}
      <AnimatePresence>
        {!aiEnabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden sticky top-[57px] z-10">
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-amber-700">
                Modo manual activo — la IA no responderá. Responde directamente desde aquí.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat messages */}
      <div className="px-4 sm:px-6 py-6 space-y-4 relative pb-44">
        <div className="text-center my-4">
          <span className="bg-slate-200/60 text-slate-500 text-xs px-3 py-1 rounded-full font-medium">
            Inicio de la conversación
          </span>
        </div>

        {conversation.messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Sin mensajes.</div>
        ) : (
          conversation.messages.map((msg, idx) => {
            const isBot = msg.role === "assistant";

            // Internal note: special yellow bubble
            if (msg.isInternalNote || msg.messageType === "note") {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className="flex justify-center"
                >
                  <div className="max-w-[85%] sm:max-w-[72%]">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <StickyNote className="w-3 h-3 text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Nota interna</span>
                      </div>
                      <p className="text-[13px] text-amber-900 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <p className="text-[10px] text-amber-500 mt-1 text-right">{format(new Date(msg.createdAt), "HH:mm", { locale: es })}</p>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                key={msg.id}
                className={cn("flex w-full", isBot ? "justify-start" : "justify-end")}
              >
                <div className={cn("flex max-w-[85%] sm:max-w-[72%] gap-2.5", isBot ? "flex-row" : "flex-row-reverse")}>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto", isBot ? "bg-slate-800 text-white" : "bg-emerald-500 text-white")}>
                    {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className={cn("rounded-2xl shadow-sm overflow-hidden", isBot ? "bg-white border border-slate-100 text-slate-800 rounded-bl-sm" : "bg-emerald-500 text-white rounded-br-sm")}>
                      {/* Image message */}
                      {(msg.messageType === "image") && msg.mediaUrl ? (
                        <div>
                          <img
                            src={msg.mediaUrl}
                            alt="imagen"
                            className="w-full max-w-[260px] object-cover rounded-t-2xl"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                          <div className="hidden px-3 py-2 text-xs text-muted-foreground italic">No se pudo cargar la imagen</div>
                          {msg.content && (
                            <div className="px-4 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap border-t border-slate-100">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      ) : msg.messageType === "video" && msg.mediaUrl ? (
                        <div>
                          <video src={msg.mediaUrl} controls className="w-full max-w-[280px] rounded-t-2xl" />
                          {msg.content && <div className="px-4 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap border-t border-slate-100">{msg.content}</div>}
                        </div>
                      ) : msg.messageType === "document" && msg.mediaUrl ? (
                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
                          className={cn("flex items-center gap-3 px-4 py-3 no-underline", isBot ? "text-slate-800" : "text-white")}>
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isBot ? "bg-blue-100" : "bg-white/20")}>
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{msg.content || "Documento"}</p>
                            <p className={cn("text-[11px] mt-0.5", isBot ? "text-muted-foreground" : "text-white/70")}>Toca para abrir</p>
                          </div>
                        </a>
                      ) : msg.messageType === "catalogue" ? (
                        <div className={cn("flex items-center gap-3 px-4 py-3", isBot ? "text-slate-800" : "text-white")}>
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isBot ? "bg-red-100" : "bg-white/20")}>
                            <BookOpen className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold">Catálogo PDF</p>
                            <p className={cn("text-[11px] mt-0.5 truncate max-w-[160px]", isBot ? "text-muted-foreground" : "text-white/70")}>{msg.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}
                    </div>
                    <div className={cn("flex items-center text-[10px] text-slate-400 font-medium", isBot ? "justify-start ml-1" : "justify-end mr-1")}>
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(msg.createdAt), "HH:mm", { locale: es })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-border">
        {noteMode ? (
          <div>
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Nota interna — solo visible para el equipo</span>
              <button onClick={() => { setNoteMode(false); setReplyText(""); }} className="ml-auto p-1 rounded hover:bg-amber-200 transition-colors">
                <X className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>
            <div className="flex items-end gap-3 px-4 py-3">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  placeholder="Escribe una nota interna... (solo visible para el equipo)"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (replyText.trim()) noteMutation.mutate(replyText.trim()); } }}
                  disabled={noteMutation.isPending}
                  rows={2}
                  className="resize-none text-sm leading-relaxed min-h-[52px] max-h-32 bg-amber-50 border-amber-200 focus-visible:ring-amber-400"
                />
              </div>
              <Button
                onClick={() => { if (replyText.trim()) noteMutation.mutate(replyText.trim()); }}
                disabled={!replyText.trim() || noteMutation.isPending}
                className="h-[52px] w-14 shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 border-amber-500"
              >
                {noteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <StickyNote className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        ) : aiEnabled ? (
          <div className="px-5 py-3.5 text-center">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              La IA está gestionando esta conversación automáticamente.
            </p>
            <button
              onClick={() => setNoteMode(true)}
              className="mt-2 text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 mx-auto"
            >
              <StickyNote className="w-3 h-3" /> Añadir nota interna
            </button>
          </div>
        ) : (
          <div>
            {/* Attachment preview */}
            <AnimatePresence>
              {attachment && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-2">
                  <AttachmentPreview
                    attachment={attachment}
                    caption={caption}
                    onCaptionChange={setCaption}
                    onRemove={() => { setAttachment(null); setCaption(""); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toolbar */}
            <div className="px-4 pt-2 pb-1 flex items-center gap-1 border-b border-slate-100">
              {/* Image */}
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={!!attachment}
                title="Enviar imagen"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-purple-500" />
                <span className="hidden sm:inline">Imagen</span>
              </button>

              {/* Video */}
              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={!!attachment}
                title="Enviar video"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Video className="w-4 h-4 text-orange-500" />
                <span className="hidden sm:inline">Video</span>
              </button>

              {/* Document */}
              <button
                onClick={() => docInputRef.current?.click()}
                disabled={!!attachment}
                title="Enviar documento"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="hidden sm:inline">Documento</span>
              </button>

              {/* Emoji picker */}
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={!!attachment}
                    title="Emojis"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Smile className="w-4 h-4 text-yellow-500" />
                    <span className="hidden sm:inline">Emoji</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0 shadow-xl" align="start" side="top">
                  <EmojiPicker
                    onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
                    theme={Theme.LIGHT}
                    emojiStyle={EmojiStyle.NATIVE}
                    searchPlaceHolder="Buscar emoji..."
                    height={380}
                    width={320}
                    lazyLoadEmojis
                  />
                </PopoverContent>
              </Popover>

              {/* Catalogue */}
              <Popover open={catOpen} onOpenChange={setCatOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={!!attachment}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Enviar catálogo"
                  >
                    <BookOpen className="w-4 h-4 text-red-500" />
                    <span className="hidden sm:inline">Catálogo</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start" side="top">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Seleccionar catálogo</p>
                  {catalogues.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">No hay catálogos subidos. Ve a Catálogos para subir uno.</p>
                  ) : (
                    catalogues.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setAttachment({ type: "catalogue", catalogueId: c.id, catalogueName: c.name, filename: c.originalFilename });
                          setCaption("");
                          setCatOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-sm transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>

              {/* Product */}
              <button
                onClick={() => { setProductOpen(true); setProductSearch(""); }}
                disabled={!!attachment}
                title="Enviar producto"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Package className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">Producto</span>
              </button>

              {/* Internal note button */}
              <button
                onClick={() => { setNoteMode(true); setAttachment(null); }}
                title="Nota interna"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200"
              >
                <StickyNote className="w-4 h-4" />
                <span className="hidden sm:inline">Nota</span>
              </button>

              <div className="ml-auto">
                {/* Quick replies */}
                <Popover open={quickOpen} onOpenChange={setQuickOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                      title="Respuestas rápidas"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Respuestas rápidas</span>
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="end" side="top">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Respuestas rápidas</p>
                    {quickResponses.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-3 text-center">
                        No hay respuestas rápidas. <Link href="/quick-responses"><span className="text-primary underline cursor-pointer">Crear una</span></Link>
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {quickResponses.map((qr) => (
                          <button
                            key={qr.id}
                            onClick={() => {
                              setReplyText(qr.content);
                              setQuickOpen(false);
                              textareaRef.current?.focus();
                            }}
                            className="w-full text-left flex flex-col gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                          >
                            <span className="text-xs font-semibold text-foreground">{qr.title}</span>
                            <span className="text-xs text-muted-foreground line-clamp-2">{qr.content}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Text input + send */}
            <div className="flex items-end gap-3 px-4 py-3">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  placeholder={attachment ? "Subtítulo opcional para el archivo..." : "Escribe un mensaje... (Enter = enviar, Shift+Enter = nueva línea)"}
                  value={attachment ? caption : replyText}
                  onChange={(e) => attachment ? setCaption(e.target.value) : setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={replyMutation.isPending || (!!attachment && !!attachment.uploading)}
                  rows={2}
                  className="resize-none text-sm leading-relaxed min-h-[52px] max-h-32"
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!canSend || replyMutation.isPending || (!!attachment && !!attachment.uploading)}
                className="h-[52px] w-14 shrink-0 rounded-xl"
              >
                {replyMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center pb-2">
              Puedes pegar imágenes con Ctrl+V · El mensaje se enviará por WhatsApp cuando la API esté configurada.
            </p>
          </div>
        )}
      </div>

      {/* Product Picker Dialog */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-emerald-500" />
              Seleccionar producto
            </DialogTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !productsData?.products.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="w-10 h-10 text-muted-foreground opacity-30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No se encontraron productos</p>
                {productSearch && <p className="text-xs text-muted-foreground mt-1">Intenta con otro término de búsqueda</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productsData.products.map((p) => {
                  const inStock = p.stock > 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setAttachment({
                          type: "product",
                          productId: p.id,
                          productName: p.name,
                          productPrice: p.price,
                          productStock: p.stock,
                          productImageUrl: p.imageUrl,
                        });
                        setCaption("");
                        setProductOpen(false);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left group"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-border bg-slate-100">
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center"><svg class="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>`;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{p.name}</p>
                        <p className="text-base font-bold text-emerald-600 mt-1">${p.price.toFixed(2)}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-semibold mt-1 px-1.5 py-0.5 rounded-full",
                          inStock
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-600"
                        )}>
                          {inStock ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {inStock ? "Disponible" : "Sin stock"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {productsData && productsData.total > 50 && (
            <div className="px-5 py-2 border-t border-border text-xs text-muted-foreground text-center shrink-0">
              Mostrando 50 de {productsData.total} productos. Usa el buscador para encontrar más.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
