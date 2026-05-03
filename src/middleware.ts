import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible auth — no Node modules
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Cron routes: protected by x-cron-secret header, not cookie
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Auth routes always public
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  // No credentials configured → open access
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  // Simple base64 token: btoa(email:password)
  const expectedToken = Buffer.from(`${ADMIN_EMAIL}:${ADMIN_PASSWORD}`).toString("base64");
  const authCookie = request.cookies.get("dh_auth_token");

  if (authCookie?.value === expectedToken) {
    return NextResponse.next();
  }

  // API routes → 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Page routes → redirect to /login
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
