import { afterAll, describe, expect, it } from "vitest";

const base = process.env.APP_BASE_URL || "http://localhost:3000";
const jar = new Map<string, string>();

function cookieHeader() {
  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function collectCookies(response: Response) {
  const lines =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter((value): value is string => Boolean(value));
  for (const line of lines) {
    const pair = line.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

async function request(path: string, options: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(options.headers);
  if (jar.size) headers.set("Cookie", cookieHeader());
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRF-Token", jar.get("planner_csrf") || "");
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });
  collectCookies(response);
  return { status: response.status, body: await response.json().catch(() => null) };
}

let email = "";

const serverOk = await fetch(`${base}/`)
  .then((response) => response.ok)
  .catch(() => false);

afterAll(() => {
  jar.clear();
});

describe.skipIf(!serverOk)("API integration", () => {
  it("registers a user and reads session", async () => {
    email = `api-${Date.now()}@planner.local`;
    const register = await request("/api/auth/register", {
      method: "POST",
      json: { email, password: "Test1234!", displayName: "API Test" },
    });
    expect(register.status).toBe(201);
    const me = await request("/api/me");
    expect(me.status).toBe(200);
    expect(me.body.data.csrfToken).toBeTruthy();
  });

  it("creates a task", async () => {
    const response = await request("/api/tasks", {
      method: "POST",
      json: {
        title: "Integration task",
        dateKey: "2026-08-06",
        priority: "medium",
        estimateMinutes: 30,
      },
    });
    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe("Integration task");
  });

  it("runs the agent and produces a proposed action", async () => {
    const response = await request("/api/agent/chat", {
      method: "POST",
      json: { requestText: "明天上午整理简历项目经历", trigger: "agent_input" },
    });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("completed");
    expect(response.body.data.actions.length).toBeGreaterThan(0);
  });
});
