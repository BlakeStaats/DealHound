import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCTS, STORES, getProduct, getStore } from "@/lib/stores";
import StoreView from "../../StoreView";

export function generateStaticParams() {
  return STORES.flatMap((st) => PRODUCTS.map((p) => ({ slug: st.slug, product: p.id })));
}

type Params = { params: Promise<{ slug: string; product: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, product: id } = await params;
  const store = getStore(slug);
  const product = getProduct(id);
  return { title: store && product ? `${product.name} | ${store.name}` : "Not found" };
}

export default async function StoreProductPage({ params }: Params) {
  const { slug, product: id } = await params;
  const store = getStore(slug);
  const product = getProduct(id);
  if (!store || !product) notFound();
  return <StoreView store={store} product={product} />;
}
