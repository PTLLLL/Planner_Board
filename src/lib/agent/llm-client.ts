import { AppError } from "@/lib/errors";
import type { AgentContext } from "@/lib/agent/types";
import { mockPlanner } from "@/lib/agent/mock-planner";

export interface LlmResponse {
  content: string;
  modelName: string;
  promptVersion: string;
}

export function getLlmConfig() {
  return {
    provider: process.env.LLM_PROVIDER || "mock",
    modelName: process.env.LLM_MODEL_NAME || "planner-agent-mock",
    baseUrl: process.env.LLM_BASE_URL || "",
    apiKey: process.env.LLM_API_KEY || "",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 45000),
  };
}

export async function generateAgentCompletion(input: {
  prompt: string;
  context: AgentContext;
  requestText: string;
  retry?: boolean;
}): Promise<LlmResponse> {
  const config = getLlmConfig();
  if (config.provider === "mock" || !config.apiKey) {
    const output = mockPlanner(input.context, input.requestText);
    return {
      content: JSON.stringify(output),
      modelName: config.modelName,
      promptVersion: "planner-agent-v1.0.0",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = config.baseUrl || defaultBaseUrl(config.provider);
  const body = {
    model: config.modelName,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: input.prompt },
      ...(input.retry
        ? [
            {
              role: "user",
              content:
                "你上一次输出不符合要求。请只输出符合规范的 JSON，不要输出任何其他文字。必须满足：顶层字段为 summary、clarification_questions、proposed_actions、risks、overall_confidence；若需要澄清，proposed_actions 必须为空数组；不得使用未注册工具。",
            },
          ]
        : []),
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AppError("AGENT_OUTPUT_INVALID", `模型服务返回 ${response.status}`, 502);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("AGENT_OUTPUT_INVALID", "模型响应为空", 502);
    }
    return {
      content,
      modelName: config.modelName,
      promptVersion: "planner-agent-v1.0.0",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "AGENT_OUTPUT_INVALID",
      error instanceof Error && error.name === "AbortError" ? "模型调用超时" : "模型调用网络错误",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function defaultBaseUrl(provider: string): string {
  if (provider === "dashscope") return "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  if (provider === "deepseek") return "https://api.deepseek.com/chat/completions";
  return "https://api.openai.com/v1/chat/completions";
}
