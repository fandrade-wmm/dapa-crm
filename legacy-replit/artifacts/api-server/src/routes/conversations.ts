import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  whatsappConversationsTable,
  whatsappMessagesTable,
  cataloguesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, count, ilike, or, sql } from "drizzle-orm";
import { sendInstagramReply } from "../lib/instagramService.js";

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

const router: IRouter = Router();

// GET /api/conversations — supports ?search=, ?label=, ?agentId=, ?channel=
router.get("/", async (req, res) => {
  try {
    const { search, label, agentId, channel } = req.query as Record<string, string>;

    let query = db
      .select()
      .from(whatsappConversationsTable)
      .orderBy(desc(whatsappConversationsTable.updatedAt))
      .$dynamic();

    const filters: ReturnType<typeof ilike>[] = [];

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      const matchingConvIds = await db
        .selectDistinct({ id: whatsappMessagesTable.conversationId })
        .from(whatsappMessagesTable)
        .where(ilike(whatsappMessagesTable.content, term));
      const ids = matchingConvIds.map((r) => r.id);
      // We'll filter after fetching all
    }

    const conversations = await db
      .select()
      .from(whatsappConversationsTable)
      .orderBy(desc(whatsappConversationsTable.updatedAt));

    // Apply in-memory filters (simple + flexible)
    let filtered = conversations;
    if (search?.trim()) {
      const lc = search.trim().toLowerCase();
      // First find conversations that have matching message content
      const matchingConvIds = await db
        .selectDistinct({ id: whatsappMessagesTable.conversationId })
        .from(whatsappMessagesTable)
        .where(ilike(whatsappMessagesTable.content, `%${lc}%`));
      const msgMatchIds = new Set(matchingConvIds.map((r) => r.id));
      filtered = filtered.filter(
        (c) =>
          (c.customerName || "").toLowerCase().includes(lc) ||
          c.customerPhone.toLowerCase().includes(lc) ||
          msgMatchIds.has(c.id)
      );
    }
    if (label?.trim()) {
      filtered = filtered.filter((c) => (c.labels || []).includes(label.trim()));
    }
    if (agentId?.trim()) {
      const aid = parseInt(agentId);
      if (!isNaN(aid)) {
        filtered = filtered.filter((c) => c.assignedAgentId === aid);
      }
    }
    if (channel?.trim() && channel !== "all") {
      filtered = filtered.filter((c) => (c.channel || "whatsapp") === channel.trim());
    }

    const result = await Promise.all(
      filtered.map(async (conv) => {
        const messages = await db
          .select()
          .from(whatsappMessagesTable)
          .where(eq(whatsappMessagesTable.conversationId, conv.id))
          .orderBy(desc(whatsappMessagesTable.createdAt))
          .limit(1);

        const msgCount = await db
          .select({ count: count() })
          .from(whatsappMessagesTable)
          .where(eq(whatsappMessagesTable.conversationId, conv.id));

        let assignedAgent: { id: number; name: string } | null = null;
        if (conv.assignedAgentId) {
          const agent = await db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, conv.assignedAgentId))
            .limit(1);
          assignedAgent = agent[0] || null;
        }

        return {
          id: conv.id,
          customerPhone: conv.customerPhone,
          customerName: conv.customerName || null,
          lastMessage: messages[0]?.content || null,
          lastMessageAt: conv.updatedAt.toISOString(),
          messageCount: msgCount[0]?.count ?? 0,
          status: conv.status,
          aiEnabled: conv.aiEnabled,
          labels: conv.labels || [],
          assignedAgentId: conv.assignedAgentId || null,
          assignedAgent,
          unreadCount: conv.unreadCount || 0,
          channel: conv.channel || "whatsapp",
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET /api/conversations/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const conv = await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.id, id))
      .limit(1);

    if (!conv[0]) return res.status(404).json({ error: "Conversation not found" });

    const messages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.conversationId, id))
      .orderBy(whatsappMessagesTable.createdAt);

    let assignedAgent: { id: number; name: string } | null = null;
    if (conv[0].assignedAgentId) {
      const agent = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, conv[0].assignedAgentId))
        .limit(1);
      assignedAgent = agent[0] || null;
    }

    res.json({
      id: conv[0].id,
      customerPhone: conv[0].customerPhone,
      customerName: conv[0].customerName || null,
      status: conv[0].status,
      aiEnabled: conv[0].aiEnabled,
      labels: conv[0].labels || [],
      assignedAgentId: conv[0].assignedAgentId || null,
      assignedAgent,
      unreadCount: conv[0].unreadCount || 0,
      channel: conv[0].channel || "whatsapp",
      instagramThreadId: conv[0].instagramThreadId || null,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        messageType: m.messageType || "text",
        mediaUrl: m.mediaUrl || null,
        isInternalNote: m.isInternalNote || false,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Error fetching conversation:", err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// PATCH /api/conversations/:id/toggle-ai
router.patch("/:id/toggle-ai", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { aiEnabled } = req.body;
    const [updated] = await db
      .update(whatsappConversationsTable)
      .set({ aiEnabled: Boolean(aiEnabled) })
      .where(eq(whatsappConversationsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ id: updated.id, aiEnabled: updated.aiEnabled });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle AI" });
  }
});

// PATCH /api/conversations/:id/labels
router.patch("/:id/labels", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { labels } = req.body;
    if (!Array.isArray(labels)) return res.status(400).json({ error: "labels must be an array" });
    const [updated] = await db
      .update(whatsappConversationsTable)
      .set({ labels: labels as string[] })
      .where(eq(whatsappConversationsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ id: updated.id, labels: updated.labels });
  } catch (err) {
    res.status(500).json({ error: "Failed to update labels" });
  }
});

