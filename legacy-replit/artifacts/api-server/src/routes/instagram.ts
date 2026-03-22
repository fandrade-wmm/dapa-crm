import { Router, type IRouter } from "express";
import { igLogin, igLogout, getIgState } from "../lib/instagramService.js";

const router: IRouter = Router();

// GET /api/instagram/status
router.get("/status", (_req, res) => {
  const state = getIgState();
  res.json(state);
});

// POST /api/instagram/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
  }

  const result = await igLogin(username.trim(), password);
  if (result.success) {
    res.json({ success: true, username: username.trim() });
  } else {
    res.status(401).json({ success: false, error: result.error });
  }
});

// POST /api/instagram/logout
router.post("/logout", async (_req, res) => {
  await igLogout();
  res.json({ success: true });
});

export default router;
