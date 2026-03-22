import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import passport from "../auth/passport.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, ALL_PERMISSIONS, DEFAULT_AGENT_PERMISSIONS } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../auth/middleware.js";

const router: IRouter = Router();
const GOOGLE_ENABLED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// GET /api/auth/me
router.get("/me", (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "No autenticado", code: "UNAUTHENTICATED" });
  }
  const u = req.user as any;
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    role: u.role,
    permissions: u.permissions,
    isActive: u.isActive,
    googleEnabled: GOOGLE_ENABLED,
  });
});

// GET /api/auth/status — quick check without full user (for polling)
router.get("/status", (req: Request, res: Response) => {
  res.json({ authenticated: req.isAuthenticated ? req.isAuthenticated() : false, googleEnabled: GOOGLE_ENABLED });
});

// POST /api/auth/setup — creates first admin (only when no users exist)
router.post("/setup", async (req: Request, res: Response) => {
  try {
    const count = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (count.length > 0) {
      return res.status(400).json({ error: "Ya existe un administrador configurado" });
    }
    const { email, name, password } = req.body;
    if (!email || !name || !password || password.length < 8) {
      return res.status(400).json({ error: "Datos incompletos. La contraseña debe tener al menos 8 caracteres." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash,
      role: "admin",
      permissions: ALL_PERMISSIONS,
      isActive: true,
    }).returning();

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Error al iniciar sesión" });
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions });
    });
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Este correo ya está registrado" });
    res.status(500).json({ error: "Error al configurar administrador" });
  }
});

// POST /api/auth/login — email + password
router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: Error | null, user: any, info: { message: string }) => {
    if (err) return res.status(500).json({ error: "Error del servidor" });
    if (!user) return res.status(401).json({ error: info?.message || "Credenciales incorrectas" });
    req.login(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ error: "Error al iniciar sesión" });
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions, avatarUrl: user.avatarUrl });
    });
  })(req, res, next);
});

// POST /api/auth/logout
router.post("/logout", (req: Request, res: Response) => {
  req.logout(() => {
    req.session?.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
});

// Google OAuth
router.get("/google", (req: Request, res: Response, next: NextFunction) => {
  if (!GOOGLE_ENABLED) return res.status(400).json({ error: "Google OAuth no configurado" });
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req: Request, res: Response, next: NextFunction) => {
  if (!GOOGLE_ENABLED) return res.redirect("/?error=google_not_configured");
  passport.authenticate("google", (err: Error | null, user: any) => {
    if (err || !user) {
      return res.redirect("/?error=google_auth_failed");
    }
    req.login(user, (loginErr) => {
      if (loginErr) return res.redirect("/?error=login_failed");
      res.redirect("/");
    });
  })(req, res, next);
});

// POST /api/auth/invite — admin creates agent invite
router.post("/invite", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, name, permissions } = req.body;
    if (!email || !name) return res.status(400).json({ error: "Email y nombre son requeridos" });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Check if user already exists
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing) return res.status(400).json({ error: "Este correo ya tiene una cuenta" });

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: "agent",
      permissions: permissions || DEFAULT_AGENT_PERMISSIONS,
      isActive: false, // Activates when they set password
      inviteToken: token,
      inviteExpires: expires,
    }).returning();

    // Build invite URL from the request's actual host so it matches where the admin is working
    const proto = req.get("x-forwarded-proto") || "https";
    const host = req.get("x-forwarded-host") || req.get("host") || process.env.REPLIT_DEV_DOMAIN || "localhost";
    const inviteUrl = `${proto}://${host}/accept-invite?token=${token}`;

    res.json({ id: user.id, email: user.email, name: user.name, inviteUrl, inviteToken: token });
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Este correo ya está registrado" });
    res.status(500).json({ error: "Error al crear invitación" });
  }
});

// GET /api/auth/invite/:token — validate invite token
router.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.inviteToken, token)).limit(1);
    if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
      return res.status(400).json({ error: "Invitación inválida o expirada" });
    }
    res.json({ email: user.email, name: user.name, valid: true });
  } catch {
    res.status(500).json({ error: "Error al validar invitación" });
  }
});

// POST /api/auth/accept-invite — set password from invite
router.post("/accept-invite", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8) {
      return res.status(400).json({ error: "Token y contraseña (mínimo 8 caracteres) son requeridos" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.inviteToken, token)).limit(1);
    if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
      return res.status(400).json({ error: "Invitación inválida o expirada" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [updated] = await db.update(usersTable)
      .set({ passwordHash, isActive: true, inviteToken: null, inviteExpires: null, lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id))
      .returning();

    req.login(updated, (err) => {
      if (err) return res.status(500).json({ error: "Error al iniciar sesión" });
      res.json({ id: updated.id, email: updated.email, name: updated.name, role: updated.role, permissions: updated.permissions });
    });
  } catch {
    res.status(500).json({ error: "Error al aceptar invitación" });
  }
});

export default router;
