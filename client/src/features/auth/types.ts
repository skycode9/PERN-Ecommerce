import type { AppUser } from "@/lib/types";

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
};

export type LoginBody = {
  email: string;
  password: string;
};

export type GoogleBody = {
  credential: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AppUser;
};

export type MeResponse = {
  user: AppUser;
};
