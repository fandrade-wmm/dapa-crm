import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, ALL_PERMISSIONS } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// Serialize / Deserialize
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: number }).id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

// Email/password login
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
      if (!user) return done(null, false, { message: "Correo no encontrado" });
      if (!user.isActive) return done(null, false, { message: "Cuenta desactivada" });
      if (!user.passwordHash) return done(null, false, { message: "Esta cuenta usa Google para iniciar sesión" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: "Contraseña incorrecta" });

      await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  const callbackURL = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
    : `http://localhost:8080/api/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      { clientID: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, callbackURL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false);

          // Find by googleId
          let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.id)).limit(1);

          if (!user) {
            // Find by email (existing invite)
            const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
            if (byEmail) {
              // Link google to existing account
              [user] = await db.update(usersTable).set({ googleId: profile.id, avatarUrl: profile.photos?.[0]?.value, lastLoginAt: new Date() }).where(eq(usersTable.id, byEmail.id)).returning();
            } else {
              // Check if this is the first user (auto-admin)
              const allUsers = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
              const isFirst = allUsers.length === 0;

              [user] = await db.insert(usersTable).values({
                email,
                name: profile.displayName || email.split("@")[0],
                avatarUrl: profile.photos?.[0]?.value,
                googleId: profile.id,
                role: isFirst ? "admin" : "agent",
                permissions: ALL_PERMISSIONS,
                isActive: true,
                lastLoginAt: new Date(),
              }).returning();
            }
          } else {
            if (!user.isActive) return done(null, false);
            await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export default passport;
