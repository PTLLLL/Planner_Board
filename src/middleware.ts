import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_JWT_SECRET || "local-development-secret-change-before-production-2026",
);
const cookieName = process.env.SESSION_COOKIE_NAME || "planner_session";

const protectedPrefixes = ["/dashboard", "/calendar", "/tasks", "/goals", "/agent", "/eval", "/settings"];

async function hasSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = await hasSession(request);

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!authenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/register") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calendar/:path*",
    "/tasks/:path*",
    "/goals/:path*",
    "/agent/:path*",
    "/eval/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
