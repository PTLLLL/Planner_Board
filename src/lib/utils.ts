import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日期格式必须为 YYYY-MM-DD");
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("日期无效");
  }
  return d;
}

export function isValidDateKey(value: string): boolean {
  try {
    parseDateKey(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateKey(d);
}

export function todayKey(timezone = "Asia/Shanghai"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseTime(value: string): Date {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("时间格式必须为 HH:mm");
  }
  const d = new Date(`1970-01-01T${value}:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("时间无效");
  }
  return d;
}

export function formatTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(11, 16);
}

export function isValidTime(value: string): boolean {
  try {
    parseTime(value);
    return true;
  } catch {
    return false;
  }
}

export function toApiDate(value: Date | null | undefined): string | null {
  return value ? formatDateKey(value) : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getRequestId(): string {
  return crypto.randomUUID();
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
