import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { loginSchema } from "@/lib/schemas";
import { loginUser } from "@/lib/services/auth.service";
import { rateLimitCheck } from "@/lib/services/rate-limit.service";
import { setSessionCookie, signSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "local";
    const allowed = await rateLimitCheck("auth-login", ip, 10, 15 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "登录尝试过于频繁，请稍后再试", 429);
    const body = parseWithSchema(loginSchema, await readJson(request));
    const user = await loginUser(body);
    const token = await signSession({ id: user.id, email: user.email });
    await setSessionCookie(token);
    return ok({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (error) {
    return fail(error);
  }
}
