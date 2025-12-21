import { NextResponse } from "next/server";

const ALLOWED = [
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

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (ALLOWED.includes(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"]
};
