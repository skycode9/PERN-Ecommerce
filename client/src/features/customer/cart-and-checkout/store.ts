import { create } from "zustand";
import type { Stripe, StripeCardElement } from "@stripe/stripe-js";
import type {
  AddCustomerCartItemBody,
  AppliedPromo,
  CheckoutAddressOption,
  CustomerCartItemIdentifier,
  CustomerCartResponse,
  GuestCartItem,
  SyncCustomerCartBody,
} from "./types";
import {
  addCustomerCartItem,
  applyCustomerPromo,
  capturePaypalOrder,
  confirmCheckout,
  createCheckoutSession,
  createPaypalOrder,
  decreaseCustomerCartItem,
  getCheckoutData,
  increaseCustomerCartItem,
  payWithPointsCheckout,
  removeCustomerCartItem,
  syncCustomerCart,
} from "./api";
import { toast } from "sonner";

type AddCartItemInput = AddCustomerCartItemBody & {
  title: string;
  brand: string;
  image: string;
  finalPrice: number;
};

type StripeCheckoutArgs = {
  isSignedIn: boolean;
  name: string;
  email: string;
  stripe: Stripe | null;
  card: StripeCardElement | null;
  onSuccess: () => void;
};

type PaypalCreateArgs = {
  isSignedIn: boolean;
};

type PaypalCaptureArgs = {
  onSuccess: () => void;
};

type PointsArgs = {
  isSignedIn: boolean;
  onSuccess: () => void;
};

type CustomerCartAndCheckoutStore = {
  cart: CustomerCartResponse;
  isOpen: boolean;
  loading: boolean;
  addresses: CheckoutAddressOption[];
  selectedAddressId: string;
  promoInput: string;
  appliedPromo: AppliedPromo | null;
  points: number;
  promoLoading: boolean;
  checkoutLoading: boolean;
  pointsCheckoutLoading: boolean;
  paypalLoading: boolean;
  paypalPendingOrderId: string;
  setOpen: (value: boolean) => void;
  setCart: (cart: CustomerCartResponse) => void;
  loadCart: (isSignedIn: boolean) => Promise<void>;
  addItem: (item: AddCartItemInput, isSignedIn: boolean) => Promise<void>;
  increase: (item: CustomerCartItemIdentifier, isSignedIn: boolean) => Promise<void>;
  decrease: (item: CustomerCartItemIdentifier, isSignedIn: boolean) => Promise<void>;
  remove: (item: CustomerCartItemIdentifier, isSignedIn: boolean) => Promise<void>;
  setPromoInput: (value: string) => void;
  clearPromo: () => void;
  applyPromo: () => Promise<void>;
  startStripeCheckout: (args: StripeCheckoutArgs) => Promise<void>;
  startPointsCheckout: (args: PointsArgs) => Promise<void>;
  startPaypalCheckout: (args: PaypalCreateArgs) => Promise<string>;
  completePaypalCheckout: (args: PaypalCaptureArgs) => Promise<void>;
  cancelPaypalCheckout: () => void;
  clear: () => void;
};

const emptyCart: CustomerCartResponse = {
  items: [],
  totalQuantity: 0,
};

const defaultUiState = {
  loading: false,
  addresses: [] as CheckoutAddressOption[],
  selectedAddressId: "",
  promoInput: "",
  appliedPromo: null as AppliedPromo | null,
  points: 0,
  promoLoading: false,
  checkoutLoading: false,
  pointsCheckoutLoading: false,
  paypalLoading: false,
  paypalPendingOrderId: "",
};

// helpers

const GUEST_CART_KEY = "guest_cart_items";

function readGuestItems(): GuestCartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const items = JSON.parse(window.localStorage.getItem(GUEST_CART_KEY) || "[]");

    return Array.isArray(items)
      ? items.filter((currentItem) => currentItem?.productId && Number(currentItem?.quantity) > 0)
      : [];
  } catch {
    return [];
  }
}

function writeGuestItems(items: GuestCartItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

function clearGuestItems() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_CART_KEY);
}

function getGuestResponse(): CustomerCartResponse {
  const items = readGuestItems();

  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function getGuestSyncPayload(): SyncCustomerCartBody {
  return {
    items: readGuestItems().map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      color: item.color,
      size: item.size,
    })),
  };
}

function isSameItem(item: CustomerCartItemIdentifier, target: CustomerCartItemIdentifier) {
  return (
    item.productId === target.productId &&
    (item.color || "") === (target.color || "") &&
    (item.size || "") === (target.size || "")
  );
}

function addGuestItem(item: Omit<GuestCartItem, "quantity">) {
  const items = readGuestItems();
  const index = items.findIndex((cartItem) => isSameItem(cartItem, item));

  if (index >= 0) {
    items[index] = {
      ...items[index],
      quantity: items[index].quantity + 1,
    };
  } else {
    items.push({
      ...item,
      quantity: 1,
    });
  }

  writeGuestItems(items);

  return getGuestResponse();
}

