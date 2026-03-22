import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  whatsappConversationsTable,
  whatsappMessagesTable,
} from "@workspace/db/schema";
import { desc, gte, sql, count } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/stats
router.get("/", async (_req, res) => {
  try {
    const now = new Date();

    // --- Messages per day (last 7 days) ---
    const days: { date: string; messages: number; inbound: number; outbound: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dNext = new Date(d);
      dNext.setDate(dNext.getDate() + 1);

      const all = await db
        .select({ count: count() })
        .from(whatsappMessagesTable)
        .where(
          sql`${whatsappMessagesTable.createdAt} >= ${d} AND ${whatsappMessagesTable.createdAt} < ${dNext}`
        );
      const inbound = await db
        .select({ count: count() })
        .from(whatsappMessagesTable)
        .where(
          sql`${whatsappMessagesTable.createdAt} >= ${d} AND ${whatsappMessagesTable.createdAt} < ${dNext} AND ${whatsappMessagesTable.role} = 'user'`
        );
      const outbound = await db
        .select({ count: count() })
        .from(whatsappMessagesTable)
        .where(
          sql`${whatsappMessagesTable.createdAt} >= ${d} AND ${whatsappMessagesTable.createdAt} < ${dNext} AND ${whatsappMessagesTable.role} = 'assistant'`
        );

      const label = d.toLocaleDateString("es-EC", { weekday: "short", day: "numeric" });
      days.push({
        date: label,
        messages: Number(all[0]?.count ?? 0),
        inbound: Number(inbound[0]?.count ?? 0),
        outbound: Number(outbound[0]?.count ?? 0),
      });
    }

    // --- Total unread count ---
    const unreadResult = await db
      .select({ total: sql<number>`coalesce(sum(${whatsappConversationsTable.unreadCount}), 0)` })
      .from(whatsappConversationsTable);
    const totalUnread = Number(unreadResult[0]?.total ?? 0);

    // --- Total conversations ---
    const totalConvsResult = await db
      .select({ count: count() })
      .from(whatsappConversationsTable);
    const totalConversations = Number(totalConvsResult[0]?.count ?? 0);

    // --- Today's conversations ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayConvsResult = await db
      .select({ count: count() })
      .from(whatsappConversationsTable)
      .where(gte(whatsappConversationsTable.createdAt, today));
    const todayConversations = Number(todayConvsResult[0]?.count ?? 0);

    // --- Conversations by label ---
    const allConvs = await db
      .select({ labels: whatsappConversationsTable.labels })
      .from(whatsappConversationsTable);
    const labelCounts: Record<string, number> = {};
    for (const conv of allConvs) {
      for (const lbl of conv.labels || []) {
        labelCounts[lbl] = (labelCounts[lbl] || 0) + 1;
      }
    }
    const labelData = Object.entries(labelCounts).map(([name, value]) => ({ name, value }));

    // --- Total messages ---
    const totalMsgsResult = await db
      .select({ count: count() })
      .from(whatsappMessagesTable);
    const totalMessages = Number(totalMsgsResult[0]?.count ?? 0);

    res.json({
      messagesPerDay: days,
      totalUnread,
      totalConversations,
      todayConversations,
      totalMessages,
      labelData,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
