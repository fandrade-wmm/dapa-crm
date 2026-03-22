import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../auth/middleware.js";

const router: IRouter = Router();

// All team routes require admin
router.use(requireAuth, requireAdmin);

// GET /api/team — list all users
router.get("/", async (req: Request, res: Response) => {
  try {
    const currentUser = req.user as any;
    const users = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      permissions: usersTable.permissions,
      isActive: usersTable.isActive,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
      hasPassword: usersTable.passwordHash,
      hasGoogle: usersTable.googleId,
      inviteToken: usersTable.inviteToken,
      inviteExpires: usersTable.inviteExpires,
    }).from(usersTable);

    res.json(users.map(u => ({
      ...u,
      hasPassword: !!u.hasPassword,
      hasGoogle: !!u.hasGoogle,
      isCurrentUser: u.id === currentUser.id,
      isPendingInvite: !u.isActive && !!u.inviteToken,
    })));
  } catch {
    res.status(500).json({ error: "Error al obtener equipo" });
  }
});

// PATCH /api/team/:id/permissions — update permissions
router.patch("/:id/permissions", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const currentUser = req.user as any;
    if (id === currentUser.id) return res.status(400).json({ error: "No puedes modificar tus propios permisos" });

    const { permissions } = req.body;
    const [updated] = await db.update(usersTable)
      .set({ permissions })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ id: updated.id, permissions: updated.permissions });
  } catch {
    res.status(500).json({ error: "Error al actualizar permisos" });
  }
});

// PATCH /api/team/:id/toggle-active — activate/deactivate
router.patch("/:id/toggle-active", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const currentUser = req.user as any;
    if (id === currentUser.id) return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });

    const { isActive } = req.body;
    const [updated] = await db.update(usersTable)
      .set({ isActive: Boolean(isActive) })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch {
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

// DELETE /api/team/:id — remove agent (cannot remove self or other admins)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const currentUser = req.user as any;
    if (id === currentUser.id) return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
    if (target.role === "admin") return res.status(400).json({ error: "No se puede eliminar a un administrador" });

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
