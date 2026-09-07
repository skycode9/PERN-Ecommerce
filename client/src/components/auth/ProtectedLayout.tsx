import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "@/features/auth/store";
import { Commonloader } from "../common/Loader";

export function ProtectedLayout() {
  const { isBootstrapped, status, user } = useAuthStore();
  const location = useLocation();

  if (!isBootstrapped || status === "loading") {
    return <Commonloader />;
  }

  if (!user) {
    return (
      <Navigate to="/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
}
