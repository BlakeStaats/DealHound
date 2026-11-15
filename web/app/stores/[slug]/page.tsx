import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCT, STORES, getStore } from "@/lib/stores";
import AddToCart from "./AddToCart";
import s from "./store.module.css";

export function generateStaticParams() {
  return STORES.map((st) => ({ slug: st.slug }));
}

type StoreParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: StoreParams): Promise<Metadata> {
  const store = getStore((await params).slug);
  return { title: store ? `${PRODUCT.name} | ${store.name}` : "Not found" };
}

export default async function StorePage({ params }: StoreParams) {
  const store = getStore((await params).slug);
  if (!store) notFound();

  const price = store.price.toFixed(2);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: PRODUCT.name,
    brand: { "@type": "Brand", name: PRODUCT.brand },
    description: PRODUCT.description,
    sku: store.sku,
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: store.name },
    },
  };

  const t = store.theme;
  const vars = {
    "--header": t.header,
    "--header-text": t.headerText,
    "--accent": t.accent,
    "--accent-text": t.accentText,
    "--page": t.page,
    fontFamily: t.font,
  } as React.CSSProperties;

  const save = store.listPrice ? store.listPrice - store.price : 0;

  return (
    <div className={s.root} style={vars}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <meta itemProp="price" content={price} />
      <meta itemProp="priceCurrency" content="USD" />

      <header className={s.header}>
        <div className={s.logo}>
          <span className={s.logoMark}>{store.name[0]}</span>
          <span>
            <strong>{store.name}</strong>
            <small>{store.tagline}</small>
          </span>
        </div>
        <div className={s.search}>Search {store.name}…</div>
        <nav className={s.nav}>
          <span>Account</span>
          <span>Cart (0)</span>
        </nav>
      </header>

      <div className={s.crumbs}>Home › Audio › Headphones › Wireless Earbuds</div>

      <main className={s.main}>
        <div className={s.image} aria-label="Product image placeholder">
          <svg viewBox="0 0 200 160" width="70%" role="img" aria-hidden="true">
            <rect x="40" y="50" width="120" height="90" rx="40" fill="#fff" stroke="#d4d4d8" strokeWidth="3" />
            <line x1="44" y1="82" x2="156" y2="82" stroke="#d4d4d8" strokeWidth="2" />
            <circle cx="100" cy="112" r="4" fill="#a1a1aa" />
            <ellipse cx="75" cy="30" rx="14" ry="18" fill="#fff" stroke="#d4d4d8" strokeWidth="3" />
            <ellipse cx="125" cy="30" rx="14" ry="18" fill="#fff" stroke="#d4d4d8" strokeWidth="3" />
          </svg>
        </div>

        <section className={s.info}>
          <p className={s.brand}>{PRODUCT.brand}</p>
          <h1 className={s.title}>{PRODUCT.name}</h1>
          <p className={s.meta}>
            <span className={s.stars}>★★★★★</span> 4.8 (12,431 reviews) · SKU {store.sku}
          </p>

          <div className={s.priceBox}>
            <span className={s.price}>${price}</span>
            {store.listPrice && (
              <span className={s.was}>
                Was ${store.listPrice.toFixed(2)} · <b>Save ${save.toFixed(2)}</b>
              </span>
            )}
          </div>

          <p className={s.stock}>✓ In stock · Free shipping · Pickup today</p>
          <AddToCart />
          <p className={s.desc}>{PRODUCT.description}</p>
          <p className={s.fine}>Sold and shipped by {store.name}. Demo storefront for MonadFLIP.</p>
        </section>
      </main>
    </div>
  );
}
