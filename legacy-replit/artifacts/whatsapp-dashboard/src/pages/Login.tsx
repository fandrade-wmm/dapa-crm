import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Mail, Lock, Shield, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Mode = "login" | "setup";

export default function Login() {
  const { user, login, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("login");
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  // Check if first-time setup needed
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${API}/auth/status`, { credentials: "include" });
        const data = await res.json();
        setGoogleEnabled(data.googleEnabled || false);

        // If not authenticated, check if any users exist (setup mode)
        const setupRes = await fetch(`${API}/auth/me`, { credentials: "include" });
        if (!setupRes.ok) {
          // Check if we need setup by trying to see status
          // We'll detect setup need differently — try login with known empty creds
          // Instead, we'll detect via a different signal: the /auth/setup endpoint
        }
      } catch {}
      setIsCheckingSetup(false);
    }
    check();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
      // User state is already set by login(), navigate directly
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al configurar");
      toast({ title: "¡Bienvenido! Cuenta de administrador creada." });
      await refetch();
      setLocation("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = `${API}/auth/google`;
  }

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14 relative z-10">
        <div className="flex items-center gap-3">
          <img src="/dapa-home-logo.jpg" alt="DAPA Home" className="h-10 w-auto rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-white/70 text-sm font-medium border-l border-white/20 pl-3">Asistente IA</span>
        </div>

        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Gestión inteligente<br />para tu negocio
            </h1>
            <p className="text-white/60 text-lg max-w-md leading-relaxed">
              Panel de control para tu asistente WhatsApp con IA. Responde clientes, gestiona productos y automatiza tu atención.
            </p>
          </motion.div>

          <div className="flex flex-col gap-3 mt-10">
            {[
              "Respuestas automáticas con IA en tiempo real",
              "Catálogo de productos sincronizado con Odoo",
              "CRM y gestión de leads integrada",
              "Automatizaciones y respuestas rápidas",
            ].map((text, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                <span className="text-white/70 text-sm">{text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">© 2026 DAPA Home. Todos los derechos reservados.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-8 sm:p-10">
            {/* Mobile logo */}
            <div className="flex lg:hidden justify-center mb-8">
              <img src="/dapa-home-logo.jpg" alt="DAPA Home" className="h-12 w-auto rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {mode === "setup" ? "Configurar administrador" : "Iniciar sesión"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {mode === "setup"
                  ? "Crea la cuenta de administrador principal"
                  : "Accede al panel de gestión de DAPA Home"}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={mode === "setup" ? handleSetup : handleLogin} className="space-y-4">
              {mode === "setup" && (
                <div>
                  <Label>Nombre completo</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej. María García"
                    required
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label>Correo electrónico</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@empresa.com"
                    required
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label>Contraseña {mode === "setup" && <span className="text-muted-foreground text-xs">(mínimo 8 caracteres)</span>}</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-10 pr-10"
                    autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 text-base font-semibold mt-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === "setup" ? "Crear cuenta" : "Iniciar sesión"}
              </Button>
            </form>

            {googleEnabled && mode === "login" && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="px-3 bg-white text-xs text-muted-foreground">o continúa con</span></div>
                </div>
                <Button variant="outline" className="w-full h-11 gap-3 font-medium" onClick={handleGoogleLogin}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </Button>
              </>
            )}

            {mode === "login" && (
              <div className="mt-6 pt-5 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  ¿Primera vez?{" "}
                  <button onClick={() => { setMode("setup"); setError(""); }} className="text-primary font-semibold hover:underline">
                    Configurar cuenta de administrador
                  </button>
                </p>
              </div>
            )}

            {mode === "setup" && (
              <div className="mt-5 pt-4 border-t border-border text-center">
                <button onClick={() => { setMode("login"); setError(""); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ← Volver al inicio de sesión
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-white/30 text-xs mt-6">
            Panel seguro — acceso solo para personal autorizado
          </p>
        </motion.div>
      </div>
    </div>
  );
}
