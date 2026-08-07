const base = process.env.APP_BASE_URL || "http://localhost:3000";
const jar = new Map();

function cookieHeader() {
  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function collectCookies(response) {
  const lines =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const line of lines) {
    const pair = line.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) {
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (jar.size) headers.Cookie = cookieHeader();
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = jar.get("planner_csrf") || "";
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });
  collectCookies(response);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SMOKE FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

async function main() {
  const email = `smoke-${Date.now()}@planner.local`;
  const password = "Test1234!";

  const register = await request("/api/auth/register", {
    method: "POST",
    json: { email, password, displayName: "Smoke User" },
  });
  assert(register.status === 201 && register.body?.success, "注册成功");

  const me = await request("/api/me");
  assert(me.status === 200 && me.body?.data?.csrfToken, "获取当前用户与 CSRF Token");

  const goal = await request("/api/goals", {
    method: "POST",
    json: { title: "Smoke 长期目标", description: "smoke", targetDate: "2026-08-31" },
  });
  assert(goal.status === 201 && goal.body?.data?.id, "创建目标成功");

  const task = await request("/api/tasks", {
    method: "POST",
    json: {
      title: "Smoke 今日任务",
      dateKey: "2026-08-06",
      priority: "high",
      estimateMinutes: 45,
      goalId: goal.body.data.id,
    },
  });
  assert(task.status === 201 && task.body?.data?.id, "创建任务成功");

  const agent = await request("/api/agent/chat", {
    method: "POST",
    json: { requestText: "明天上午整理简历项目经历", trigger: "agent_input" },
  });
  assert(
    agent.status === 201 && agent.body?.data?.status === "completed",
    `Agent 运行完成（${agent.body?.data?.actions?.length ?? 0} 条建议）`,
  );

  const actions = await request("/api/agent/actions?status=proposed&pageSize=5");
  const proposed = actions.body?.data?.items?.[0];
  assert(Boolean(proposed), "Agent 建议进入 Inbox");

  const approve = await request(`/api/agent/actions/${proposed.id}/approve`, {
    method: "POST",
    json: {},
  });
  assert(approve.body?.data?.status === "executed", "接受建议并执行成功");

  const today = await request("/api/dashboard/today");
  assert(today.status === 200 && today.body?.data?.total >= 1, "Dashboard 今日概览正常");

  const evalSummary = await request("/api/eval/summary");
  assert(evalSummary.status === 200, "Eval Dashboard 汇总接口正常");

  if (process.argv.includes("--eval")) {
    const evalRun = await request("/api/eval/run", {
      method: "POST",
      json: { categories: [] },
    });
    assert(evalRun.status === 201 && Array.isArray(evalRun.body?.data), "运行完整 Eval 用例集");
    const passedCount = evalRun.body.data.filter((item) => item.passed).length;
    console.log(`Eval passed: ${passedCount}/${evalRun.body.data.length}`);
    for (const item of evalRun.body.data.filter((entry) => !entry.passed)) {
      console.log(`  FAIL ${item.category} | ${item.caseName} | ${item.failureCategory} | ${item.notes ?? ""}`);
    }
  }

  console.log("SMOKE COMPLETE");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
