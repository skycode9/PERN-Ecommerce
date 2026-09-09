export type AdminBanner = {
  id: string;
  imageUrl: string;
  imagePublicId: string;
  createdAt: string;
};

export type AdminBannersResponse = {
  items: AdminBanner[];
};
