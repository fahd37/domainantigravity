export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("dh_auth_token", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  res.cookies.set("dh_auth_token", "", { maxAge: 0, path: "/" });
  return res;
}
