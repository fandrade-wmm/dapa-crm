import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  MessageCircle, 
  Package, 
  Settings, 
  Menu,
  X,
  Kanban,
  BookOpen,
  Zap,
  MessageSquarePlus,
  Users,
  LogOut,
  ChevronDown,
  BrainCircuit,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type UserPermissions } from "@/hooks/useAuth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: keyof UserPermissions;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Panel Principal", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversaciones", icon: MessageCircle, permission: "conversations" },
  { href: "/products", label: "Productos", icon: Package, permission: "products" },
  { href: "/crm", label: "CRM", icon: Kanban, permission: "crm" },
  { href: "/catalogues", label: "Catálogos", icon: BookOpen, permission: "catalogues" },
  { href: "/automations", label: "Automatizaciones", icon: Zap, permission: "automations" },
  { href: "/quick-responses", label: "Respuestas Rápidas", icon: MessageSquarePlus, permission: "quickResponses" },
  { href: "/templates", label: "Plantillas WA", icon: LayoutTemplate, permission: "conversations" },
  { href: "/team", label: "Equipo", icon: Users, adminOnly: true },
  { href: "/settings", label: "Configuración", icon: Settings, permission: "settings" },
];

function avatarInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAdmin, hasPermission, logout } = useAuth();

  const { data: stats } = useQuery<{ totalUnread: number }>({
    queryKey: ["layout-stats"],
    queryFn: async () => {
      const res = await fetch(`${API}/stats`, { credentials: "include" });
      if (!res.ok) return { totalUnread: 0 };
      return res.json();
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
  const totalUnread = stats?.totalUnread ?? 0;

  // Filter nav items based on permissions
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (!item.permission) return true; // Panel Principal always shown
    return hasPermission(item.permission);
  });

  return (
    <div className="min-h-screen bg-background flex w-full overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src="/dapa-home-logo.jpg"
              alt="DAPA Home"
              className="h-12 w-auto object-contain"
            />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap border-l border-border pl-3">Asistente IA</span>
          </div>
          <button 
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-8 flex flex-col gap-1.5 overflow-y-auto">
          <p className="px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">Menú Principal</p>
          {visibleNav.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            const showBadge = item.href === "/conversations" && totalUnread > 0;
            return (
              <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                <span className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group cursor-pointer font-medium",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110 text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className={cn(
                      "ml-auto text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center",
                      isActive ? "bg-white/30 text-white" : "bg-rose-500 text-white"
                    )}>
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
        
        {/* User menu at bottom */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(p => !p)}
              className="w-full flex items-center gap-3 bg-white p-3 rounded-xl border border-border shadow-sm hover:bg-slate-50 transition-colors"
            >
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden",
                user?.role === "admin" ? "bg-primary" : "bg-slate-500"
              )}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  avatarInitials(user?.name || "U")
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-foreground truncate">{user?.name || "Usuario"}</p>
                <p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrador" : "Agente"}</p>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", showUserMenu && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-10"
                >
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-white/80 backdrop-blur-md lg:hidden z-30 sticky top-0">
          <div className="flex items-center gap-2">
            <img src="/dapa-home-logo.jpg" alt="DAPA Home" className="h-8 w-auto object-contain" />
          </div>
          <button 
            className="p-2 -mr-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.02] pointer-events-none mix-blend-multiply"></div>
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
