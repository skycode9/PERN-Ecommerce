import { useEffect } from "react";
import { useAuthStore } from "./store";
import { refresh } from "./api";
import { setApiTokenGetter } from "@/lib/api";

export function useBootstrapAuth() {
  useEffect(() => {
    setApiTokenGetter(async () => useAuthStore.getState().accessToken);

    async function run() {
      const { setLoading, setAccessToken, setUser, clearAuth } = useAuthStore.getState();

      setLoading();

      try {
        const { accessToken, user } = await refresh();
        setAccessToken(accessToken);
        setUser(user);
      } catch {
        clearAuth();
      }
    }

    void run();
  }, []);
}
