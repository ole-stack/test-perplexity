import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { insertUserSchema, changePasswordSchema, updateProfileSchema } from "@shared/schema";
import type { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function verifyPassword(stored: string, supplied: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Ikke innlogget" });
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      password: string;
      createdAt: string;
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Session setup with MemoryStore
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "jobbassistent-secret-key-dev",
    resave: false,
    saveUninitialized: false,
    store: new session.MemoryStore(),
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Ugyldig e-post eller passord" });
          }
          const isValid = await verifyPassword(user.password, password);
          if (!isValid) {
            return done(null, false, { message: "Ugyldig e-post eller passord" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || undefined);
    } catch (err) {
      done(err);
    }
  });

  // --- Auth routes ---

  // Register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ugyldig e-post eller passord (minst 6 tegn)" });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ message: "E-postadressen er allerede registrert" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        email: parsed.data.email,
        password: hashedPassword,
      });

      // Log in after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registrering vellykket, men innlogging feilet" });
        }
        return res.status(201).json({
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        });
      });
    } catch (error) {
      return res.status(500).json({ message: "Noe gikk galt under registrering" });
    }
  });

  // Login
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Ugyldig e-post eller passord" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Utlogging feilet" });
      }
      return res.json({ message: "Logget ut" });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Ikke innlogget" });
    }
    return res.json({
      id: req.user.id,
      email: req.user.email,
      createdAt: req.user.createdAt,
    });
  });

  // Change password
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ugyldig forespørsel" });
      }

      const user = req.user!;
      const isValid = await verifyPassword(user.password, parsed.data.oldPassword);
      if (!isValid) {
        return res.status(400).json({ message: "Gammelt passord er feil" });
      }

      const hashedPassword = await hashPassword(parsed.data.newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);

      // Update the session user data
      const updatedUser = await storage.getUser(user.id);
      if (updatedUser) {
        req.login(updatedUser, (err) => {
          if (err) {
            return res.status(500).json({ message: "Passord endret, men sesjon feilet" });
          }
          return res.json({ message: "Passord endret" });
        });
      } else {
        return res.json({ message: "Passord endret" });
      }
    } catch (error) {
      return res.status(500).json({ message: "Noe gikk galt" });
    }
  });

  // --- Profile routes ---

  // Get profile
  app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const profile = await storage.getProfile(req.user!.id);
      return res.json(profile || {
        aboutMe: null,
        cvText: null,
        cvFileName: null,
        cvFileData: null,
        cvUpdatedAt: null,
        careerTestResults: null,
        careerTestInterpretation: null,
        applicationStyle: null,
      });
    } catch (error) {
      return res.status(500).json({ message: "Kunne ikke hente profil" });
    }
  });

  // Update profile
  app.patch("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ugyldig data" });
      }

      const profile = await storage.upsertProfile(req.user!.id, parsed.data);
      return res.json(profile);
    } catch (error) {
      return res.status(500).json({ message: "Kunne ikke lagre profil" });
    }
  });

  // File upload for CV (base64)
  // Increase body size limit for this route
  app.post("/api/profile/cv-upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const { fileName, fileData } = req.body;
      if (!fileName || !fileData) {
        return res.status(400).json({ message: "Mangler filnavn eller fildata" });
      }

      const profile = await storage.upsertProfile(req.user!.id, {
        cvFileName: fileName,
        cvFileData: fileData,
      });
      return res.json({
        cvFileName: profile.cvFileName,
        cvUpdatedAt: profile.cvUpdatedAt,
      });
    } catch (error) {
      return res.status(500).json({ message: "Kunne ikke laste opp CV" });
    }
  });

  return httpServer;
}
