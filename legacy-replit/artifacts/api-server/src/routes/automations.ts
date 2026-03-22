import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { automationWorkflowsTable, automationStepsTable, cataloguesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/automations — list all workflows with their steps
router.get("/", async (_req: Request, res: Response) => {
  try {
    const workflows = await db
      .select()
      .from(automationWorkflowsTable)
      .orderBy(asc(automationWorkflowsTable.sortOrder), asc(automationWorkflowsTable.createdAt));

    const steps = await db
      .select()
      .from(automationStepsTable)
      .orderBy(asc(automationStepsTable.workflowId), asc(automationStepsTable.stepOrder));

    const catalogues = await db.select().from(cataloguesTable);

    const result = workflows.map((w) => ({
      ...w,
      steps: steps.filter((s) => s.workflowId === w.id),
    }));

    res.json({ workflows: result, catalogues });
  } catch (err) {
    console.error("Error fetching automations:", err);
    res.status(500).json({ error: "Error al obtener automatizaciones" });
  }
});

// POST /api/automations — create a new workflow
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, triggerType, triggerKeywords, active, stopAi } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "El nombre es requerido" });
      return;
    }

    const [workflow] = await db
      .insert(automationWorkflowsTable)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        triggerType: triggerType || "keyword",
        triggerKeywords: triggerKeywords?.trim() || null,
        active: active !== false,
        stopAi: stopAi !== false,
      })
      .returning();

    res.json({ workflow: { ...workflow, steps: [] } });
  } catch (err) {
    console.error("Error creating automation:", err);
    res.status(500).json({ error: "Error al crear automatización" });
  }
});

// PUT /api/automations/:id — update workflow metadata
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, triggerType, triggerKeywords, active, stopAi } = req.body;

    const [updated] = await db
      .update(automationWorkflowsTable)
      .set({
        name: name?.trim(),
        description: description?.trim() || null,
        triggerType,
        triggerKeywords: triggerKeywords?.trim() || null,
        active,
        stopAi,
        updatedAt: new Date(),
      })
      .where(eq(automationWorkflowsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "No encontrado" }); return; }
    res.json({ workflow: updated });
  } catch (err) {
    console.error("Error updating automation:", err);
    res.status(500).json({ error: "Error al actualizar automatización" });
  }
});

// PATCH /api/automations/:id/toggle — toggle active
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { active } = req.body;

    const [updated] = await db
      .update(automationWorkflowsTable)
      .set({ active: Boolean(active), updatedAt: new Date() })
      .where(eq(automationWorkflowsTable.id, id))
      .returning();

    res.json({ workflow: updated });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar estado" });
  }
});

// DELETE /api/automations/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    // Delete steps first
    await db.delete(automationStepsTable).where(eq(automationStepsTable.workflowId, id));
    await db.delete(automationWorkflowsTable).where(eq(automationWorkflowsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar automatización" });
  }
});

// POST /api/automations/:id/steps — add a step
router.post("/:id/steps", async (req: Request, res: Response) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { stepType, textContent, mediaUrl, mediaCaption, catalogueId, stepOrder } = req.body;

    const [step] = await db
      .insert(automationStepsTable)
      .values({
        workflowId,
        stepType,
        textContent: textContent || null,
        mediaUrl: mediaUrl || null,
        mediaCaption: mediaCaption || null,
        catalogueId: catalogueId || null,
        stepOrder: stepOrder ?? 0,
      })
      .returning();

    res.json({ step });
  } catch (err) {
    console.error("Error adding step:", err);
    res.status(500).json({ error: "Error al agregar paso" });
  }
});

// PUT /api/automations/:id/steps/:stepId — update a step
router.put("/:id/steps/:stepId", async (req: Request, res: Response) => {
  try {
    const stepId = parseInt(req.params.stepId);
    const { stepType, textContent, mediaUrl, mediaCaption, catalogueId, stepOrder } = req.body;

    const [updated] = await db
      .update(automationStepsTable)
      .set({ stepType, textContent: textContent || null, mediaUrl: mediaUrl || null, mediaCaption: mediaCaption || null, catalogueId: catalogueId || null, stepOrder })
      .where(eq(automationStepsTable.id, stepId))
      .returning();

    res.json({ step: updated });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar paso" });
  }
});

// DELETE /api/automations/:id/steps/:stepId
router.delete("/:id/steps/:stepId", async (req: Request, res: Response) => {
  try {
    const stepId = parseInt(req.params.stepId);
    await db.delete(automationStepsTable).where(eq(automationStepsTable.id, stepId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar paso" });
  }
});

export default router;
