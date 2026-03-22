import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { whatsappTemplatesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/templates
router.get("/", async (_req, res) => {
  try {
    const templates = await db
      .select()
      .from(whatsappTemplatesTable)
      .orderBy(desc(whatsappTemplatesTable.createdAt));
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// POST /api/templates
router.post("/", async (req, res) => {
  try {
    const { name, category = "utility", language = "es", content } = req.body;
    if (!name?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "name and content are required" });
    }
    const [created] = await db
      .insert(whatsappTemplatesTable)
      .values({ name: name.trim(), category, language, content: content.trim() })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create template" });
  }
});

// PATCH /api/templates/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { name, category, language, content, isActive } = req.body;
    const setValues: Partial<typeof whatsappTemplatesTable.$inferInsert & { updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) setValues.name = String(name).trim();
    if (category !== undefined) setValues.category = String(category);
    if (language !== undefined) setValues.language = String(language);
    if (content !== undefined) setValues.content = String(content).trim();
    if (isActive !== undefined) setValues.isActive = Boolean(isActive);
    const [updated] = await db
      .update(whatsappTemplatesTable)
      .set(setValues)
      .where(eq(whatsappTemplatesTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update template" });
  }
});

// DELETE /api/templates/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await db.delete(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
