export type CustomerHomeBanner = {
  id: string;
  imageUrl: string;
  createdAt: string;
};

export type CustomerHomeCategory = {
  id: string;
  name: string;
};

export type CustomerHomeProduct = {
  id: string;
  title: string;
  brand: string;
  image: string;
  price: number;
  finalPrice: number;
  salePercentage: number;
  createdAt: string;
};

export type CustomerHomeCoupon = {
  id: string;
  code: string;
  percentage: number;
  count: number;
  minimumOrderValue: number;
  endsAt: string;
};

export type CustomerHomeResponse = {
  banners: CustomerHomeBanner[];
  categories: CustomerHomeCategory[];
  recentProducts: CustomerHomeProduct[];
  coupons: CustomerHomeCoupon[];
};
