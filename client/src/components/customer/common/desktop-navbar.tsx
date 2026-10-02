import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CustomerMobileNavbar } from "./mobile-navbar";
import { useAuthStore } from "@/features/auth/store";
import { logout as logoutRequest } from "@/features/auth/api";
import { useCustomerWishlistStore } from "@/features/customer/wishlist/store";
import { useEffect } from "react";
import CustomerWishlistDialog from "../wishlist/customer-wishlist-dialog";
import { useCustomerProfileStore } from "@/features/customer/profile/store";
import CustomerProfileDialog from "../profile/customer-profile-dialog";
import { useCustomerOrdersStore } from "@/features/customer/orders/store";
import CustomerOrdersDialog from "../orders/customer-orders-dialog";
import { useCustomerCartAndCheckoutStore } from "@/features/customer/cart-and-checkout/store";
import CustomerCartAndCheckoutDrawer from "../cart-and-checkout/customer-cart-and-checkout-drawer";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const collectionsPage: NavItem = {
  label: "Collections",
  href: "/collections",
  icon: ShoppingBag,
};

const shell = "mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8";

const headerClass = "sticky top-0 z-50 border-b border-border/70 bg-secondary/60 backdrop-blur-xl";

const textLink =
  "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[15px] font-medium text-foreground/90 transition hover:bg-white/5 hover:text-foreground";

const iconLink =
  "relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground/90 transition hover:bg-white/5 hover:text-foreground";

const brandWrap = "flex shrink-0 items-center gap-3";

const brandTitle = "text-[25px] font-semibold tracking-[-0.02em] text-foreground";

const desktopCollectionsWrap = "ml-6 hidden lg:block";

const desktopNav = "ml-auto hidden items-center gap-1 lg:flex";

const dropdownButton =
  "h-10 rounded-xl px-3 text-[15px] font-medium text-foreground/90 hover:bg-white/5 hover:text-foreground";

const dropdownContent = "mt-3 rounded-2xl border-border bg-popover/95 p-2 backdrop-blur";

const accountDropdownContent = `${dropdownContent} w-56`;

const dropdownItemLink = "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5";

const cartBadge =
  "absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-5 text-black";

const wishlistBadge =
  "absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-5 text-black";

function NavTextLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link to={href} className={textLink}>
      <Icon className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </Link>
  );
}

export function CustomerNavbar() {
  const { user, isBootstrapped, logout } = useAuthStore((state) => state);
  const isSignedIn = !!user;
  const isAdmin = user?.role === "admin";

  const {
    items: wishlistItems,
    loadWishlist,
    clear: clearWishlist,
    setOpen: setWishlistOpen,
  } = useCustomerWishlistStore((state) => state);

  const { openProfile, clear: clearProfile } = useCustomerProfileStore((state) => state);

  const { openOrders } = useCustomerOrdersStore((state) => state);

  const {
    setOpen: setCartOpen,
    cart,
    loadCart,
  } = useCustomerCartAndCheckoutStore((state) => state);

  useEffect(() => {
    if (!isBootstrapped) return;

    void loadCart(isSignedIn);

    if (!isSignedIn) {
      clearWishlist();
      clearProfile();
      return;
    }

    void loadWishlist();
  }, [clearWishlist, isBootstrapped, clearProfile, isSignedIn, loadWishlist, loadCart]);

  async function handleSignOut() {
    try {
      await logoutRequest();
    } catch {
      // ignore network errors, clear local session regardless
    }

    logout();
    clearWishlist();
    clearProfile();
  }

  const wishlistCount = wishlistItems.length;

  return (
    <header className={headerClass}>
      <div className={shell}>
        <Link to={"/"} className={brandWrap}>
          <Store className="h-10 w-10" />
          <span className={brandTitle}>E-Shopify</span>
        </Link>

        <div className={desktopCollectionsWrap}>
          <NavTextLink
            href={collectionsPage.href}
            label={collectionsPage.label}
            icon={collectionsPage.icon}
          />
        </div>

        <nav className={desktopNav}>
          {isSignedIn ? (
            <button type="button" className={iconLink} onClick={() => setWishlistOpen(true)}>
              <Heart className="w-[20px] h-[20px]" />
              <span className={wishlistBadge}>{wishlistCount}</span>
            </button>
          ) : null}

          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} className={dropdownButton}>
                  <User className="h-4.5 w-4.5" />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className={accountDropdownContent}>
                {isAdmin && (
                  <DropdownMenuItem asChild className={dropdownItemLink}>
                    <Link to="/admin">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => void openProfile()} className={dropdownItemLink}>
                  <User className="h-4 w-4" />
                  <span>My Account</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => void openOrders()} className={dropdownItemLink}>
                  <ShoppingBasket className="h-4 w-4" />
                  <span>My Orders</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => void handleSignOut()} className={dropdownItemLink}>
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <NavTextLink href="/sign-in" label="Login" icon={LogIn} />
          )}

          <button type="button" onClick={() => setCartOpen(true)} className={iconLink}>
            <ShoppingCart className="h-4.5 w-4.5" />
            <span className={cartBadge}>{cart?.items?.length ?? 0}</span>
          </button>
        </nav>

        <CustomerMobileNavbar isSignedIn={isSignedIn} />

        {isSignedIn ? <CustomerWishlistDialog /> : null}
        {isSignedIn ? <CustomerProfileDialog /> : null}
        {isSignedIn ? <CustomerOrdersDialog /> : null}
        <CustomerCartAndCheckoutDrawer />
      </div>
    </header>
  );
}
