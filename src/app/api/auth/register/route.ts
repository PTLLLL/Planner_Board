import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { registerSchema } from "@/lib/schemas";
import { registerUser } from "@/lib/services/auth.service";
import { rateLimitCheck } from "@/lib/services/rate-limit.service";
import { setSessionCookie, signSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "local";
    const allowed = await rateLimitCheck("auth-register", ip, 5, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "注册请求过于频繁，请稍后再试", 429);
    const body = parseWithSchema(registerSchema, await readJson(request));
    const user = await registerUser(body);
    const token = await signSession({ id: user.id, email: user.email });
    await setSessionCookie(token);
    return ok({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    }, 201);
  } catch (error) {
    return fail(error);
  }
}
