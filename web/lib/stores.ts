// Demo config: change prices here. Prices are in USD dollars.
export type Store = {
  slug: string;
  name: string;
  tagline: string;
  price: number;
  listPrice?: number;
  sku: string;
  theme: {
    header: string; // header background
    headerText: string;
    accent: string; // buttons / price highlight
    accentText: string;
    page: string; // page background
    font: string;
  };
};

export const PRODUCT = {
  name: "AirPods Pro 2 (USB-C) Wireless Earbuds",
  brand: "Apple",
  description:
    "Active Noise Cancellation, Adaptive Audio, Transparency mode, Personalized Spatial Audio, and a MagSafe charging case with USB-C.",
};

export const STORES: Store[] = [
  {
    slug: "voltmart",
    name: "VoltMart",
    tagline: "Electronics, delivered fast",
    price: 229.0,
    listPrice: 249.0,
    sku: "VM-6541872",
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
    price: 209.0,
    listPrice: 249.0,
    sku: "RG-88213400",
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
    price: 189.0,
    listPrice: 249.0,
    sku: "DD-AP2-USBC",
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

export function getStore(slug: string): Store | undefined {
  return STORES.find((s) => s.slug === slug);
}
