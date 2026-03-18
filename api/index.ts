import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "crypto";
import { promisify } from "util";
import { z } from "zod";

// ---- Schema definitions (inline for serverless) ----
const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

const updateProfileSchema = z.object({
  aboutMe: z.string().nullable().optional(),
  cvText: z.string().nullable().optional(),
  cvFileName: z.string().nullable().optional(),
  cvFileData: z.string().nullable().optional(),
  careerTestResults: z.string().nullable().optional(),
  careerTestInterpretation: z.string().nullable().optional(),
  applicationStyle: z.any().nullable().optional(),
});

// ---- Types ----
interface User {
  id: string;
  email: string;
  password: string;
  createdAt: string;
}

interface Profile {
  id: string;
  userId: string;
  aboutMe: string | null;
  cvText: string | null;
  cvFileName: string | null;
  cvFileData: string | null;
  cvUpdatedAt: string | null;
  careerTestResults: string | null;
  careerTestInterpretation: string | null;
  applicationStyle: any | null;
}

// ---- In-memory storage (serverless — resets on cold start) ----
const users = new Map<string, User>();
const profiles = new Map<string, Profile>();

function getUserById(id: string): User | undefined {
  return users.get(id);
}

function getUserByEmail(email: string): User | undefined {
  return Array.from(users.values()).find((u) => u.email === email);
}

function createUser(email: string, hashedPassword: string): User {
  const id = randomUUID();
  const user: User = { id, email, password: hashedPassword, createdAt: new Date().toISOString() };
  users.set(id, user);
  return user;
}

function updateUserPassword(id: string, hashedPassword: string): void {
  const user = users.get(id);
  if (user) {
    user.password = hashedPassword;
    users.set(id, user);
  }
}

function getProfile(userId: string): Profile | undefined {
  return Array.from(profiles.values()).find((p) => p.userId === userId);
}

function upsertProfile(userId: string, data: any): Profile {
  let profile = getProfile(userId);
  if (profile) {
    if (data.aboutMe !== undefined) profile.aboutMe = data.aboutMe;
    if (data.cvText !== undefined) profile.cvText = data.cvText;
    if (data.cvFileName !== undefined) profile.cvFileName = data.cvFileName;
    if (data.cvFileData !== undefined) {
      profile.cvFileData = data.cvFileData;
      profile.cvUpdatedAt = new Date().toISOString();
    }
    if (data.careerTestResults !== undefined) profile.careerTestResults = data.careerTestResults;
    if (data.careerTestInterpretation !== undefined) profile.careerTestInterpretation = data.careerTestInterpretation;
    if (data.applicationStyle !== undefined) profile.applicationStyle = data.applicationStyle;
    profiles.set(profile.id, profile);
  } else {
    const id = randomUUID();
    profile = {
      id,
      userId,
      aboutMe: data.aboutMe ?? null,
      cvText: data.cvText ?? null,
      cvFileName: data.cvFileName ?? null,
      cvFileData: data.cvFileData ?? null,
      cvUpdatedAt: data.cvFileData ? new Date().toISOString() : null,
      careerTestResults: data.careerTestResults ?? null,
      careerTestInterpretation: data.careerTestInterpretation ?? null,
      applicationStyle: data.applicationStyle ?? null,
    };
    profiles.set(id, profile);
  }
  return profile;
}

// ---- Password hashing ----
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

// ---- Express app ----
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "jobbassistent-secret-key-dev",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: "lax" as const,
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Passport local strategy
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

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = getUserByEmail(email);
        if (!user) return done(null, false, { message: "Ugyldig e-post eller passord" });
        const isValid = await verifyPassword(user.password, password);
        if (!isValid) return done(null, false, { message: "Ugyldig e-post eller passord" });
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

passport.deserializeUser((id: string, done) => {
  const user = getUserById(id);
  done(null, user || undefined);
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Ikke innlogget" });
}

// ---- Routes ----

// Register
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ugyldig e-post eller passord (minst 6 tegn)" });
    const existing = getUserByEmail(parsed.data.email);
    if (existing) return res.status(409).json({ message: "E-postadressen er allerede registrert" });
    const hashedPassword = await hashPassword(parsed.data.password);
    const user = createUser(parsed.data.email, hashedPassword);
    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: "Registrering vellykket, men innlogging feilet" });
      return res.status(201).json({ id: user.id, email: user.email, createdAt: user.createdAt });
    });
  } catch (error) {
    return res.status(500).json({ message: "Noe gikk galt under registrering" });
  }
});

// Login
app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: any, user: User | false, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || "Ugyldig e-post eller passord" });
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({ id: user.id, email: user.email, createdAt: user.createdAt });
    });
  })(req, res, next);
});

// Logout
app.post("/api/auth/logout", (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: "Utlogging feilet" });
    return res.json({ message: "Logget ut" });
  });
});

// Get current user
app.get("/api/auth/me", (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Ikke innlogget" });
  return res.json({ id: req.user.id, email: req.user.email, createdAt: req.user.createdAt });
});

// Change password
app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ugyldig forespørsel" });
    const user = req.user!;
    const isValid = await verifyPassword(user.password, parsed.data.oldPassword);
    if (!isValid) return res.status(400).json({ message: "Gammelt passord er feil" });
    const hashedPassword = await hashPassword(parsed.data.newPassword);
    updateUserPassword(user.id, hashedPassword);
    const updatedUser = getUserById(user.id);
    if (updatedUser) {
      req.login(updatedUser, (err) => {
        if (err) return res.status(500).json({ message: "Passord endret, men sesjon feilet" });
        return res.json({ message: "Passord endret" });
      });
    } else {
      return res.json({ message: "Passord endret" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Noe gikk galt" });
  }
});

// Get profile
app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = getProfile(req.user!.id);
    return res.json(profile || {
      aboutMe: null, cvText: null, cvFileName: null, cvFileData: null,
      cvUpdatedAt: null, careerTestResults: null, careerTestInterpretation: null, applicationStyle: null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Kunne ikke hente profil" });
  }
});

// Update profile
app.patch("/api/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ugyldig data" });
    const profile = upsertProfile(req.user!.id, parsed.data);
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: "Kunne ikke lagre profil" });
  }
});

// CV file upload
app.post("/api/profile/cv-upload", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) return res.status(400).json({ message: "Mangler filnavn eller fildata" });
    const profile = upsertProfile(req.user!.id, { cvFileName: fileName, cvFileData: fileData });
    return res.json({ cvFileName: profile.cvFileName, cvUpdatedAt: profile.cvUpdatedAt });
  } catch (error) {
    return res.status(500).json({ message: "Kunne ikke laste opp CV" });
  }
});

// Error handler
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  if (res.headersSent) return next(err);
  return res.status(status).json({ message });
});

export default app;
