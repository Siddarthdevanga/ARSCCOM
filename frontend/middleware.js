import { NextResponse } from "next/server";

// Public entry routes (clean URLs)
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forgot_password"
];

// Auth flow (internal but required)
const AUTH_PREFIX = "/auth";

// App sections
const APP_PREFIXES = [
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

  // Allow internal auth routes (register, reset-password)
  if (pathname.startsWith(AUTH_PREFIX)) {
    return NextResponse.next();
  }

  // Allow app pages
  if (APP_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Block everything else
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"]
};
