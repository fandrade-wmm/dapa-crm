import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  whatsappConversationsTable,
  whatsappMessagesTable,
  botConfigTable,
  automationWorkflowsTable,
  automationStepsTable,
  cataloguesTable,
} from "@workspace/db/schema";
import { eq, desc, count, gte, asc, sql } from "drizzle-orm";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from "@workspace/db/schema";
import { generateBotResponse } from "../lib/botAi.js";
import { testOdooConnection } from "../lib/odoo.js";
import { TestBotBody } from "@workspace/api-zod";

const router: IRouter = Router();

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "dapahome_verify_token";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

// GET /api/whatsapp/webhook - Meta verification
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    console.log("WhatsApp webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});

// POST /api/whatsapp/webhook - Receive messages
router.post("/webhook", async (req, res) => {
  res.status(200).send("OK"); // Always respond 200 immediately to WhatsApp

  try {
    const body = req.body;
    if (body?.object !== "whatsapp_business_account") return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    if (msg.type !== "text") return;

    const customerPhone = msg.from;
    const customerText = msg.text?.body;
    if (!customerText) return;

    // Find or create conversation
    let conversation = await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.customerPhone, customerPhone))
      .orderBy(desc(whatsappConversationsTable.updatedAt))
      .limit(1);

    let conversationId: number;

    if (!conversation[0]) {
      const contactName = value?.contacts?.[0]?.profile?.name || null;
      const inserted = await db
        .insert(whatsappConversationsTable)
        .values({ customerPhone, customerName: contactName })
        .returning();
      conversationId = inserted[0].id;
    } else {
      conversationId = conversation[0].id;
    }

    // Get recent messages for context
    const recentMessages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.conversationId, conversationId))
      .orderBy(desc(whatsappMessagesTable.createdAt))
      .limit(10);

    const history = recentMessages
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Store user message
    await db.insert(whatsappMessagesTable).values({
      conversationId,
      role: "user",
      content: customerText,
    });

    // Increment unread count
    await db
      .update(whatsappConversationsTable)
      .set({ unreadCount: sql`${whatsappConversationsTable.unreadCount} + 1` })
      .where(eq(whatsappConversationsTable.id, conversationId));

    // Count how many messages this customer has sent (to detect first message)
    const messageCount = await db
      .select({ count: count() })
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.conversationId, conversationId));
    const isFirstMessage = (messageCount[0]?.count ?? 0) <= 1;

    // Load active automations and their steps
    const automations = await db
      .select()
      .from(automationWorkflowsTable)
      .where(eq(automationWorkflowsTable.active, true))
      .orderBy(asc(automationWorkflowsTable.sortOrder), asc(automationWorkflowsTable.createdAt));

    const allSteps = automations.length > 0
      ? await db.select().from(automationStepsTable).orderBy(asc(automationStepsTable.stepOrder))
      : [];

    const cataloguesList = await db.select().from(cataloguesTable);

    // Find first matching automation
    const textLower = customerText.toLowerCase();
    let matchedAutomation = automations.find((a) => {
      if (a.triggerType === "any") return true;
      if (a.triggerType === "first_message") return isFirstMessage;
      if (a.triggerType === "keyword" && a.triggerKeywords) {
        const keywords = a.triggerKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
        return keywords.some((kw) => textLower.includes(kw));
      }
      return false;
    });

    if (matchedAutomation) {
      const steps = allSteps.filter((s) => s.workflowId === matchedAutomation!.id);

      if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
        for (const step of steps) {
          if (step.stepType === "text" && step.textContent) {
            await sendWhatsAppMessage(customerPhone, step.textContent);
          } else if (step.stepType === "image" && step.mediaUrl) {
            await sendWhatsAppImage(customerPhone, step.mediaUrl, step.mediaCaption || "");
          } else if (step.stepType === "video" && step.mediaUrl) {
            await sendWhatsAppVideo(customerPhone, step.mediaUrl, step.mediaCaption || "");
          } else if (step.stepType === "catalogue" && step.catalogueId) {
            const catalogue = cataloguesList.find((c) => c.id === step.catalogueId);
            if (catalogue) {
              const host = process.env.REPLIT_DEV_DOMAIN
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : "http://localhost:8080";
              const fileUrl = `${host}/api/storage${catalogue.objectPath}`;
              await sendWhatsAppDocument(
                customerPhone,
                fileUrl,
                catalogue.originalFilename,
                step.mediaCaption || `Catálogo: ${catalogue.name}`
              );
            }
          }
        }
      }

      // Store automation reply summary in conversation
      const stepSummary = steps.map((s) => {
        if (s.stepType === "text") return s.textContent || "[texto]";
        if (s.stepType === "catalogue") return "[catálogo PDF]";
        return `[${s.stepType}]`;
      }).join(" + ");

      await db.insert(whatsappMessagesTable).values({
        conversationId,
        role: "assistant",
        content: `🤖 Automatización: ${matchedAutomation.name} — ${stepSummary}`,
      });

      await db
        .update(whatsappConversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(whatsappConversationsTable.id, conversationId));

      // If stopAi is true, don't run AI response
      if (matchedAutomation.stopAi) return;
    }

    // Check global bot toggle and per-conversation AI toggle
    const configs = await db.select().from(botConfigTable).limit(1);
    const botEnabled = configs[0]?.botEnabled ?? true;

    // Check business hours
    if (configs[0]?.businessHoursEnabled) {
      const bh: BusinessHours = (configs[0].businessHours as BusinessHours) || DEFAULT_BUSINESS_HOURS;
      const isOpen = isWithinBusinessHours(bh);
      if (!isOpen) {
        // Send closed message and skip AI
        if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
          await sendWhatsAppMessage(customerPhone, bh.closedMessage);
        }
        await db.insert(whatsappMessagesTable).values({
          conversationId,
          role: "assistant",
          content: bh.closedMessage,
          messageType: "text",
        });
        await db
          .update(whatsappConversationsTable)
          .set({ updatedAt: new Date() })
          .where(eq(whatsappConversationsTable.id, conversationId));
        return;
      }
    }

    const freshConv = await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.id, conversationId))
      .limit(1);
    const convAiEnabled = freshConv[0]?.aiEnabled ?? true;

    if (!botEnabled || !convAiEnabled) {
      return;
    }

    // Generate AI response
    const { response, productImages } = await generateBotResponse(customerText, history);

    // Store assistant text response
    await db.insert(whatsappMessagesTable).values({
      conversationId,
      role: "assistant",
      content: response,
      messageType: "text",
    });

    // Store product images as separate image messages in DB
    for (const product of productImages) {
      await db.insert(whatsappMessagesTable).values({
        conversationId,
        role: "assistant",
        content: `${product.name} — $${product.price.toFixed(2)}`,
        messageType: "image",
        mediaUrl: product.imageUrl,
      });
    }

    // Update conversation timestamp
    await db
      .update(whatsappConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(whatsappConversationsTable.id, conversationId));

    // Send response back via WhatsApp API
    if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      await sendWhatsAppMessage(customerPhone, response);
      for (const product of productImages) {
        await sendWhatsAppImage(
          customerPhone,
          product.imageUrl,
          `${product.name} — $${product.price.toFixed(2)}`
        );
      }
    }
  } catch (err) {
    console.error("Error processing WhatsApp message:", err);
  }
});

