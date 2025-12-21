import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only protect auth routes
  if (!pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // Check token cookie (only for middleware)
  const token = request.cookies.get("token")?.value;

  // If logged in, block auth pages
  if (token) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*"]
};
