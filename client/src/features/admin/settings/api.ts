import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { AdminBanner, AdminBannersResponse } from "./types";

export async function getAdminBanners() {
  return apiGet<AdminBannersResponse>("/admin/settings/banners");
}

export async function uploadAdminBanners(formData: FormData) {
  return apiPost<AdminBannersResponse, FormData>("/admin/settings/banners", formData);
}

export async function replaceAdminBanner(id: string, formData: FormData) {
  return apiPut<AdminBanner, FormData>(`/admin/settings/banners/${id}`, formData);
}

export async function deleteAdminBanner(id: string) {
  return apiDelete<{ id: string }>(`/admin/settings/banners/${id}`);
}
