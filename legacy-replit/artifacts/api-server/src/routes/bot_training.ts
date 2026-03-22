import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botConfigTable, botQaPairsTable, whatsappConversationsTable, DEFAULT_BUSINESS_HOURS, type BusinessHours } from "@workspace/db/schema";
import { eq, asc, count, gte } from "drizzle-orm";
import { testOdooConnection } from "../lib/odoo.js";
import { generateBotResponse } from "../lib/botAi.js";
import { TestBotBody } from "@workspace/api-zod";

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

const router: IRouter = Router();

// GET /api/bot/training — fetch config + all Q&A pairs
router.get("/training", async (_req, res) => {
  try {
    const configs = await db.select().from(botConfigTable).limit(1);
    const qaPairs = await db
      .select()
      .from(botQaPairsTable)
      .orderBy(asc(botQaPairsTable.sortOrder), asc(botQaPairsTable.createdAt));

    const config = configs[0] ?? { id: null, customInstructions: "", botEnabled: true, updatedAt: null };
    res.json({ config, qaPairs });
  } catch (err) {
    console.error("Error fetching training data:", err);
    res.status(500).json({ error: "Failed to fetch training data" });
  }
});

// GET /api/bot/enabled — get current bot enabled state
router.get("/enabled", async (_req, res) => {
  try {
    const configs = await db.select().from(botConfigTable).limit(1);
    const botEnabled = configs[0]?.botEnabled ?? true;
    res.json({ botEnabled });
  } catch (err) {
    res.status(500).json({ error: "Failed to get bot state" });
  }
});

// POST /api/bot/toggle — toggle AI replies on/off
router.post("/toggle", async (req, res) => {
  try {
    const { botEnabled } = req.body;
    if (typeof botEnabled !== "boolean") {
      return res.status(400).json({ error: "botEnabled must be a boolean" });
    }

    const existing = await db.select().from(botConfigTable).limit(1);
    if (existing[0]) {
      await db
        .update(botConfigTable)
        .set({ botEnabled, updatedAt: new Date() })
        .where(eq(botConfigTable.id, existing[0].id));
    } else {
      await db.insert(botConfigTable).values({ botEnabled });
    }

    res.json({ success: true, botEnabled });
  } catch (err) {
    console.error("Error toggling bot:", err);
    res.status(500).json({ error: "Failed to toggle bot" });
  }
});

// PUT /api/bot/training/config — save custom instructions
router.put("/training/config", async (req, res) => {
  try {
    const { customInstructions } = req.body;
    const existing = await db.select().from(botConfigTable).limit(1);

    if (existing[0]) {
      await db
        .update(botConfigTable)
        .set({ customInstructions: customInstructions ?? "", updatedAt: new Date() })
        .where(eq(botConfigTable.id, existing[0].id));
    } else {
      await db.insert(botConfigTable).values({ customInstructions: customInstructions ?? "" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving bot config:", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

// POST /api/bot/training/qa — add new Q&A pair
router.post("/training/qa", async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ error: "Question and answer are required" });
    }
    const inserted = await db
      .insert(botQaPairsTable)
      .values({ question: question.trim(), answer: answer.trim() })
      .returning();
    res.status(201).json({ qaPair: inserted[0] });
  } catch (err) {
    console.error("Error creating Q&A pair:", err);
    res.status(500).json({ error: "Failed to create Q&A pair" });
  }
});

// PATCH /api/bot/training/qa/:id — update a Q&A pair
router.patch("/training/qa/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const { question, answer, active } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (question !== undefined) updateData.question = question.trim();
    if (answer !== undefined) updateData.answer = answer.trim();
    if (active !== undefined) updateData.active = Boolean(active);

    const updated = await db
      .update(botQaPairsTable)
      .set(updateData)
      .where(eq(botQaPairsTable.id, id))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: "Q&A pair not found" });
    res.json({ qaPair: updated[0] });
  } catch (err) {
    console.error("Error updating Q&A pair:", err);
    res.status(500).json({ error: "Failed to update Q&A pair" });
  }
});

// DELETE /api/bot/training/qa/:id
router.delete("/training/qa/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const deleted = await db
      .delete(botQaPairsTable)
      .where(eq(botQaPairsTable.id, id))
      .returning();

    if (!deleted[0]) return res.status(404).json({ error: "Q&A pair not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting Q&A pair:", err);
    res.status(500).json({ error: "Failed to delete Q&A pair" });
  }
});

// GET /api/bot/status — dashboard status card data
router.get("/status", async (req, res) => {
  try {
    const odooConnected = await testOdooConnection();

    const totalResult = await db
      .select({ count: count() })
      .from(whatsappConversationsTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayResult = await db
      .select({ count: count() })
      .from(whatsappConversationsTable)
      .where(gte(whatsappConversationsTable.createdAt, today));

    const host = req.get("host") || "localhost";
    const proto = req.get("x-forwarded-proto") || "https";
    const webhookUrl = `${proto}://${host}/api/whatsapp/webhook`;

    const configs = await db.select().from(botConfigTable).limit(1);
    const botEnabled = configs[0]?.botEnabled ?? true;

    res.json({
      whatsappConfigured: !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
      odooConnected,
      totalConversations: totalResult[0]?.count ?? 0,
      todayConversations: todayResult[0]?.count ?? 0,
      webhookUrl,
      botEnabled,
    });
  } catch (err) {
    console.error("Error getting bot status:", err);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// POST /api/bot/test — test AI response
router.post("/test", async (req, res) => {
  try {
    const parsed = TestBotBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }
    const { response, productsFound, productImages } = await generateBotResponse(parsed.data.message);
    res.json({ response, productsFound, productImages });
  } catch (err) {
    console.error("Error testing bot:", err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// GET /api/bot/hours — get business hours config
router.get("/hours", async (_req, res) => {
  try {
    const configs = await db.select().from(botConfigTable).limit(1);
    const config = configs[0];
    res.json({
      enabled: config?.businessHoursEnabled ?? false,
      hours: (config?.businessHours as BusinessHours) || DEFAULT_BUSINESS_HOURS,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get business hours" });
  }
});

// PUT /api/bot/hours — save business hours config
router.put("/hours", async (req, res) => {
  try {
    const { enabled, hours } = req.body;
    const existing = await db.select().from(botConfigTable).limit(1);
    if (existing[0]) {
      await db
        .update(botConfigTable)
        .set({
          businessHoursEnabled: Boolean(enabled),
          businessHours: hours || DEFAULT_BUSINESS_HOURS,
          updatedAt: new Date(),
        })
        .where(eq(botConfigTable.id, existing[0].id));
    } else {
      await db.insert(botConfigTable).values({
        businessHoursEnabled: Boolean(enabled),
        businessHours: hours || DEFAULT_BUSINESS_HOURS,
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save business hours" });
  }
});

export default router;
