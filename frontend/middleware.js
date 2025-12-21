import { NextResponse } from "next/server";

const ALLOWED_PATHS = [
  "/",
  "/login",
  "/forgot-password",
  "/home",
  "/visitor/dashboard",
  "/visitor/primary_details",
  "/visitor/secondary_details",
  "/visitor/identity",
  "/visitor/pass",
  "/conference/dashboard"
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Allow only known pages
  if (ALLOWED_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Everything else → root
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"]
};
