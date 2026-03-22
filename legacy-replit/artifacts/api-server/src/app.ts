import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "./auth/passport.js";
import router from "./routes/index.js";
import { initInstagram } from "./lib/instagramService.js";

const PgStore = connectPgSimple(session);

const app: Express = express();

// CORS — allow credentials from dashboard
const allowedOrigin = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://localhost:5173";

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin, localhost, and *.replit.dev
    if (!origin || origin.includes("localhost") || origin.includes("replit.dev") || origin.includes("replit.app") || origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Trust the Replit proxy so secure cookies work over the HTTPS proxy
app.set("trust proxy", 1);

// Session store in PostgreSQL
const sessionSecret = process.env.SESSION_SECRET || "dapahome_session_secret_change_in_production_please";

app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api", router);

// Init Instagram session if previously connected
initInstagram().catch(console.error);

export default app;
