import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Delete any customer data you’ve stored
  return NextResponse.json({ ok: true });
}