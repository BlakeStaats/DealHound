import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_PRODUCT_ID, STORES, getProduct, getStore } from "@/lib/stores";
import StoreView from "../StoreView";

// /stores/<store> = the AirPods page (kept so older links and Deal Proof NFTs still resolve).
const product = getProduct(DEFAULT_PRODUCT_ID)!;

export function generateStaticParams() {
  return STORES.map((st) => ({ slug: st.slug }));
}

type StoreParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: StoreParams): Promise<Metadata> {
  const store = getStore((await params).slug);
  return { title: store ? `${product.name} | ${store.name}` : "Not found" };
}

export default async function StorePage({ params }: StoreParams) {
  const store = getStore((await params).slug);
  if (!store) notFound();
  return <StoreView store={store} product={product} />;
}
