import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/features/auth/store";
import { Commonloader } from "../common/Loader";

export function PublicOnlyLayout() {
  const { isBootstrapped, status, user } = useAuthStore();

  if (!isBootstrapped || status === "loading") {
    return <Commonloader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
