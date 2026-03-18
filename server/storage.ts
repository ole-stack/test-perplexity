import { type User, type InsertUser, type Profile, type UpdateProfile } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getProfile(userId: string): Promise<Profile | undefined>;
  upsertProfile(userId: string, data: UpdateProfile): Promise<Profile>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private profiles: Map<string, Profile>;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser & { password: string }): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      password: insertUser.password,
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.password = hashedPassword;
      this.users.set(id, user);
    }
  }

  async getProfile(userId: string): Promise<Profile | undefined> {
    return Array.from(this.profiles.values()).find(
      (profile) => profile.userId === userId,
    );
  }

  async upsertProfile(userId: string, data: UpdateProfile): Promise<Profile> {
    let profile = await this.getProfile(userId);
    if (profile) {
      // Update existing
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
      this.profiles.set(profile.id, profile);
    } else {
      // Create new
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
      this.profiles.set(id, profile);
    }
    return profile;
  }
}

export const storage = new MemStorage();
