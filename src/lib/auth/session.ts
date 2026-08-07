import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getRequestId, normalizeEmail } from "@/lib/utils";
import { AppError } from "@/lib/errors";

const secret = new TextEncoder().encode(
  process.env.SESSION_JWT_SECRET || "local-development-secret-change-before-production-2026",
);
const cookieName = process.env.SESSION_COOKIE_NAME || "planner_session";
const maxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS || 7);

export interface SessionUser {
  id: string;
  email: string;
}

export interface SessionClaims extends SessionUser {
  iat?: number;
  exp?: number;
  jti?: string;
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: normalizeEmail(user.email) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(getRequestId())
    .setIssuedAt()
    .setExpirationTime(`${maxAgeDays}d`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (!payload.sub) {
    throw new AppError("AUTH_UNAUTHORIZED", "登录态无效", 401);
  }
  return {
    id: payload.sub,
    email: String(payload.email || ""),
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(cookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function requireSessionUser(csrfToken?: string | null): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("AUTH_UNAUTHORIZED", "请先登录", 401);
  }
  if (csrfToken !== undefined) {
    const store = await cookies();
    const cookieToken = store.get("planner_csrf")?.value;
    if (!cookieToken || csrfToken !== cookieToken) {
      throw new AppError("AUTH_UNAUTHORIZED", "CSRF Token 无效", 401);
    }
  }
  return user;
}

export async function ensureCsrfToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get("planner_csrf")?.value;
  const token = existing || newCsrfToken();
  store.set("planner_csrf", token, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  return token;
}

export function newCsrfToken(): string {
  return getRequestId().replace(/-/g, "");
}
