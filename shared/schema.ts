import { z } from "zod";

// --- User types ---
export interface User {
  id: string;
  email: string;
  password: string;
  createdAt: string;
}

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// --- Profile types ---
export interface Profile {
  id: string;
  userId: string;
  aboutMe: string | null;
  cvText: string | null;
  cvFileName: string | null;
  cvFileData: string | null;
  cvUpdatedAt: string | null;
  careerTestResults: string | null;
  careerTestInterpretation: string | null;
  applicationStyle: string | null; // JSON string
}

export const updateProfileSchema = z.object({
  aboutMe: z.string().optional(),
  cvText: z.string().optional(),
  cvFileName: z.string().optional(),
  cvFileData: z.string().optional(),
  careerTestResults: z.string().optional(),
  careerTestInterpretation: z.string().optional(),
  applicationStyle: z.string().optional(),
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(6),
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;
