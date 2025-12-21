import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow ONLY root path
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Block everything else
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"]
};
