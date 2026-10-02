import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AdminBanner } from "./types";
import { deleteAdminBanner, getAdminBanners, replaceAdminBanner, uploadAdminBanners } from "./api";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useAdminSettings() {
  const [items, setItems] = useState<AdminBanner[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState("");
  // bumped after an upload so the file input clears its selection
  const [fileInputKey, setFileInputKey] = useState(0);

  async function refreshBanners() {
    try {
      setLoading(true);
      const response = await getAdminBanners();
      setItems(response?.items ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load banners"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // ignore a response that lands after the page is gone
    let ignore = false;

    getAdminBanners()
      .then((response) => {
        if (!ignore) setItems(response?.items ?? []);
      })
      .catch((error: unknown) => {
        if (!ignore) toast.error(errorMessage(error, "Failed to load banners"));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function handleUpload() {
    if (!files.length) {
      toast.error("Select at least one image");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();

      files.forEach((file) => formData.append("images", file));

      const response = await uploadAdminBanners(formData);

      setItems((current) => [...(response?.items ?? []), ...current]);
      setFiles([]);
      setFileInputKey((key) => key + 1);
      toast.success("Banners uploaded");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to upload banners"));
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(id: string, file: File) {
    try {
      setBusyId(id);

      const formData = new FormData();
      formData.append("image", file);

      const updated = await replaceAdminBanner(id, formData);

      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
      toast.success("Banner updated");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update banner"));
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(id: string) {
    try {
      setBusyId(id);

      await deleteAdminBanner(id);

      setItems((current) => current.filter((item) => item.id !== id));
      toast.success("Banner deleted");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete banner"));
      return false;
    } finally {
      setBusyId("");
    }
  }

  const fileCountLabel = useMemo(() => {
    if (!files.length) return "No files selected";
    if (files.length === 1) return files[0].name;

    return `${files.length} files selected`;
  }, [files]);

  return {
    items,
    files,
    setFiles,
    fileCountLabel,
    fileInputKey,
    loading,
    setLoading,
    refreshBanners,
    handleUpload,
    handleReplace,
    handleDelete,
    uploading,
    busyId,
  };
}
