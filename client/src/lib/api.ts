import axios, { type AxiosRequestConfig } from "axios";
import { env } from "./env";
import type { ApiEnvelope, AppUser } from "./types";
import { useAuthStore } from "@/features/auth/store";

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setApiTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

const api = axios.create({
  baseURL: env.backendUrl,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: env.backendUrl,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  if (!tokenGetter) return config;

  const token = await tokenGetter();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function requestRefresh(): Promise<string | null> {
  try {
    const response =
      await refreshClient.post<ApiEnvelope<{ accessToken: string; user: AppUser }>>(
        "/auth/refresh",
      );

    const data = response.data.data;
    if (response.data.status === "error" || !data) return null;

    useAuthStore.getState().setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const isAuthRoute = original?.url?.startsWith("/auth");

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = requestRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      const token = await refreshPromise;

      if (token) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }

      useAuthStore.getState().clearAuth();
    }

    return Promise.reject(error);
  },
);

function getErrorMsg(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.errors?.[0]?.message || error.message || "Request failed";
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong!!! Please try again";
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig) {
  try {
    const response = await api.get<ApiEnvelope<T>>(url, config);

    if (response.data.status === "error" || !response.data.data) {
      throw new Error(response.data.errors?.[0]?.message || "Request failed");
    }

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMsg(error));
  }
}

export async function apiPost<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  try {
    const response = await api.post<ApiEnvelope<TResponse>>(url, body, config);
    if (response.data.status === "error" || !response.data.data) {
      throw new Error(response.data.errors?.[0]?.message || "Request failed");
    }

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMsg(error));
  }
}

export async function apiPut<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  try {
    const response = await api.put<ApiEnvelope<TResponse>>(url, body, config);

    if (response.data.status === "error" || !response.data.data) {
      throw new Error(response.data.errors?.[0]?.message || "Request failed");
    }

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMsg(error));
  }
}

export async function apiPatch<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  try {
    const response = await api.patch<ApiEnvelope<TResponse>>(url, body, config);

    if (response.data.status === "error" || !response.data.data) {
      throw new Error(response.data.errors?.[0]?.message || "Request failed");
    }

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMsg(error));
  }
}

export async function apiDelete<TResponse>(url: string, config?: AxiosRequestConfig) {
  try {
    const response = await api.delete<ApiEnvelope<TResponse>>(url, config);
    if (response.data.status === "error" || !response.data.data) {
      throw new Error(response.data.errors?.[0]?.message || "Request failed");
    }

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMsg(error));
  }
}
