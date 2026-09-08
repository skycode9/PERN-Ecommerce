import { create } from "zustand";
import type { CustomerProduct, CustomerProductDetailsResponse, ProductSize } from "../types";
import { getCustomerProductDetails } from "../api";
import { getCoverImage } from "../product-list.shared";
import { toast } from "sonner";
import { addCustomerWishlist, removeCustomerWishlistItem } from "../../wishlist/api";
import { useCustomerWishlistStore } from "../../wishlist/store";

const GUEST_CART_KEY = "guest_cart_items";

type GuestCartItem = {
  productId: string;
  title: string;
  brand: string;
  image: string;
  finalPrice: number;
  color?: string;
  size?: string;
  quantity: number;
};

function readGuestItems(): GuestCartItem[] {
  try {
    const items = JSON.parse(window.localStorage.getItem(GUEST_CART_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function addGuestItem(item: Omit<GuestCartItem, "quantity">) {
  const items = readGuestItems();
  const index = items.findIndex(
    (cartItem) =>
      cartItem.productId === item.productId &&
      (cartItem.color || "") === (item.color || "") &&
      (cartItem.size || "") === (item.size || ""),
  );

  if (index >= 0) {
    items[index] = { ...items[index], quantity: items[index].quantity + 1 };
  } else {
    items.push({ ...item, quantity: 1 });
  }

  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

function priceAfterSale(product: CustomerProduct) {
  return product.salePercentage
    ? product.price - (product.price * product.salePercentage) / 100
    : product.price;
}

type CustomerProductDetailsStore = {
  loading: boolean;
  data: CustomerProductDetailsResponse | null;
  selectedImage: string;
  selectedColor: string;
  selectedSize: ProductSize | "";
  loadProduct: (productId: string) => Promise<void>;
  clear: () => void;
  setSelectedImage: (value: string) => void;
  setSelectedColor: (value: string) => void;
  setSelectedSize: (value: ProductSize | "") => void;
  addToCart: (isBootstrapped: boolean, isSignedIn: boolean) => Promise<void>;
  toggleWishlist: (
    isBootstrapped: boolean,
    isSignedIn: boolean,
    isWishlistActive: boolean,
  ) => Promise<void>;
};

const defaultState = {
  loading: true,
  data: null,
  selectedImage: "",
  selectedColor: "",
  selectedSize: "" as ProductSize | "",
};

export const useCustomerProductDetailsStore = create<CustomerProductDetailsStore>((set, get) => ({
  ...defaultState,
  loadProduct: async (productId) => {
    if (!productId) {
      set({
        loading: false,
        data: null,
        selectedImage: "",
        selectedColor: "",
        selectedSize: "",
      });
    }

    set({
      loading: true,
      data: null,
      selectedImage: "",
      selectedColor: "",
      selectedSize: "",
    });

    try {
      const response = await getCustomerProductDetails(productId);
      const product = response?.product ?? null;

      set({
        loading: false,
        data: response ?? null,
        selectedImage: product ? getCoverImage(product) : "",
        selectedColor: product?.colors?.[0] || "",
        selectedSize: product?.sizes?.[0] || "",
      });
    } catch {
      set({
        loading: false,
        data: null,
        selectedImage: "",
        selectedColor: "",
        selectedSize: "",
      });
    }
  },

  clear: () => set(defaultState),
  setSelectedImage: (value) => set({ selectedImage: value }),
  setSelectedColor: (value) => set({ selectedColor: value }),
  setSelectedSize: (value) => set({ selectedSize: value }),
  toggleWishlist: async (isBootstrapped, isSignedIn, isWishlistActive) => {
    const product = get().data?.product ?? null;

    if (!product) return;

    if (!isBootstrapped || !isSignedIn) {
      toast.error("Sign in to save");
      return;
    }

    try {
      if (isWishlistActive) {
        const response = await removeCustomerWishlistItem(product.id);
        useCustomerWishlistStore.getState().setItems(response?.items ?? []);
        toast.success("Removed");
        return;
      }

      const response = await addCustomerWishlist({ productId: product.id });
      useCustomerWishlistStore.getState().setItems(response?.items ?? []);
      toast.success("Saved");
    } catch {
      toast.error("Failed to toggle wishlist items");
    }
  },
  addToCart: async (isBootstrapped) => {
    const { data, selectedColor, selectedSize } = get();
    const product = data?.product ?? null;

    if (!product || product.stock < 1) return;

    if (!isBootstrapped) {
      toast.error("Try again");
      return;
    }

    addGuestItem({
      productId: product.id,
      title: product.title,
      brand: product.brand,
      image: getCoverImage(product),
      finalPrice: priceAfterSale(product),
      color: selectedColor || undefined,
      size: selectedSize || undefined,
    });

    toast.success("Added to cart");
  },
}));
