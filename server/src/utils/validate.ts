import type { ZodType } from "zod";
import { AppError } from "./AppError";

export function validate<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body";
    throw new AppError(400, message);
  }

  return result.data;
}
