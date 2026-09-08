import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useCustomerCartAndCheckoutStore } from "@/features/customer/cart-and-checkout/store";
import CustomerCartItems from "./customer-cart-items";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { env } from "@/lib/env";
import { loadStripe } from "@stripe/stripe-js";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(env.stripePublishableKey);

const cardElementOptions = {
  style: {
    base: {
      color: "#0f172a",
      fontSize: "15px",
      fontFamily: "inherit",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: { color: "#dc2626" },
  },
};

const contentClass =
  "ml-auto flex h-[90dvh] max-h-[90dvh] w-full overflow-hidden rounded-none border-l border-border bg-background p-0";

const shellClass = "grid h-full min-h-0 w-full lg:grid-cols-[1.7fr_1fr]";
const leftPaneClass = "min-h-0 border-b border-border lg:border-b-0 lg:border-r";
const rightPaneClass = "min-h-0 bg-gradient-to-b from-secondary/40 via-background to-background";
const rightInnerClass = "flex h-full min-h-0 flex-col p-5";

const panelClass =
  "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm";
const panelHeaderClass = "border-b border-border px-5 py-4";
const panelTitleClass = "flex items-center gap-2 text-left";

const scrollClass = "min-h-0 flex-1";
const bodyClass = "space-y-4 px-5 py-4";

const sectionTitleClass = "text-sm font-medium text-foreground";
const helperClass = "text-xs text-muted-foreground";
const cardClass = "border border-border bg-background/50 p-3 text-sm";
const rowClass = "flex items-center justify-between text-sm";
const totalRowClass =
  "flex items-center justify-between border-t border-border pt-4 text-base font-semibold";

const promoRowClass = "flex gap-2";
const promoInputClass = "rounded-none";
const actionClass = "shrink-0 space-y-3 border-t border-border px-5 py-4";
const primaryButtonClass = "h-11 w-full";

const promoTitle = "flex items-center gap-2 text-sm font-medium text-foreground";

const cardInputClass = "rounded-none border border-border bg-white px-3 py-3.5";

const infoBoxClass =
  "rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground";

function SummaryRow(props: { label: string; value: string | number }) {
  return (
    <div className={rowClass}>
      <span className="text-muted-foreground">{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

function CheckoutPanel() {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const { user } = useAuthStore((state) => state);
  const isSignedIn = !!user;

  const {
    selectedAddressId,
    addresses,
    promoInput,
    appliedPromo,
    points,
    promoLoading,
    checkoutLoading,
    pointsCheckoutLoading,
    setPromoInput,
    clearPromo,
    applyPromo,
    startStripeCheckout,
    startPointsCheckout,
    loading,
    cart,
  } = useCustomerCartAndCheckoutStore((state) => state);

  const selectedAddress = addresses.find((item) => item.id === selectedAddressId) || null;

  const subTotal = cart.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);

  const discountAmount = appliedPromo ? Math.round((subTotal * appliedPromo.percentage) / 100) : 0;

  const totalAmount = Math.max(subTotal - discountAmount, 0);

  return (
    <>
      <ScrollArea className={scrollClass}>
        <div className={bodyClass}>
          <section className="space-y-2">
            <p className={sectionTitleClass}>Default Address</p>

            {selectedAddress ? (
              <div className={cardClass}>
                <p className={helperClass}>{selectedAddress.fullName}</p>
                <p className={helperClass}>
                  {selectedAddress.address}
                  {selectedAddress.state}
                </p>
                <p className={helperClass}>{selectedAddress.postalCode}</p>
              </div>
            ) : (
              <p>No default address present. Add one from profile dialog</p>
            )}
          </section>

          <section className="space-y-2">
            <p className={promoTitle}>Promo Code</p>
            {!appliedPromo ? (
              <div className={promoRowClass}>
                <Input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  placeholder="Enter Promo Code"
                  className={promoInputClass}
                />
                <Button
                  type="button"
                  variant={"default"}
                  onClick={() => void applyPromo()}
                  disabled={promoLoading || !promoInput.trim()}
                >
                  {promoLoading ? "Applying..." : "Apply"}
                </Button>
              </div>
            ) : (
              <div>
                <span>
                  {appliedPromo.code} ({appliedPromo.percentage}%)
                </span>
                <Button type="button" variant={"default"} onClick={clearPromo}>
                  Remove
                </Button>
              </div>
            )}
          </section>

          <SummaryRow label="Items" value={cart.totalQuantity} />
          <SummaryRow label="Subtotal" value={subTotal} />
          <SummaryRow label="Discount" value={formatPrice(discountAmount)} />
          <SummaryRow label="Points" value={points} />
          <div className={totalRowClass}>
            <span>Total</span>
            <span>{formatPrice(totalAmount)}</span>
          </div>

          <section className="space-y-2">
            <p className={sectionTitleClass}>Card Details</p>
            <div className={cardInputClass}>
              <CardElement options={cardElementOptions} />
            </div>
          </section>
        </div>
      </ScrollArea>

      <DrawerFooter className={actionClass}>
        <Button
          onClick={() => {
            void startStripeCheckout({
              isSignedIn,
              name: user?.name || "Customer",
              email: user?.email || "",
              stripe,
              card: elements?.getElement(CardElement) ?? null,
              onSuccess: () => navigate("/order-success"),
            });
          }}
          type="button"
          className={primaryButtonClass}
          disabled={
            loading ||
            !cart.items.length ||
            !selectedAddressId ||
            !stripe ||
            checkoutLoading ||
            pointsCheckoutLoading
          }
        >
          {checkoutLoading ? "Processing..." : "Pay with Card"}
        </Button>
        <Button
          onClick={() => {
            void startPointsCheckout({
              isSignedIn,
              onSuccess: () => navigate("/order-success"),
            });
          }}
          disabled={
            !(
              isSignedIn &&
              Boolean(selectedAddressId) &&
              Boolean(cart.items.length) &&
              points >= totalAmount &&
              !checkoutLoading &&
              !pointsCheckoutLoading
            )
          }
          type="button"
          className={primaryButtonClass}
        >
          {pointsCheckoutLoading ? "Processing..." : "Pay with Points"}
        </Button>
      </DrawerFooter>
    </>
  );
}

function CustomerCartAndCheckoutDrawer() {
  const { user, isBootstrapped } = useAuthStore((state) => state);
  const isSignedIn = !!user;
  const { isOpen, setOpen, loadCart } = useCustomerCartAndCheckoutStore((state) => state);

  useEffect(() => {
    if (!isOpen || !isBootstrapped) return;

    void loadCart(isSignedIn);
  }, [isBootstrapped, isOpen, isSignedIn, loadCart]);

  return (
    <Drawer open={isOpen} onOpenChange={setOpen}>
      <DrawerContent className={contentClass}>
        <div className={shellClass}>
          <div className={leftPaneClass}>
            <CustomerCartItems />
          </div>
          <aside className={rightPaneClass}>
            <div className={rightInnerClass}>
              <div className={panelClass}>
                <DrawerHeader className={panelHeaderClass}>
                  <DrawerTitle className={panelTitleClass}>Checkout</DrawerTitle>
                </DrawerHeader>

                {isSignedIn ? (
                  <Elements stripe={stripePromise}>
                    <CheckoutPanel />
                  </Elements>
                ) : (
                  <div className={bodyClass}>
                    <div className={infoBoxClass}>Sign in to continue to checkout</div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default CustomerCartAndCheckoutDrawer;