// PATCH /api/conversations/:id/assign
router.patch("/:id/assign", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { agentId } = req.body;
    const assignedAgentId = agentId ? parseInt(agentId) : null;
    const [updated] = await db
      .update(whatsappConversationsTable)
      .set({ assignedAgentId })
      .where(eq(whatsappConversationsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ id: updated.id, assignedAgentId: updated.assignedAgentId });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign conversation" });
  }
});

// PATCH /api/conversations/:id/mark-read
router.patch("/:id/mark-read", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await db
      .update(whatsappConversationsTable)
      .set({ unreadCount: 0 })
      .where(eq(whatsappConversationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

// POST /api/conversations/:id/note — internal note (not sent to WhatsApp)
router.post("/:id/note", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content required" });

    const conv = await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.id, id))
      .limit(1);
    if (!conv[0]) return res.status(404).json({ error: "Conversation not found" });

    const [stored] = await db
      .insert(whatsappMessagesTable)
      .values({
        conversationId: id,
        role: "assistant",
        content: content.trim(),
        messageType: "note",
        isInternalNote: true,
      })
      .returning();

    res.json({
      id: stored.id,
      role: stored.role,
      content: stored.content,
      messageType: "note",
      isInternalNote: true,
      createdAt: stored.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Error saving note:", err);
    res.status(500).json({ error: "Failed to save note" });
  }
});

// POST /api/conversations/:id/reply — manual reply (text, image, video, document, catalogue, template)
router.post("/:id/reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type = "text", message, mediaUrl, filename, caption, catalogueId } = req.body;

    const conv = await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.id, id))
      .limit(1);

    if (!conv[0]) return res.status(404).json({ error: "Conversation not found" });

    let dbContent = "";
    let dbMediaUrl: string | undefined;
    let dbMessageType = type as string;
    if (type === "text") {
      if (!message?.trim()) return res.status(400).json({ error: "Message required for text type" });
      dbContent = message.trim();
      dbMessageType = "text";
    } else if (type === "image") {
      dbContent = caption || "";
      dbMediaUrl = mediaUrl;
      dbMessageType = "image";
    } else if (type === "video") {
      dbContent = caption || filename || "";
      dbMediaUrl = mediaUrl;
      dbMessageType = "video";
    } else if (type === "document") {
      dbContent = `${filename || "archivo"}${caption ? " — " + caption : ""}`;
      dbMediaUrl = mediaUrl;
      dbMessageType = "document";
    } else if (type === "catalogue") {
      const cat = await db.select().from(cataloguesTable).where(eq(cataloguesTable.id, parseInt(catalogueId))).limit(1);
      dbContent = cat[0]?.name || "catálogo";
      dbMessageType = "catalogue";
    }

    const [stored] = await db
      .insert(whatsappMessagesTable)
      .values({ conversationId: id, role: "assistant", content: dbContent, messageType: dbMessageType, mediaUrl: dbMediaUrl })
      .returning();

    await db
      .update(whatsappConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(whatsappConversationsTable.id, id));

    const convChannel = conv[0].channel || "whatsapp";
    let waSent = false;

    if (convChannel === "instagram") {
      // Send via Instagram private API
      const threadId = conv[0].instagramThreadId;
      if (threadId && type === "text" && dbContent) {
        try {
          await sendInstagramReply(threadId, dbContent);
          waSent = true;
        } catch (igErr: any) {
          console.error("Instagram send error:", igErr?.message);
          // Don't fail the request — message is stored in DB
        }
      }
    } else if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      try {
        const phone = conv[0].customerPhone;
        const base = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const headers = {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        };

        let body: object;
        if (type === "text") {
          body = { messaging_product: "whatsapp", to: phone, type: "text", text: { body: message.trim() } };
        } else if (type === "image") {
          body = { messaging_product: "whatsapp", to: phone, type: "image", image: { link: mediaUrl, caption: caption || "" } };
        } else if (type === "video") {
          body = { messaging_product: "whatsapp", to: phone, type: "video", video: { link: mediaUrl, caption: caption || "" } };
        } else if (type === "document") {
          body = { messaging_product: "whatsapp", to: phone, type: "document", document: { link: mediaUrl, filename: filename || "documento.pdf", caption: caption || "" } };
        } else if (type === "catalogue" && catalogueId) {
          const cat = await db.select().from(cataloguesTable).where(eq(cataloguesTable.id, parseInt(catalogueId))).limit(1);
          if (cat[0]) {
            const host = process.env.REPLIT_DEV_DOMAIN
              ? `https://${process.env.REPLIT_DEV_DOMAIN}`
              : "http://localhost:8080";
            const fileUrl = `${host}/api/storage${cat[0].objectPath}`;
            body = { messaging_product: "whatsapp", to: phone, type: "document", document: { link: fileUrl, filename: cat[0].originalFilename, caption: caption || `Catálogo: ${cat[0].name}` } };
          } else {
            body = { messaging_product: "whatsapp", to: phone, type: "text", text: { body: "Catálogo no encontrado" } };
          }
        } else {
          body = { messaging_product: "whatsapp", to: phone, type: "text", text: { body: dbContent } };
        }

        const waRes = await fetch(base, { method: "POST", headers, body: JSON.stringify(body) });
        waSent = waRes.ok;
      } catch {
        // Don't fail if WA API fails
      }
    }

    res.json({
      message: { id: stored.id, role: stored.role, content: stored.content, messageType: stored.messageType || "text", mediaUrl: stored.mediaUrl || null, isInternalNote: false, createdAt: stored.createdAt.toISOString() },
      waSent,
      channel: convChannel,
    });
  } catch (err) {
    console.error("Error sending reply:", err);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

export default router;
