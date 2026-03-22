import type { Request, Response, NextFunction } from "express";
import type { User } from "@workspace/db/schema";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ error: "No autenticado", code: "UNAUTHENTICATED" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User | undefined;
  if (!user) return res.status(401).json({ error: "No autenticado", code: "UNAUTHENTICATED" });
  if (user.role !== "admin") return res.status(403).json({ error: "Se requieren permisos de administrador", code: "FORBIDDEN" });
  next();
}
