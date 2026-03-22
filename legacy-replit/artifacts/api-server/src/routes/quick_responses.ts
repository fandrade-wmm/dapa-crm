import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { quickResponsesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/quick-responses
router.get("/", async (_req: Request, res: Response) => {
  try {
    const responses = await db
      .select()
      .from(quickResponsesTable)
      .orderBy(asc(quickResponsesTable.sortOrder), asc(quickResponsesTable.createdAt));
    res.json(responses);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener respuestas rápidas" });
  }
});

// POST /api/quick-responses
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, content, category } = req.body;
    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: "Título y contenido son requeridos" });
      return;
    }
    const [created] = await db
      .insert(quickResponsesTable)
      .values({ title: title.trim(), content: content.trim(), category: category?.trim() || null })
      .returning();
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: "Error al crear respuesta rápida" });
  }
});

// PUT /api/quick-responses/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content, category } = req.body;
    const [updated] = await db
      .update(quickResponsesTable)
      .set({ title: title?.trim(), content: content?.trim(), category: category?.trim() || null })
      .where(eq(quickResponsesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "No encontrado" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar respuesta rápida" });
  }
});

// DELETE /api/quick-responses/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(quickResponsesTable).where(eq(quickResponsesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar respuesta rápida" });
  }
});

export default router;
