import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health.js";
import conversationsRouter from "./conversations.js";
import whatsappRouter from "./whatsapp.js";
import productsRouter from "./products.js";
import botTrainingRouter from "./bot_training.js";
import crmRouter from "./crm.js";
import storageRouter from "./storage.js";
import cataloguesRouter from "./catalogues.js";
import automationsRouter from "./automations.js";
import quickResponsesRouter from "./quick_responses.js";
import authRouter from "./auth.js";
import teamRouter from "./team.js";
import templatesRouter from "./templates.js";
import statsRouter from "./stats.js";
import instagramRouter from "./instagram.js";
import { requireAuth } from "../auth/middleware.js";

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use("/auth", authRouter);

// WhatsApp webhook is public (Meta verifies with token)
router.use("/whatsapp", whatsappRouter);

// All other routes require authentication
router.use(requireAuth);

router.use("/conversations", conversationsRouter);
router.use("/products", productsRouter);
router.use("/bot", botTrainingRouter);
router.use("/crm", crmRouter);
router.use(storageRouter);
router.use("/catalogues", cataloguesRouter);
router.use("/automations", automationsRouter);
router.use("/quick-responses", quickResponsesRouter);
router.use("/team", teamRouter);
router.use("/templates", templatesRouter);
router.use("/stats", statsRouter);
router.use("/instagram", instagramRouter);

export default router;
