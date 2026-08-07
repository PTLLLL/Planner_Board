import { hash, verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/utils";
import { emitServerEvent } from "@/lib/services/metrics.service";

const LOCK_MS = 15 * 60 * 1000;

export async function registerUser(input: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hash(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName?.trim() || null,
        preferences: { create: {} },
      },
    });
    await emitServerEvent(user.id, "user_registered", { registration_source: "web" });
    return user;
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new AppError("AUTH_EMAIL_EXISTS", "邮箱已存在", 409);
    }
    throw error;
  }
}

export async function loginUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("AUTH_INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("AUTH_LOCKED", "登录失败次数过多，请 15 分钟后再试", 423);
  }

  const valid = await verify(user.passwordHash, input.password);
  if (!valid) {
    const nextCount = user.failedLoginCount + 1;
    const shouldLock = nextCount >= 5;
    await prisma.user.update({
      where: { id: user.id },
      data: shouldLock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
        : { failedLoginCount: nextCount },
    });
    throw new AppError("AUTH_INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await emitServerEvent(user.id, "user_logged_in", { login_source: "credentials" });
  return updated;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateDisplayName(userId: string, displayName?: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName: displayName?.trim() || null },
  });
}
