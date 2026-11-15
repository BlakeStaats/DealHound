// Demo config: change products and prices here. Prices are in USD dollars.
//
// Each store sells every product. URLs:
//   /stores/<store>/<product>   e.g. /stores/dealdepot/ps5-slim
//   /stores/<store>             = the AirPods page (kept for older links / NFTs)

export type Store = {
  slug: string;
  name: string;
  tagline: string;
  sku: string; // SKU prefix
  theme: {
    header: string; // header background
    headerText: string;
    accent: string; // buttons / price highlight
    accentText: string;
    page: string; // page background
    font: string;
  };
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  description: string;
  emoji: string; // image placeholder
  breadcrumb: string;
  /** price per store slug; listPrice is the struck-through "was" price */
  prices: Record<string, { price: number; listPrice?: number }>;
};

export const STORES: Store[] = [
  {
    slug: "voltmart",
    name: "VoltMart",
    tagline: "Electronics, delivered fast",
    sku: "VM",
    theme: {
      header: "#0b1f4d",
      headerText: "#ffffff",
      accent: "#c6f432",
      accentText: "#0b1f4d",
      page: "#f3f5f9",
      font: "'Helvetica Neue', Arial, sans-serif",
    },
  },
  {
    slug: "redline",
    name: "Redline Goods",
    tagline: "Expect more. Spend less.",
    sku: "RG",
    theme: {
      header: "#ffffff",
      headerText: "#b3001b",
      accent: "#b3001b",
      accentText: "#ffffff",
      page: "#ffffff",
      font: "Georgia, 'Times New Roman', serif",
    },
  },
  {
    slug: "dealdepot",
    name: "DealDepot",
    tagline: "Rock-bottom prices, every day",
    sku: "DD",
    theme: {
      header: "#14532d",
      headerText: "#fef3c7",
      accent: "#f97316",
      accentText: "#ffffff",
      page: "#fffbeb",
      font: "Verdana, Geneva, sans-serif",
    },
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "airpods-pro-2",
    name: "AirPods Pro 2 (USB-C) Wireless Earbuds",
    brand: "Apple",
    description:
      "Active Noise Cancellation, Adaptive Audio, Transparency mode, Personalized Spatial Audio, and a MagSafe charging case with USB-C.",
    emoji: "🎧",
    breadcrumb: "Audio › Headphones › Wireless Earbuds",
    prices: {
      voltmart: { price: 229.0, listPrice: 249.0 },
      redline: { price: 209.0, listPrice: 249.0 },
      dealdepot: { price: 189.0, listPrice: 249.0 },
    },
  },
  {
    id: "air-jordan-1",
    name: "Nike Air Jordan 1 Retro High OG Sneakers",
    brand: "Nike",
    description:
      "The original high-top silhouette in premium leather with an encapsulated Air unit and the classic Wings logo.",
    emoji: "👟",
    breadcrumb: "Shoes › Men's Sneakers › Basketball",
    prices: {
      voltmart: { price: 189.0, listPrice: 180.0 },
      redline: { price: 172.0, listPrice: 180.0 },
      dealdepot: { price: 154.0, listPrice: 180.0 },
    },
  },
  {
    id: "dyson-v15",
    name: "Dyson V15 Detect Cordless Vacuum",
    brand: "Dyson",
    description:
      "Laser dust detection, piezo particle sensor with on-screen counts, and up to 60 minutes of fade-free runtime.",
    emoji: "🧹",
    breadcrumb: "Appliances › Floor Care › Cordless Vacuums",
    prices: {
      voltmart: { price: 749.99, listPrice: 749.99 },
      redline: { price: 699.0, listPrice: 749.99 },
      dealdepot: { price: 629.0, listPrice: 749.99 },
    },
  },
  {
    id: "ps5-slim",
    name: "PlayStation 5 Slim Console",
    brand: "Sony",
    description:
      "1TB SSD, ultra-high-speed loading, haptic feedback and adaptive triggers on the DualSense controller.",
    emoji: "🎮",
    breadcrumb: "Gaming › Consoles › PlayStation",
    prices: {
      voltmart: { price: 499.99, listPrice: 499.99 },
      redline: { price: 474.0, listPrice: 499.99 },
      dealdepot: { price: 449.0, listPrice: 499.99 },
    },
  },
];

export const DEFAULT_PRODUCT_ID = "airpods-pro-2";

export function getStore(slug: string): Store | undefined {
  return STORES.find((s) => s.slug === slug);
}

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function storePath(storeSlug: string, productId: string): string {
  return `/stores/${storeSlug}/${productId}`;
}
