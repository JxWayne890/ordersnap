import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Delete all data for this shop (including access tokens)
  return NextResponse.json({ ok: true });
}