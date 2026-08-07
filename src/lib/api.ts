import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors";
import { requireSessionUser, type SessionUser } from "@/lib/auth/session";
import type { ZodType } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? {},
        },
      },
      { status: error.status },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误",
        details: {},
      },
    },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "请求体必须是合法 JSON", 400);
  }
}

export function parseWithSchema<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "参数校验失败", 400, result.error.flatten());
  }
  return result.data;
}

export async function requireUser(
  request: Request,
  options: { csrf?: boolean } = { csrf: true },
): Promise<SessionUser> {
  if (options.csrf === false) {
    return requireSessionUser();
  }
  return requireSessionUser(request.headers.get("x-csrf-token"));
}

export function paginate(items: unknown[], page: number, pageSize: number, total: number) {
  return {
    items,
    page,
    pageSize,
    total,
  };
}
