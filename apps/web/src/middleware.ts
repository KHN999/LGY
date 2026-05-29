import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lgy_session";
const PROTECTED_PREFIXES = ["/admin", "/staff"];

/**
 * Cheap presence check only — if the cookie is missing, redirect to /login
 * with the current path preserved so we can return after login. Real validation
 * (signature, expiry) happens server-side on the API. This middleware is just
 * a fast first-pass to avoid rendering a protected page for an obviously
 * unauthenticated request.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