function increaseGuestItem(item: CustomerCartItemIdentifier) {
  const items = readGuestItems().map((cartItem) =>
    isSameItem(cartItem, item) ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
  );

  writeGuestItems(items);

  return getGuestResponse();
}

function decreaseGuestItem(item: CustomerCartItemIdentifier) {
  const items = readGuestItems()
    .map((cartItem) =>
      isSameItem(cartItem, item) ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem,
    )
    .filter((cartItem) => cartItem.quantity > 0);

  writeGuestItems(items);

  return getGuestResponse();
}

function removeGuestItem(item: CustomerCartItemIdentifier) {
  const items = readGuestItems().filter((cartItem) => !isSameItem(cartItem, item));

  writeGuestItems(items);
  return getGuestResponse();
}

export const useCustomerCartAndCheckoutStore = create<CustomerCartAndCheckoutStore>((set, get) => ({
  cart: emptyCart,
  isOpen: false,
  ...defaultUiState,
  setOpen: (value) => set({ isOpen: value }),
  setCart: (cart) => set({ cart }),
  loadCart: async (isSignedIn) => {
    try {
      set({ loading: true });
      if (isSignedIn) {
        const guestPayload = getGuestSyncPayload();

        if (guestPayload.items.length) {
          const syncedCart = await syncCustomerCart(guestPayload);

          clearGuestItems();
          set({ cart: syncedCart ?? emptyCart });
        }

        const response = await getCheckoutData();
        const cart = response?.cart ?? emptyCart;
        const addresses = response?.addresses?.items ?? [];
        const defaultAddress = addresses.find((item) => item.isDefault) || addresses[0] || null;

        set({
          loading: false,
          cart,
          addresses,
          selectedAddressId: defaultAddress?.id ?? "",
          points: response?.points ?? 0,
        });

        return;
      }

      set({
        loading: false,
        cart: getGuestResponse(),
        addresses: [],
        selectedAddressId: "",
        points: 0,
      });
    } catch {
      set({
        loading: false,
        cart: isSignedIn ? emptyCart : getGuestResponse(),
      });
    }
  },
  addItem: async (item, isSignedIn) => {
    try {
      if (isSignedIn) {
        const response = await addCustomerCartItem({
          productId: item.productId,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
        });

        set({ cart: response ?? emptyCart });
      } else {
        set({
          cart: addGuestItem({
            productId: item.productId,
            title: item.title,
            brand: item.brand,
            color: item.color,
            image: item.image,
            finalPrice: item.finalPrice,
            size: item.size,
          }),
        });
      }

      toast.success("Added to cart");
    } catch {
      toast.error("Failed to add in cart");
    }
  },
  increase: async (item, isSignedIn) => {
    try {
      const response = isSignedIn ? await increaseCustomerCartItem(item) : increaseGuestItem(item);

      set({ cart: response ?? emptyCart });
      toast.success("Cart updated");
    } catch {
      toast.error("Failed to update cart");
    }
  },
  decrease: async (item, isSignedIn) => {
    try {
      const response = isSignedIn ? await decreaseCustomerCartItem(item) : decreaseGuestItem(item);

      set({ cart: response ?? emptyCart });
      toast.success("Cart updated");
    } catch {
      toast.error("Failed to update cart");
    }
  },
  remove: async (item, isSignedIn) => {
    try {
      const response = isSignedIn ? await removeCustomerCartItem(item) : removeGuestItem(item);

      set({ cart: response ?? emptyCart });
      toast.success("Cart item removed");
    } catch {
      toast.error("Failed to remove from cart");
    }
  },
  setPromoInput: (value) => set({ promoInput: value }),
  clearPromo: () => set({ promoInput: "", appliedPromo: null }),
  applyPromo: async () => {
    const { promoInput, cart } = get();

    const subtotal = cart.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);

    if (!promoInput.trim()) {
      set({ appliedPromo: null });
      return;
    }

    try {
      set({ promoLoading: true });
      const response = await applyCustomerPromo({
        code: promoInput.trim(),
        orderValue: subtotal,
      });

      if (!response?.code) {
        set({ appliedPromo: null, promoLoading: false });
        return;
      }

      set({
        appliedPromo: response,
        promoInput: response.code,
        promoLoading: false,
      });

      toast.success("Promo successfully applied");
    } catch {
      set({ appliedPromo: null, promoLoading: false });
      toast.error("Unable to apply promo");
    }
  },
  clear: () =>
    set({
      cart: emptyCart,
      isOpen: false,
      ...defaultUiState,
    }),

  startStripeCheckout: async ({ isSignedIn, name, email, stripe, card, onSuccess }) => {
    const { selectedAddressId, appliedPromo, cart } = get();

    if (!isSignedIn) {
      toast.error("sign in to checkout");
      return;
    }

    if (!selectedAddressId) {
      toast.error("Add a default address from profile section");
      return;
    }

    if (!cart.items.length) {
      toast.error("Your cart is empty");
      return;
    }

    if (!stripe || !card) {
      toast.error("Payment form is not ready");
      return;
    }

    try {
      set({ checkoutLoading: true });

      const session = await createCheckoutSession({
        addressId: selectedAddressId,
        promoCode: appliedPromo?.code || undefined,
      });

      if (!session.stripe?.clientSecret || !session.order.id) {
        throw new Error("Invalid checkout session");
      }

      const result = await stripe.confirmCardPayment(session.stripe.clientSecret, {
        payment_method: {
          card,
          billing_details: { name, email },
        },
      });

      if (result.error || result.paymentIntent?.status !== "succeeded") {
        throw new Error(result.error?.message || "Payment failed");
      }

      const confirmed = await confirmCheckout({
        orderId: session.order.id,
        paymentIntentId: session.stripe.paymentIntentId,
      });

      if (!confirmed.id) {
        throw new Error("Order confirmation failed");
      }

      set({
        cart: emptyCart,
        isOpen: false,
        ...defaultUiState,
      });

      toast.success("Payment successful");
      onSuccess();
    } catch (error) {
      set({ checkoutLoading: false });
      toast.error(error instanceof Error ? error.message : "Unable to complete payment");
    }
  },

  // returns the PayPal order id that the PayPal buttons need to open the approval popup
  startPaypalCheckout: async ({ isSignedIn }) => {
    const { selectedAddressId, appliedPromo, cart } = get();

    if (!isSignedIn) {
      toast.error("sign in to checkout");
      throw new Error("Not signed in");
    }

    if (!selectedAddressId) {
      toast.error("Add a default address from profile section");
      throw new Error("Missing address");
    }

    if (!cart.items.length) {
      toast.error("Your cart is empty");
      throw new Error("Cart is empty");
    }

    try {
      set({ paypalLoading: true });

      const response = await createPaypalOrder({
        addressId: selectedAddressId,
        promoCode: appliedPromo?.code || undefined,
      });

      if (!response.paypal?.orderId || !response.order.id) {
        throw new Error("Unable to start PayPal checkout");
      }

      set({ paypalPendingOrderId: response.order.id });

      return response.paypal.orderId;
    } catch (error) {
      set({ paypalLoading: false, paypalPendingOrderId: "" });
      toast.error(error instanceof Error ? error.message : "Unable to start PayPal checkout");
      throw error;
    }
  },

  completePaypalCheckout: async ({ onSuccess }) => {
    const { paypalPendingOrderId } = get();

    if (!paypalPendingOrderId) {
      toast.error("PayPal order not found");
      return;
    }

    try {
      const confirmed = await capturePaypalOrder({ orderId: paypalPendingOrderId });

      if (!confirmed.id) {
        throw new Error("Order confirmation failed");
      }

      set({
        cart: emptyCart,
        isOpen: false,
        ...defaultUiState,
      });

      toast.success("Payment successful");
      onSuccess();
    } catch (error) {
      set({ paypalLoading: false });
      toast.error(error instanceof Error ? error.message : "Unable to complete payment");
    }
  },

  cancelPaypalCheckout: () => set({ paypalLoading: false, paypalPendingOrderId: "" }),

  startPointsCheckout: async ({ isSignedIn, onSuccess }) => {
    const { selectedAddressId, appliedPromo, points, cart } = get();

    const subTotal = cart.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);

    const discountAmount = appliedPromo
      ? Math.round((subTotal * appliedPromo.percentage) / 100)
      : 0;

    const totalAmount = Math.max(subTotal - discountAmount, 0);

    if (!isSignedIn) {
      toast.error("sign in to checkout");
      return;
    }

    if (!selectedAddressId) {
      toast.error("Add a default address from profile section");
      return;
    }

    if (!cart.items.length) {
      toast.error("Your cart is empty");
      return;
    }

    if (points < totalAmount) {
      toast.error("Not enough points");
      return;
    }

    try {
      set({ pointsCheckoutLoading: true });

      const response = await payWithPointsCheckout({
        addressId: selectedAddressId,
        promoCode: appliedPromo?.code || undefined,
      });

      if (!response.id) {
        throw new Error("Unable to place order");
      }

      set({
        cart: emptyCart,
        isOpen: false,
        ...defaultUiState,
        points: response.totalPoints ?? Math.max(points - totalAmount, 0),
      });

      toast.success("Order placed");
      onSuccess();
    } catch {
      set({ pointsCheckoutLoading: false });
      toast.error("Failed to place order with points");
    }
  },
}));
