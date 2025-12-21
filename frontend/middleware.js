import { NextResponse } from "next/server";

// Public pages (no auth required)
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forgot_password"
];

// App sections (allow everything under these)
const ALLOWED_PREFIXES = [
  "/home",
  "/visitor",
  "/conference"
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow Next.js internals & API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Allow public pages
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow full app sections
  if (ALLOWED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Block everything else
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"]
};
