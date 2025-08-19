"use client";

import { useState } from "react";

type Match = {
  requested: { name: string; qty?: number };
  matched: null | {
    productTitle: string;
    variantId: number;
    price: number;
    qty: number;
  };
};

function parseProductLines(input: string): Array<{ name: string; qty?: number }> {
  // Accepts: "Widget", "Widget x2", "2x Widget", "Widget - 3", or comma/line-separated
  return input
    .split(/\r?\n|,/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(line => {
      const xFront = line.match(/^(\d+)\s*x\s*(.+)$/i);
      if (xFront) return { name: xFront[2].trim(), qty: Number(xFront[1]) };

      const xBack = line.match(/^(.+?)\s*x\s*(\d+)$/i);
      if (xBack) return { name: xBack[1].trim(), qty: Number(xBack[2]) };

      const dash = line.match(/^(.+?)\s*[-:]\s*(\d+)$/);
      if (dash) return { name: dash[1].trim(), qty: Number(dash[2]) };

      return { name: line, qty: 1 };
    });
}

export default function Home() {
  // Store credentials (MVP: typed each time; later: persist securely)
  const [storeDomain, setStoreDomain] = useState("");
  const [adminToken, setAdminToken] = useState("");

  // Customer + products
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [productsInput, setProductsInput] = useState("");

  // Flow state
  const [loading, setLoading] = useState<null | "search" | "create">(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [emailSubject, setEmailSubject] = useState("Your invoice from OrderSnap");
  const [emailBody, setEmailBody] = useState("Thanks! Your invoice is attached.");

  async function handleSearch() {
    setToast(null);
    setMatches(null);
    setLoading("search");
    try {
      const queries = parseProductLines(productsInput);
      const res = await fetch("/api/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeDomain, adminToken, queries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Product search failed");
      setMatches(data.matches);
    } catch (e: any) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setLoading(null);
    }
  }

  function updateQty(idx: number, qty: number) {
    if (!matches) return;
    const next = [...matches];
    const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
    if (next[idx].matched) {
      next[idx] = {
        ...next[idx],
        matched: { ...next[idx].matched!, qty: safeQty },
      };
    } else {
      next[idx] = {
        ...next[idx],
        requested: { ...next[idx].requested, qty: safeQty },
      };
    }
    setMatches(next);
  }

  async function handleCreateDraft() {
    if (!matches) return;
    setToast(null);
    setLoading("create");
    try {
      const lineItems = matches
        .filter(m => m.matched)
        .map(m => ({
          variant_id: m.matched!.variantId,
          quantity: m.matched!.qty,
          // price optional; if omitted, Shopify uses variant price
        }));

      if (lineItems.length === 0) throw new Error("No matched products to add.");

      const res = await fetch("/api/draft-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeDomain,
          adminToken,
          customerName,
          customerEmail,
          lineItems,
          emailSubject,
          emailBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft order creation failed");

      setToast({ type: "success", msg: `Draft #${data.draftOrderId} created and invoice sent.` });
    } catch (e: any) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">OrderSnap — Draft Orders in a Snap</h1>
          <p className="text-sm text-gray-600">Connect your Shopify store, match products, create a draft, and email the invoice.</p>
        </header>

        {/* Credentials */}
        <section className="bg-white rounded-xl shadow p-5 mb-6">
          <h2 className="font-medium mb-3">Shopify Store Connection</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Store domain (e.g. mystore.myshopify.com)</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="yourstore.myshopify.com"
                value={storeDomain}
                onChange={(e) => setStoreDomain(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Admin API access token</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="shpat_***"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Customer + products */}
        <section className="bg-white rounded-xl shadow p-5 mb-6">
          <h2 className="font-medium mb-3">Customer & Products</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Customer Name</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Customer Email</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm mb-1">
              Product names (comma or line separated). Examples: <span className="italic">“Mug x2”, “2x Hoodie”, “Shirt - 3”</span>
            </label>
            <textarea
              className="w-full rounded-md border px-3 py-2 h-32"
              placeholder={"Hoodie x2\nMug\nSticker - 3"}
              value={productsInput}
              onChange={(e) => setProductsInput(e.target.value)}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSearch}
              disabled={loading === "search"}
              className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-60"
            >
              {loading === "search" ? "Searching…" : "Find Matches"}
            </button>
          </div>
        </section>

        {/* Matches */}
        {matches && (
          <section className="bg-white rounded-xl shadow p-5 mb-6">
            <h2 className="font-medium mb-3">Matched Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Requested</th>
                    <th className="py-2 pr-3">Matched Product</th>
                    <th className="py-2 pr-3">Variant ID</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3">{m.requested.name}</td>
                      <td className="py-2 pr-3">{m.matched ? m.matched.productTitle : "-"}</td>
                      <td className="py-2 pr-3">{m.matched ? m.matched.variantId : "-"}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={1}
                          className="w-20 rounded-md border px-2 py-1"
                          value={m.matched ? m.matched.qty : (m.requested.qty ?? 1)}
                          onChange={(e) => updateQty(i, Number(e.target.value))}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {m.matched ? (
                          <span className="inline-block rounded bg-green-100 text-green-700 px-2 py-0.5">Matched</span>
                        ) : (
                          <span className="inline-block rounded bg-red-100 text-red-700 px-2 py-0.5">Not found</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Email options */}
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm mb-1">Invoice Email Subject</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Invoice Email Body</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={handleCreateDraft}
                disabled={loading === "create"}
                className="rounded-md bg-indigo-600 text-white px-4 py-2 disabled:opacity-60"
              >
                {loading === "create" ? "Creating Draft & Sending…" : "Create Draft & Send Invoice"}
              </button>
            </div>
          </section>
        )}

        {/* Toasts */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 rounded-md px-4 py-3 shadow ${
              toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}