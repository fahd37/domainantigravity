export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * Server-side proxy for triggering a manual cron scan.
 * Reads CRON_SECRET on the server so it is never exposed to the browser.
 * The Dashboard calls this endpoint — no auth required from the client.
 */
import { NextResponse } from "next/server";

export async function POST() {
  const secret = process.env.CRON_SECRET || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/cron/scan`, {
      headers: {
        "x-cron-secret": secret,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.error || "Scan failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
