import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get("sb-access-token")?.value);
  const pathname = req.nextUrl.pathname;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/messages");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!hasSession && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/messages/:path*", "/login", "/register"],
};
