// Product sectors for the marketplace category nav (Polymarket-style).
// Bounties don't store a category on-chain, so we classify by the item name.

export type Sector = {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
};

export const SECTORS: Sector[] = [
  {
    id: "tech",
    label: "Technology",
    icon: "💻",
    keywords: [
      "airpod", "iphone", "ipad", "macbook", "mac", "laptop", "headphone", "earbud",
      "phone", "pixel", "galaxy", "tablet", "gpu", "rtx", "ssd", "monitor", "tv",
      "camera", "watch", "speaker", "drone", "keyboard", "router", "kindle",
    ],
  },
  {
    id: "apparel",
    label: "Clothing & Apparel",
    icon: "👕",
    keywords: [
      "shirt", "tee", "jacket", "shoe", "sneaker", "hoodie", "jeans", "dress",
      "boot", "coat", "apparel", "clothing", "hat", "cap", "sock", "nike",
      "adidas", "jordan", "pants", "sweater",
    ],
  },
  {
    id: "home",
    label: "Home & Kitchen",
    icon: "🏠",
    keywords: [
      "vacuum", "blender", "mattress", "sofa", "chair", "desk", "lamp", "cookware",
      "pan", "pot", "fridge", "kitchen", "furniture", "dyson", "airfryer", "air fryer",
    ],
  },
  {
    id: "gaming",
    label: "Gaming",
    icon: "🎮",
    keywords: [
      "playstation", "ps5", "ps4", "xbox", "nintendo", "switch", "game", "controller",
      "steam deck", "steamdeck",
    ],
  },
  {
    id: "beauty",
    label: "Beauty & Health",
    icon: "💄",
    keywords: ["perfume", "cologne", "makeup", "skincare", "serum", "shampoo", "vitamin", "lotion"],
  },
];

export const OTHER: Sector = { id: "other", label: "Other", icon: "🏷️", keywords: [] };

/** Classify an item name into a sector (falls back to "Other"). */
export function classifyCategory(item: string): Sector {
  const t = item.toLowerCase();
  for (const sec of SECTORS) {
    if (sec.keywords.some((k) => t.includes(k))) return sec;
  }
  return OTHER;
}
