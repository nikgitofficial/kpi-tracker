import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-otp",
  "/reset-password",
];

const PUBLIC_API_PATHS = [
  "/api/auth",
  "/api/forgot-password",
  "/api/verify-otp",
  "/api/reset-password",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublicPath = PUBLIC_PATHS.some((p) =>
    nextUrl.pathname.startsWith(p)
  );
  const isPublicApi = PUBLIC_API_PATHS.some((p) =>
    nextUrl.pathname.startsWith(p)
  );

  if (isPublicApi) return NextResponse.next();

  if (isLoggedIn && isPublicPath)
    return NextResponse.redirect(new URL("/dashboard", nextUrl));

  if (!isLoggedIn && !isPublicPath) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};