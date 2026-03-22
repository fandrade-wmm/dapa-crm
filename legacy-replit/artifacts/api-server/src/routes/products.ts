import { Router, type IRouter } from "express";
import { searchProducts } from "../lib/odoo.js";
import { ListProductsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const parsed = ListProductsQueryParams.safeParse(req.query);
    const search = (parsed.success ? parsed.data.search : undefined) as string | undefined;
    const limit = (parsed.success ? parsed.data.limit : 20) as number;
    const offset = (parsed.success ? parsed.data.offset : 0) as number;

    const { products, total } = await searchProducts(search || "", limit, offset);

    res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        price: p.list_price,
        stock: p.qty_available,
        category: p.categ_id ? p.categ_id[1] : "General",
        description: p.description_sale || undefined,
        imageUrl: p.imageUrl,
      })),
      total,
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products from Odoo" });
  }
});

export default router;
