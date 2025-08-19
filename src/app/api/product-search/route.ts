import { NextRequest, NextResponse } from "next/server";
import { fetchProducts, ShopifyProduct } from "@/lib/shopify";
import Fuse from "fuse.js";

type Body = {
  storeDomain: string;
  adminToken: string;
  queries: Array<{ name: string; qty?: number }>;
};

export async function POST(req: NextRequest) {
  try {
    const { storeDomain, adminToken, queries } = (await req.json()) as Body;
    const products = await fetchProducts({ storeDomain, adminToken });

    const fuse = new Fuse<ShopifyProduct>(products, {
      keys: ["title"],
      threshold: 0.4, // fuzzy
      includeScore: true,
    });

    const matches = queries.map((q) => {
      const res = fuse.search(q.name)[0];
      if (!res) return { requested: q, matched: null };
      // choose first variant (you can improve with more logic later)
      const variant = res.item.variants[0];
      return {
        requested: q,
        matched: {
          productTitle: res.item.title,
          variantId: variant.id,
          price: Number(variant.price),
          qty: q.qty ?? 1,
        },
      };
    });

    return NextResponse.json({ matches });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}