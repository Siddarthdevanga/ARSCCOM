import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Public pages
  if (
    pathname === "/login" ||
    pathname === "/forgot_password" ||
    pathname === "/register" ||
    pathname === "/reset_password"
  ) {
    return NextResponse.next();
  }

  // Allow Next internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Protect everything else
  const token = req.cookies.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api).*)"],
};
