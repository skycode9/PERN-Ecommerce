import "dotenv/config";
import prisma from "../src/db";
import { hashPassword } from "../src/utils/auth";
import type { ProductSize } from "../src/generated/prisma/enums";

const DEMO_PASSWORD = "DemoPass123";
const DEMO_CUSTOMER_EMAIL = "demo@example.com";
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "admin.demo@example.com";

// crop=faces,entropy keeps people and the busiest part of the photo when it is cut to size
function unsplash(id: string, size = "w=900") {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=faces,entropy&${size}&q=80`;
}

type SeedProduct = {
  title: string;
  brand: string;
  category: string;
  price: number;
  salePercentage?: number;
  stock: number;
  colors: string[];
  sizes: ProductSize[];
  image: string;
  description: string;
};

const categories = ["T-Shirts", "Hoodies", "Jeans", "Jackets", "Accessories"];

const products: SeedProduct[] = [
  {
    title: "Essential Crew Tee",
    brand: "Uniqlo",
    category: "T-Shirts",
    price: 25,
    stock: 120,
    colors: ["#ffffff", "#111827"],
    sizes: ["S", "M", "L", "XL"],
    image: "1521572163474-6864f9cf17ab",
    description: "Soft cotton crew neck tee with a relaxed everyday fit.",
  },
  {
    title: "Heavyweight Pocket Tee",
    brand: "H&M",
    category: "T-Shirts",
    price: 32,
    salePercentage: 15,
    stock: 80,
    colors: ["#1f2937", "#78716c"],
    sizes: ["M", "L", "XL"],
    image: "1503341504253-dff4815485f1",
    description: "Thick 240gsm cotton with a chest pocket and boxy cut.",
  },
  {
    title: "Graphic Street Tee",
    brand: "Zara",
    category: "T-Shirts",
    price: 29,
    stock: 60,
    colors: ["#111827"],
    sizes: ["S", "M", "L"],
    image: "1576566588028-4147f3842f27",
    description: "Printed street tee, pre-washed so it does not shrink.",
  },
  {
    title: "Classic Pullover Hoodie",
    brand: "Nike",
    category: "Hoodies",
    price: 59,
    stock: 70,
    colors: ["#6b7280", "#111827"],
    sizes: ["S", "M", "L", "XL"],
    image: "1556821840-3a63f95609a7",
    description: "Brushed fleece hoodie with a kangaroo pocket.",
  },
  {
    title: "Oversized Fleece Hoodie",
    brand: "Adidas",
    category: "Hoodies",
    price: 68,
    salePercentage: 20,
    stock: 45,
    colors: ["#d6d3d1", "#1e3a8a"],
    sizes: ["M", "L", "XL"],
    image: "1620799140408-edc6dcb6d633",
    description: "Dropped shoulders and a roomy fit for colder days.",
  },
  {
    title: "Slim Fit Denim",
    brand: "Levi's",
    category: "Jeans",
    price: 74,
    stock: 90,
    colors: ["#1e3a8a"],
    sizes: ["S", "M", "L", "XL"],
    image: "1542272604-787c3835535d",
    description: "Stretch denim with a slim leg and a mid rise.",
  },
  {
    title: "Relaxed Straight Jeans",
    brand: "Calvin Klein",
    category: "Jeans",
    price: 79,
    stock: 50,
    colors: ["#60a5fa", "#1e3a8a"],
    sizes: ["M", "L", "XL"],
    image: "1541099649105-f69ad21f3246",
    description: "Straight leg jeans in a light vintage wash.",
  },
  {
    title: "Leather Biker Jacket",
    brand: "Zara",
    category: "Jackets",
    price: 189,
    salePercentage: 10,
    stock: 20,
    colors: ["#111827"],
    sizes: ["M", "L", "XL"],
    image: "1551028719-00167b16eac5",
    description: "Faux leather biker jacket with an asymmetric zip.",
  },
  {
    title: "Utility Field Jacket",
    brand: "Tommy Hilfiger",
    category: "Jackets",
    price: 129,
    stock: 35,
    colors: ["#57534e", "#365314"],
    sizes: ["S", "M", "L", "XL"],
    image: "1591047139829-d91aecb6caea",
    description: "Water resistant cotton shell with four utility pockets.",
  },
  {
    title: "Runner Sneakers",
    brand: "Nike",
    category: "Accessories",
    price: 110,
    stock: 40,
    colors: ["#dc2626"],
    sizes: [],
    image: "1542291026-7eec264c27ff",
    description: "Lightweight everyday runners with a cushioned sole.",
  },
  {
    title: "Canvas Daypack",
    brand: "Puma",
    category: "Accessories",
    price: 64,
    stock: 55,
    colors: ["#78716c"],
    sizes: [],
    image: "1553062407-98eeb64c6a62",
    description: "20L canvas backpack with a padded laptop sleeve.",
  },
  {
    title: "Baseball Cap",
    brand: "Adidas",
    category: "Accessories",
    price: 22,
    stock: 150,
    colors: ["#111827", "#ffffff"],
    sizes: [],
    image: "1588850561407-ed78c282e89b",
    description: "Six panel cotton cap with an adjustable strap.",
  },
];

// the home page shows the newest banner as the large one and the next two on the side,
// so they are listed main first and given descending timestamps below
const banners = [
  { id: "1673275825702-44d27a1d4e7f", size: "w=1600&h=1100" },
  { id: "1729487151777-b4be9098ecbb", size: "w=1200&h=640" },
  { id: "1700150607117-ebff107cbe2b", size: "w=1200&h=640" },
];

async function upsertUser(email: string, name: string, role: "user" | "admin", points: number) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, points },
    create: { email, name, passwordHash, role, points },
  });
}

async function main() {
  const admin = await upsertUser(DEMO_ADMIN_EMAIL, "Demo Admin", "admin", 0);
  const customer = await upsertUser(DEMO_CUSTOMER_EMAIL, "Demo Customer", "user", 5000);

  const hasAddress = await prisma.address.count({ where: { userId: customer.id } });

  if (!hasAddress) {
    await prisma.address.create({
      data: {
        userId: customer.id,
        fullName: "Demo Customer",
        address: "221B Baker Street",
        state: "London",
        postalCode: "NW16XE",
        isDefault: true,
      },
    });
  }

  const categoryIds = new Map<string, string>();

  for (const name of categories) {
    const existing = await prisma.category.findFirst({ where: { name } });
    const category = existing ?? (await prisma.category.create({ data: { name } }));
    categoryIds.set(name, category.id);
  }

  for (const item of products) {
    const existing = await prisma.product.findFirst({ where: { title: item.title } });

    const data = {
      title: item.title,
      brand: item.brand,
      description: item.description,
      price: item.price,
      salePercentage: item.salePercentage ?? 0,
      stock: item.stock,
      colors: item.colors,
      sizes: item.sizes,
      status: "active" as const,
      images: [{ url: unsplash(item.image), publicId: `seed/${item.image}`, isCover: true }],
      categoryId: categoryIds.get(item.category)!,
      createdById: admin.id,
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data });
    }
  }

  const seedPublicIds = banners.map((banner) => `seed/${banner.id}`);

  await prisma.banner.deleteMany({
    where: { imagePublicId: { startsWith: "seed/", notIn: seedPublicIds } },
  });

  const now = Date.now();

  for (const [index, banner] of banners.entries()) {
    const imagePublicId = `seed/${banner.id}`;
    const imageUrl = unsplash(banner.id, banner.size);
    const createdAt = new Date(now - index * 60_000);
    const existing = await prisma.banner.findFirst({ where: { imagePublicId } });

    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data: { imageUrl, createdAt } });
    } else {
      await prisma.banner.create({
        data: { imageUrl, imagePublicId, createdAt, createdById: admin.id },
      });
    }
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 1000 * 60 * 60 * 24 * 365);

  await prisma.promo.upsert({
    where: { code: "WELCOME10" },
    update: { count: 1000, startsAt, endsAt },
    create: {
      code: "WELCOME10",
      percentage: 10,
      count: 1000,
      minimumOrderValue: 50,
      startsAt,
      endsAt,
    },
  });

  console.log(`seeded ${products.length} products, ${categories.length} categories`);
  console.log(`customer: ${DEMO_CUSTOMER_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`admin (read-only): ${DEMO_ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
