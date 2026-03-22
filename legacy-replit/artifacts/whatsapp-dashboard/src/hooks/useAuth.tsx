import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export interface UserPermissions {
  conversations: boolean;
  products: boolean;
  crm: boolean;
  catalogues: boolean;
  bot: boolean;
  automations: boolean;
  quickResponses: boolean;
  settings: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "admin" | "agent";
  permissions: UserPermissions;
  googleEnabled: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  hasPermission: (key: keyof UserPermissions) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error al iniciar sesión");
    }
    const data = await res.json();
    setUser({ ...data, googleEnabled: false });
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    setLocation("/login");
  }, [setLocation]);

  const hasPermission = useCallback(
    (key: keyof UserPermissions) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return user.permissions[key] ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAdmin: user?.role === "admin",
      hasPermission,
      login,
      logout,
      refetch: fetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
