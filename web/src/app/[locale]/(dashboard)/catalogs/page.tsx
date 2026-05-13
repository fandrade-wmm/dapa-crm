'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { catalogsApi, type Catalog } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  Trash2,
  Upload,
  FileText,
  Loader2,
  Plus,
  ExternalLink,
  Pencil,
  X,
  Check,
} from 'lucide-react';

function UploadDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createMutation = useMutation({
    mutationFn: catalogsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast({ title: 'Catálogo agregado', description: `"${name}" fue guardado correctamente.` });
      onClose();
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;
    if (!user) {
      toast({ title: 'Sesión expirada', description: 'Recarga la página e inicia sesión nuevamente.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const path = `catalogs/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      setProgress(100);
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      const fileUrl = urlData.publicUrl;
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        fileUrl,
        fileName: file.name,
      });
    } catch (err) {
      const msg = (err as Error & { code?: string }).code
        ? `Error de almacenamiento: ${(err as Error & { code?: string }).code} — ${(err as Error).message}`
        : (err as Error).message;
      toast({ title: 'Error al subir', description: msg, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo catálogo</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Nombre *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Catálogo Verano 2025"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descripción</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional..."
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Archivo PDF *</label>
            <input
              id="catalog-file-input"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!name) setName(f.name.replace(/\.pdf$/i, ''));
                }
              }}
            />
            <label
              htmlFor="catalog-file-input"
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors block',
                file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Haz clic para seleccionar un PDF</p>
                </div>
              )}
            </label>
          </div>

          {progress !== null && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!file || !name.trim() || isUploading}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Subir catálogo
          </Button>
        </div>
      </Card>
    </div>
  );
}

function CatalogRow({ catalog }: { catalog: Catalog }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(catalog.name);
  const [editDesc, setEditDesc] = useState(catalog.description ?? '');

  const deleteMutation = useMutation({
    mutationFn: () => catalogsApi.delete(catalog.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast({ title: 'Eliminado', description: `"${catalog.name}" fue eliminado.` });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: () => catalogsApi.update(catalog.id, { name: editName, description: editDesc || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      setEditing(false);
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="flex items-center gap-4 p-4 group">
      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-rose-600" />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descripción..."
              className="h-7 text-xs"
            />
          </div>
        ) : (
          <>
            <p className="font-medium text-sm truncate">{catalog.name}</p>
            {catalog.description && (
              <p className="text-xs text-muted-foreground truncate">{catalog.description}</p>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{catalog.fileName}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-emerald-600"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 opacity-0 group-hover:opacity-100"
              onClick={() => window.open(catalog.fileUrl, '_blank')}
              title="Ver PDF"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 opacity-0 group-hover:opacity-100"
              onClick={() => { setEditing(true); setEditName(catalog.name); setEditDesc(catalog.description ?? ''); }}
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-destructive opacity-0 group-hover:opacity-100"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              title="Eliminar"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CatalogsPage() {
  const [showUpload, setShowUpload] = useState(false);

  const { data: catalogs = [], isLoading, error } = useQuery({
    queryKey: ['catalogs'],
    queryFn: () => catalogsApi.getAll(),
  });

  return (
    <div className="space-y-5">
      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogos</h1>
          <p className="text-muted-foreground">
            Sube y gestiona tus catálogos PDF para enviarlos directamente en conversaciones
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Nuevo catálogo
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive text-sm">
            Error al cargar catálogos.
          </div>
        ) : catalogs.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">Sin catálogos todavía</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sube tu primer catálogo PDF para poder enviarlo a tus clientes.
            </p>
            <Button onClick={() => setShowUpload(true)} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Subir catálogo
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {catalogs.map((cat) => (
              <CatalogRow key={cat.id} catalog={cat} />
            ))}
          </div>
        )}
      </Card>

      {catalogs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {catalogs.length} catálogo{catalogs.length !== 1 ? 's' : ''} — haz clic en el ícono de enlace para previsualizar
        </p>
      )}
    </div>
  );
}
