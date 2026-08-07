import { AppError } from "@/lib/errors";
import type { AgentContext } from "@/lib/agent/types";
import { mockPlanner } from "@/lib/agent/mock-planner";

export interface LlmResponse {
  content: string;
  modelName: string;
  promptVersion: string;
}

export interface LlmConfig {
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxTokens: number;
  endpointUrl: string;
}

interface CompletionResult {
  ok: boolean;
  status: number;
  content: string | null;
  errorText: string;
  finishReason: string | null;
  busy: boolean;
}

const MOCK_MODEL_NAME = "planner-agent-mock";
const SUPPORTED_PROVIDERS = ["openai", "dashscope", "deepseek", "modelscope"];
const DEFAULT_MAX_TOKENS = 12000;
const RETRY_MAX_TOKENS = 16000;
const DEFAULT_TIMEOUT_MS = 180000;

export function getLlmConfig(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER || "mock").trim().toLowerCase();
  const modelName = (process.env.LLM_MODEL_NAME || MOCK_MODEL_NAME).trim();
  const baseUrl = (process.env.LLM_BASE_URL || "").trim();
  const apiKey = (process.env.LLM_API_KEY || "").trim();
  const rawTimeout = Number(process.env.LLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_TIMEOUT_MS;
  const rawMaxTokens = Number(process.env.LLM_MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const maxTokens =
    Number.isFinite(rawMaxTokens) && rawMaxTokens > 0
      ? Math.min(Math.max(Math.round(rawMaxTokens), 512), 16000)
      : DEFAULT_MAX_TOKENS;

  if (provider === "mock") {
    return {
      provider,
      modelName: modelName || MOCK_MODEL_NAME,
      baseUrl,
      apiKey: "",
      timeoutMs,
      maxTokens,
      endpointUrl: "",
    };
  }

  if (!baseUrl && !SUPPORTED_PROVIDERS.includes(provider)) {
    throw new AppError(
      "LLM_CONFIG_ERROR",
      `不支持的 LLM_PROVIDER：${provider}。请使用 mock、openai、dashscope、deepseek、modelscope，或配置 LLM_BASE_URL`,
      500,
    );
  }

  if (!apiKey) {
    throw new AppError(
      "LLM_CONFIG_ERROR",
      `已启用 ${provider}，但未配置 LLM_API_KEY，请检查 .env`,
      500,
    );
  }
  if (/^https?:\/\//i.test(apiKey) || apiKey.includes("/")) {
    throw new AppError(
      "LLM_CONFIG_ERROR",
      "LLM_API_KEY 格式不正确，请填写真实 API Key，不要填写接口地址",
      500,
    );
  }
  if (!modelName || modelName === MOCK_MODEL_NAME) {
    throw new AppError(
      "LLM_CONFIG_ERROR",
      `已启用 ${provider}，但 LLM_MODEL_NAME 不能为空或仍为 mock 占位值，请填写真实模型 ID`,
      500,
    );
  }

  const endpointUrl = resolveEndpointUrl(provider, baseUrl);
  if (!/^https?:\/\//i.test(endpointUrl)) {
    throw new AppError("LLM_CONFIG_ERROR", "LLM_BASE_URL 必须是 http(s) 地址", 500);
  }

  return { provider, modelName, baseUrl, apiKey, timeoutMs, maxTokens, endpointUrl };
}

function resolveEndpointUrl(provider: string, baseUrl: string): string {
  const raw = baseUrl || defaultBaseUrl(provider);
  const trimmed = raw.replace(/\/+$/, "");
  return /\/chat\/completions$/i.test(trimmed)
    ? trimmed
    : `${trimmed}/chat/completions`;
}

function defaultBaseUrl(provider: string): string {
  if (provider === "dashscope") {
    return "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  }
  if (provider === "deepseek") {
    return "https://api.deepseek.com/chat/completions";
  }
  if (provider === "modelscope") {
    return "https://api-inference.modelscope.cn/v1/chat/completions";
  }
  return "https://api.openai.com/v1/chat/completions";
}

async function postCompletion(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<CompletionResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  const errorText = await response.text().catch(() => "");
  let content: string | null = null;
  let finishReason: string | null = null;
  let busy = false;
  if (response.ok) {
    try {
      const data = JSON.parse(errorText) as {
        choices?: Array<{
          finish_reason?: string | null;
          message?: { content?: string; reasoning_content?: string };
        }> | null;
        usage?: { total_tokens?: number };
      };
      const choices = data.choices ?? [];
      const choice = choices[0];
      content = choice?.message?.content ?? null;
      finishReason = choice?.finish_reason ?? null;
      busy = choices.length === 0 && (data.usage?.total_tokens ?? 0) === 0;
    } catch {
      content = null;
    }
  }
  return { ok: response.ok, status: response.status, content, errorText, finishReason, busy };
}

export async function generateAgentCompletion(input: {
  prompt: string;
  context: AgentContext;
  requestText: string;
  retry?: boolean;
}): Promise<LlmResponse> {
  const config = getLlmConfig();
  if (config.provider === "mock") {
    const output = mockPlanner(input.context, input.requestText);
    return {
      content: JSON.stringify(output),
      modelName: config.modelName,
      promptVersion: "planner-agent-v1.0.0",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const maxTokens = input.retry ? Math.max(config.maxTokens, RETRY_MAX_TOKENS) : config.maxTokens;
  const body: Record<string, unknown> = {
    model: config.modelName,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: maxTokens,
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
    let result = await postCompletion(config.endpointUrl, config.apiKey, body, controller.signal);
    if (!result.ok && result.status === 400 && /response_format/i.test(result.errorText)) {
      const fallbackBody = { ...body };
      delete fallbackBody.response_format;
      result = await postCompletion(config.endpointUrl, config.apiKey, fallbackBody, controller.signal);
    }
    if (!result.ok) {
      throw new AppError("AGENT_OUTPUT_INVALID", `模型服务返回 ${result.status}`, 502);
    }
    if (!result.content) {
      if (result.busy) {
        throw new AppError("AGENT_OUTPUT_INVALID", "模型服务繁忙，正在等待后重试", 502);
      }
      throw new AppError(
        "AGENT_OUTPUT_INVALID",
        result.finishReason === "length" ? "模型输出达到长度限制，正在使用更大输出上限重试" : "模型响应为空",
        502,
      );
    }
    return {
      content: result.content,
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