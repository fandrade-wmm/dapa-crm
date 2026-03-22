import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { cataloguesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(cataloguesTable)
      .orderBy(cataloguesTable.uploadedAt);
    res.json({ catalogues: items });
  } catch (error) {
    console.error("Error fetching catalogues:", error);
    res.status(500).json({ error: "Error al obtener catálogos" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, objectPath, originalFilename, fileSize } = req.body;
    if (!name || !objectPath || !originalFilename) {
      res.status(400).json({ error: "Nombre, ruta del archivo y nombre original son requeridos" });
      return;
    }
    const [catalogue] = await db
      .insert(cataloguesTable)
      .values({ name, description, objectPath, originalFilename, fileSize })
      .returning();
    res.json({ catalogue });
  } catch (error) {
    console.error("Error creating catalogue:", error);
    res.status(500).json({ error: "Error al crear catálogo" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(cataloguesTable).where(eq(cataloguesTable.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting catalogue:", error);
    res.status(500).json({ error: "Error al eliminar catálogo" });
  }
});

export default router;
