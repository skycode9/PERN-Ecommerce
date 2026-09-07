import { apiGet, apiPost } from "@/lib/api";
import type { AuthResponse, GoogleBody, LoginBody, MeResponse, RegisterBody } from "./types";

export function register(body: RegisterBody) {
  return apiPost<AuthResponse, RegisterBody>("/auth/register", body);
}

export function login(body: LoginBody) {
  return apiPost<AuthResponse, LoginBody>("/auth/login", body);
}

export function google(idToken: string) {
  return apiPost<AuthResponse, GoogleBody>("/auth/google", {
    credential: idToken,
  });
}

export function refresh() {
  return apiPost<AuthResponse>("/auth/refresh");
}

export function getMe() {
  return apiGet<MeResponse>("/auth/me");
}

export function logout() {
  return apiPost<{ message: string }>("/auth/logout");
}
