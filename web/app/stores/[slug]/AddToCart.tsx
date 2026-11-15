"use client";

import { useState } from "react";
import s from "./store.module.css";

export default function AddToCart() {
  const [added, setAdded] = useState(false);
  return (
    <button className={s.cart} onClick={() => setAdded(true)}>
      {added ? "✓ Added to cart" : "Add to cart"}
    </button>
  );
}
