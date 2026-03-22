import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export default function AcceptInvite() {
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [inviteInfo, setInviteInfo] = useState<{ email: string; name: string } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [isValidating, setIsValidating] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!token) { setInviteError("Token de invitación no encontrado"); setIsValidating(false); return; }
      try {
        const res = await fetch(`${API}/auth/invite/${token}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) { setInviteError(data.error || "Invitación inválida"); }
        else { setInviteInfo({ email: data.email, name: data.name }); }
      } catch { setInviteError("Error al validar la invitación"); }
      setIsValidating(false);
    }
    validate();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
      await refetch();
      setTimeout(() => setLocation("/"), 2000);
    } catch (err: any) {
      setError(err.message || "Error al activar la cuenta");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <img src="/dapa-home-logo.jpg" alt="DAPA Home" className="h-12 w-auto rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>

          {isValidating ? (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validando invitación...</p>
            </div>
          ) : inviteError ? (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Invitación inválida</h3>
                <p className="text-sm text-muted-foreground">{inviteError}</p>
              </div>
              <Button variant="outline" onClick={() => setLocation("/login")}>Ir al inicio de sesión</Button>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">¡Cuenta activada!</h3>
                <p className="text-sm text-muted-foreground">Redirigiendo al panel...</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-1">Activa tu cuenta</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Bienvenido/a, <strong>{inviteInfo?.name}</strong>. Eres parte del equipo de DAPA Home como agente.
                <br />Crea tu contraseña para acceder al panel.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Correo electrónico</Label>
                  <Input value={inviteInfo?.email || ""} disabled className="mt-1.5 bg-muted" />
                </div>
                <div>
                  <Label>Contraseña <span className="text-muted-foreground text-xs">(mínimo 8 caracteres)</span></Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Confirmar contraseña</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full h-11 font-semibold mt-2">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Activar cuenta y entrar"}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
