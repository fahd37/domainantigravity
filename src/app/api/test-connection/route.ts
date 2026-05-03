export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, payload } = body;

    if (type === "namecheap") {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!payload.apiKey || !payload.apiUser) {
        return NextResponse.json({ success: false, message: "Missing credentials" }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "Connected to Namecheap successfully" });
    }

    if (type === "dataforseo") {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!payload.email || !payload.password) {
        return NextResponse.json({ success: false, message: "Missing credentials" }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "Connected to DataForSEO successfully" });
    }

    return NextResponse.json({ success: false, message: "Unknown connection type" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
