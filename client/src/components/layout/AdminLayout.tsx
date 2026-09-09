import { Outlet } from "react-router-dom";
import { AdminSidebar } from "../admin/common/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/features/auth/store";
import { logout as logoutRequest } from "@/features/auth/api";
import { LogOut, User } from "lucide-react";

const triggerClass = "h-10 gap-2 rounded-xl px-3 text-[15px] font-medium";
const menuContentClass = "mt-3 w-56 rounded-2xl border-border p-2";
const menuItemClass = "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5";

export function AdminLayout() {
  const { user, logout } = useAuthStore((state) => state);

  async function handleSignOut() {
    try {
      await logoutRequest();
    } catch {
      // ignore network errors, clear local session regardless
    }

    logout();
  }

  const displayName = user?.name || user?.email || "Account";

  return (
    <div className="min-h-screen bg-secondary/45">
      <div className="flex min-h-screen">
        <AdminSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border px-4 backdrop-blur lg:px-6">
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={triggerClass}>
                    <User className="h-4.5 w-4.5" />
                    <span className="max-w-[160px] truncate">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={menuContentClass}>
                  <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleSignOut()} className={menuItemClass}>
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
