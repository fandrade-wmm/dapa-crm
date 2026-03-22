import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { crmLeadsTable, CRM_STAGES } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/crm/leads
router.get("/leads", async (req, res) => {
  try {
    const leads = await db
      .select()
      .from(crmLeadsTable)
      .orderBy(asc(crmLeadsTable.createdAt));
    res.json({ leads });
  } catch (err) {
    console.error("Error fetching CRM leads:", err);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// POST /api/crm/leads
router.post("/leads", async (req, res) => {
  try {
    const { name, phone, email, stage, notes, value, source } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const stageValue = CRM_STAGES.includes(stage) ? stage : "nuevos";
    const inserted = await db
      .insert(crmLeadsTable)
      .values({
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        stage: stageValue,
        notes: notes || null,
        value: value ? String(value) : null,
        source: source || null,
      })
      .returning();
    res.status(201).json({ lead: inserted[0] });
  } catch (err) {
    console.error("Error creating CRM lead:", err);
    res.status(500).json({ error: "Failed to create lead" });
  }
});

// PATCH /api/crm/leads/:id
router.patch("/leads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const { name, phone, email, stage, notes, value, source } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email || null;
    if (stage !== undefined && CRM_STAGES.includes(stage)) updateData.stage = stage;
    if (notes !== undefined) updateData.notes = notes || null;
    if (value !== undefined) updateData.value = value ? String(value) : null;
    if (source !== undefined) updateData.source = source || null;

    const updated = await db
      .update(crmLeadsTable)
      .set(updateData)
      .where(eq(crmLeadsTable.id, id))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: "Lead not found" });
    res.json({ lead: updated[0] });
  } catch (err) {
    console.error("Error updating CRM lead:", err);
    res.status(500).json({ error: "Failed to update lead" });
  }
});

// DELETE /api/crm/leads/:id
router.delete("/leads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const deleted = await db
      .delete(crmLeadsTable)
      .where(eq(crmLeadsTable.id, id))
      .returning();

    if (!deleted[0]) return res.status(404).json({ error: "Lead not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting CRM lead:", err);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

export default router;
