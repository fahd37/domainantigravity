export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Same base64 token as middleware uses
    const token = Buffer.from(`${ADMIN_EMAIL}:${ADMIN_PASSWORD}`).toString("base64");
    const res = NextResponse.json({ success: true });
    res.cookies.set("dh_auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
