let csrfToken: string | null = null;

export async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/me", { credentials: "include" });
  const body = await response.json().catch(() => null);
  if (body?.data?.csrfToken) {
    csrfToken = body.data.csrfToken;
  }
  return csrfToken;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  if (method !== "GET" && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET") {
    const token = await ensureCsrfToken();
    if (token) headers.set("x-csrf-token", token);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message || `请求失败（${response.status}）`);
  }
  return body.data as T;
}

export function postJson<T>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function patchJson<T>(path: string, data: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteJson<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}
