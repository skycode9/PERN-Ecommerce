export type UserRole = "user" | "admin";

export type AppUser = {
  id: string;
  email?: string;
  name?: string;
  role: UserRole;
  points: number;
};

export type ApiErrorItem = {
  message: string;
  code?: string;
};

export type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: ApiErrorItem[];
};
