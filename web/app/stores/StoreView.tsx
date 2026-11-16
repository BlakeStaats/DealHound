import type { Product, Store } from "@/lib/stores";
import AddToCart from "./[slug]/AddToCart";
import s from "./[slug]/store.module.css";

/** A believable retailer product page with schema.org Product JSON-LD (what the oracle reads). */
export default function StoreView({ store, product }: { store: Store; product: Product }) {
  const { price: priceNum, listPrice } = product.prices[store.slug];
  const price = priceNum.toFixed(2);
  const sku = `${store.sku}-${product.id.toUpperCase()}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    description: product.description,
    sku,
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

  const onSale = listPrice !== undefined && listPrice > priceNum;

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

      <div className={s.crumbs}>Home › {product.breadcrumb}</div>

      <main className={s.main}>
        <div className={s.image}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.name}
            style={{ maxWidth: "80%", maxHeight: "90%", objectFit: "contain" }}
          />
        </div>

        <section className={s.info}>
          <p className={s.brand}>{product.brand}</p>
          <h1 className={s.title}>{product.name}</h1>
          <p className={s.meta}>
            <span className={s.stars}>★★★★★</span> 4.8 (12,431 reviews) · SKU {sku}
          </p>

          <div className={s.priceBox}>
            <span className={s.price}>${price}</span>
            {onSale && (
              <span className={s.was}>
                Was ${listPrice.toFixed(2)} · <b>Save ${(listPrice - priceNum).toFixed(2)}</b>
              </span>
            )}
          </div>

          <p className={s.stock}>✓ In stock · Free shipping · Pickup today</p>
          <AddToCart />
          <p className={s.desc}>{product.description}</p>
          <p className={s.fine}>Sold and shipped by {store.name}. Demo storefront for DealHound.</p>
        </section>
      </main>
    </div>
  );
}
