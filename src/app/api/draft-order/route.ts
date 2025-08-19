import { NextRequest, NextResponse } from "next/server";
import {
  createDraftOrder,
  sendInvoice,
  DraftOrderLineItem,
  DraftOrderPayload,
} from "@/lib/shopify";

type Body = {
  storeDomain: string;
  adminToken: string;
  customerName: string;
  customerEmail: string;
  lineItems: DraftOrderLineItem[];
  emailSubject?: string;
  emailBody?: string;
};

export async function POST(req: NextRequest) {
  try {
    const {
      storeDomain,
      adminToken,
      customerName,
      customerEmail,
      lineItems,
      emailSubject,
      emailBody,
    } = (await req.json()) as Body;

    const payload: DraftOrderPayload = {
      draft_order: {
        email: customerEmail,
        note: `OrderSnap for ${customerName}`,
        use_customer_default_address: true,
        line_items: lineItems,
      },
    };

    const { draft_order } = await createDraftOrder(
      { storeDomain, adminToken },
      payload
    );

    await sendInvoice(
      { storeDomain, adminToken },
      draft_order.id,
      emailSubject ?? "Your invoice",
      emailBody ?? `Hi ${customerName}, here is your invoice.`
    );

    return NextResponse.json({ ok: true, draftOrderId: draft_order.id, invoiceSent: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}