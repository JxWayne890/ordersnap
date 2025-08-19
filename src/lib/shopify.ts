// src/lib/shopify.ts
export type ShopifyCreds = { storeDomain: string; adminToken: string };

const base = ({ storeDomain }: ShopifyCreds) =>
  `https://${storeDomain}/admin/api/2024-10`;

const headers = ({ adminToken }: ShopifyCreds) => ({
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": adminToken,
});

export async function fetchProducts(creds: ShopifyCreds, pageLimit = 250) {
  const res = await fetch(`${base(creds)}/products.json?limit=${pageLimit}`, {
    headers: headers(creds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Product fetch failed: ${res.statusText}`);
  const data = await res.json();
  return data.products as Array<{
    id: number;
    title: string;
    variants: Array<{ id: number; title: string; price: string }>;
  }>;
}

export async function createDraftOrder(
  creds: ShopifyCreds,
  payload: any // expects { draft_order: { line_items:[], email?, note? } }
) {
  const res = await fetch(`${base(creds)}/draft_orders.json`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create draft failed: ${res.statusText}`);
  return res.json(); // { draft_order: {...} }
}

export async function sendInvoice(creds: ShopifyCreds, draftOrderId: number, subject?: string, customMessage?: string) {
  const res = await fetch(
    `${base(creds)}/draft_orders/${draftOrderId}/send_invoice.json`,
    {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify({
        draft_order_invoice: {
          to: null, // Shopify uses customer email on draft
          subject,
          custom_message: customMessage,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Send invoice failed: ${res.statusText}`);
  return res.json();
}