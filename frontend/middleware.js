import { NextResponse } from "next/server";

const ALLOWED_PATHS = [
  "/",
  "/login",
  "/forgot_password",   // ✅ underscore (matches rewrite)
  "/home",

  // Visitor flow
  "/visitor/dashboard",
  "/visitor/primary_details",
  "/visitor/secondary_details",
  "/visitor/identity",
  "/visitor/pass",

  // Conference
  "/conference/dashboard"
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // ✅ Always allow Next internals & API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ✅ Allow exact allowed paths
  if (ALLOWED_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // ❌ Block everything else
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"]
};

