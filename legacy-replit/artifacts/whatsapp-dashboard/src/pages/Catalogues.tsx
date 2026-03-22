import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen,
  Upload,
  Trash2,
  Send,
  Download,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Catalogue {
  id: number;
  name: string;
  description: string | null;
  objectPath: string;
  originalFilename: string;
  fileSize: number | null;
  uploadedAt: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Catalogues() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedCatalogue, setSelectedCatalogue] = useState<Catalogue | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");

  const [sendPhone, setSendPhone] = useState("");
  const [sendCaption, setSendCaption] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["catalogues"],
    queryFn: async () => {
      const res = await fetch(`${API}/catalogues`);
      if (!res.ok) throw new Error("Error al cargar catálogos");
      return res.json() as Promise<{ catalogues: Catalogue[] }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/catalogues/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogues"] });
      toast({ title: "Catálogo eliminado" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ catalogue, phone, caption }: { catalogue: Catalogue; phone: string; caption: string }) => {
      const fileUrl = `${API}/storage${catalogue.objectPath}`;
      const res = await fetch(`${API}/whatsapp/send-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.replace(/\D/g, ""),
          documentUrl: fileUrl,
          filename: catalogue.originalFilename,
          caption: caption || `Catálogo: ${catalogue.name}`,
        }),
      });
      if (!res.ok) throw new Error("Error al enviar");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catálogo enviado por WhatsApp" });
      setSendOpen(false);
      setSendPhone("");
      setSendCaption("");
      setSelectedCatalogue(null);
    },
    onError: () => toast({ title: "Error al enviar por WhatsApp", variant: "destructive" }),
  });

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return;
    setUploadProgress("uploading");
    try {
      const urlRes = await fetch(`${API}/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadFile.name,
          size: uploadFile.size,
          contentType: uploadFile.type || "application/pdf",
        }),
      });
      if (!urlRes.ok) throw new Error("No se pudo obtener URL de subida");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": uploadFile.type || "application/pdf" },
        body: uploadFile,
      });
      if (!putRes.ok) throw new Error("Error al subir archivo");

      setUploadProgress("saving");
      const saveRes = await fetch(`${API}/catalogues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName.trim(),
          description: uploadDescription.trim() || null,
          objectPath,
          originalFilename: uploadFile.name,
          fileSize: uploadFile.size,
        }),
      });
      if (!saveRes.ok) throw new Error("Error al guardar catálogo");

      setUploadProgress("done");
      queryClient.invalidateQueries({ queryKey: ["catalogues"] });
      toast({ title: "Catálogo subido correctamente" });
      setTimeout(() => {
        setUploadOpen(false);
        setUploadFile(null);
        setUploadName("");
        setUploadDescription("");
        setUploadProgress("idle");
      }, 1000);
    } catch (err) {
      console.error(err);
      setUploadProgress("error");
      toast({ title: "Error al subir el catálogo", variant: "destructive" });
    }
  }

  const catalogues = data?.catalogues ?? [];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Catálogos</h1>
            <p className="text-muted-foreground mt-1">
              Sube y gestiona catálogos en PDF para enviarlos a clientes por WhatsApp.
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            Subir Catálogo
          </Button>
        </div>
      </motion.div>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : catalogues.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin catálogos aún</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Sube tu primer catálogo en PDF para poder enviarlo a tus clientes por WhatsApp.
            </p>
            <Button onClick={() => setUploadOpen(true)} className="mt-6 gap-2" variant="outline">
              <Upload className="w-4 h-4" />
              Subir primer catálogo
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogues.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{cat.originalFilename}</p>
                  </div>
                </div>

                {cat.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{cat.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3 mt-auto">
                  <span>{formatBytes(cat.fileSize)}</span>
                  <span>{formatDate(cat.uploadedAt)}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => {
                      setSelectedCatalogue(cat);
                      setSendCaption(`Catálogo: ${cat.name}`);
                      setSendOpen(true);
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    asChild
                  >
                    <a
                      href={`${API}/storage${cat.objectPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-red-50 px-2"
                    onClick={() => setDeleteId(cat.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!o && uploadProgress !== "uploading" && uploadProgress !== "saving") { setUploadOpen(false); setUploadFile(null); setUploadName(""); setUploadDescription(""); setUploadProgress("idle"); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Catálogo PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cat-name">Nombre del catálogo *</Label>
              <Input
                id="cat-name"
                placeholder="ej. Catálogo Verano 2026"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Descripción (opcional)</Label>
              <Textarea
                id="cat-desc"
                placeholder="Breve descripción del contenido..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Archivo PDF *</Label>
              <div
                className="mt-1 border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-foreground truncate max-w-xs">{uploadFile.name}</span>
                    <button
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Haz clic para seleccionar un PDF
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Sólo archivos PDF</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setUploadFile(f);
                    if (!uploadName) setUploadName(f.name.replace(/\.pdf$/i, ""));
                  }
                }}
              />
            </div>

            {uploadProgress === "error" && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Error al subir el archivo. Inténtalo de nuevo.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadName(""); setUploadDescription(""); setUploadProgress("idle"); }}
                disabled={uploadProgress === "uploading" || uploadProgress === "saving"}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleUpload}
                disabled={!uploadFile || !uploadName.trim() || uploadProgress === "uploading" || uploadProgress === "saving" || uploadProgress === "done"}
              >
                {uploadProgress === "uploading" && <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>}
                {uploadProgress === "saving" && <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>}
                {uploadProgress === "done" && <><CheckCircle2 className="w-4 h-4" /> ¡Listo!</>}
                {(uploadProgress === "idle" || uploadProgress === "error") && <><Upload className="w-4 h-4" /> Subir PDF</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send via WhatsApp Dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { if (!o) { setSendOpen(false); setSendPhone(""); setSendCaption(""); setSelectedCatalogue(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-green-600" />
              Enviar por WhatsApp
            </DialogTitle>
          </DialogHeader>
          {selectedCatalogue && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl">
                <FileText className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">{selectedCatalogue.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCatalogue.originalFilename}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="send-phone">Número de WhatsApp *</Label>
                <Input
                  id="send-phone"
                  placeholder="ej. 593987654321"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Incluye el código de país (593 para Ecuador)
                </p>
              </div>
              <div>
                <Label htmlFor="send-caption">Mensaje (opcional)</Label>
                <Textarea
                  id="send-caption"
                  placeholder="Mensaje que acompañará el archivo..."
                  value={sendCaption}
                  onChange={(e) => setSendCaption(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSendOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => sendMutation.mutate({ catalogue: selectedCatalogue, phone: sendPhone, caption: sendCaption })}
                  disabled={!sendPhone.trim() || sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El archivo será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