function isWithinBusinessHours(bh: BusinessHours): boolean {
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: bh.timezone || "America/Guayaquil" }));
  const dayKey = dayNames[now.getDay()];
  const slot = bh.days[dayKey];
  if (!slot.enabled) return false;
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

async function sendWhatsAppMessage(to: string, message: string) {
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });
}

async function sendWhatsAppImage(to: string, imageUrl: string, caption: string) {
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    }),
  });
}

async function sendWhatsAppVideo(to: string, videoUrl: string, caption: string) {
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "video",
      video: { link: videoUrl, caption },
    }),
  });
}

async function sendWhatsAppDocument(to: string, docUrl: string, filename: string, caption: string) {
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { link: docUrl, filename: filename || "catalogo.pdf", caption },
    }),
  });
}

// GET /api/bot/status
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

// POST /api/bot/test
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

// POST /api/whatsapp/send-document — manually send a PDF catalogue to a WhatsApp number
router.post("/send-document", async (req, res) => {
  try {
    const { to, documentUrl, filename, caption } = req.body;
    if (!to || !documentUrl) {
      return res.status(400).json({ error: "Se requieren 'to' y 'documentUrl'" });
    }

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(503).json({ error: "WhatsApp API no configurada. Agrega WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID." });
    }

    const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: {
          link: documentUrl,
          filename: filename || "catalogo.pdf",
          caption: caption || "",
        },
      }),
    });

    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      console.error("WhatsApp API error:", data);
      return res.status(response.status).json({ error: "Error al enviar por WhatsApp", details: data });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error sending WhatsApp document:", err);
    res.status(500).json({ error: "Error interno al enviar documento" });
  }
});

export default router;
