import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAgentCompletion, getLlmConfig } from "@/lib/agent/llm-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getLlmConfig", () => {
  it("falls back to mock when provider is unset", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    const config = getLlmConfig();
    expect(config.provider).toBe("mock");
    expect(config.endpointUrl).toBe("");
  });

  it("normalizes ModelScope and appends chat completions to a base URL", () => {
    vi.stubEnv("LLM_PROVIDER", "ModelScope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const config = getLlmConfig();
    expect(config.provider).toBe("modelscope");
    expect(config.endpointUrl).toBe("https://api-inference.modelscope.cn/v1/chat/completions");
  });

  it("keeps a full chat completions URL unchanged", () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1/chat/completions");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "gpt-4o-mini");

    expect(getLlmConfig().endpointUrl).toBe("https://example.com/v1/chat/completions");
  });

  it("rejects a missing API key for real providers", () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("LLM_API_KEY", "");
    vi.stubEnv("LLM_MODEL_NAME", "gpt-4o-mini");

    expect(() => getLlmConfig()).toThrow(/LLM_API_KEY/);
  });

  it("rejects an API key that was filled with a URL", () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    expect(() => getLlmConfig()).toThrow(/接口地址/);
  });

  it("rejects the mock model placeholder for real providers", () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "planner-agent-mock");

    expect(() => getLlmConfig()).toThrow(/LLM_MODEL_NAME/);
  });
});

describe("generateAgentCompletion", () => {
  it("posts to the resolved endpoint and parses the content", async () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAgentCompletion({
      prompt: "system prompt",
      context: {} as never,
      requestText: "帮我安排今天",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-inference.modelscope.cn/v1/chat/completions");
    expect(JSON.parse((init as RequestInit | undefined)?.body as string).model).toBe("Qwen/Qwen2.5-7B-Instruct");
    expect(result.content).toBe("{}");
  });

  it("retries without response_format when the endpoint rejects it", async () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "response_format is not supported" } }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAgentCompletion({
      prompt: "system prompt",
      context: {} as never,
      requestText: "帮我安排今天",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit | undefined)?.body as string);
    expect(fallbackBody.response_format).toBeUndefined();
    expect(result.content).toBe("{}");
  });

  it("uses a large token budget and long timeout for real providers", () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const config = getLlmConfig();
    expect(config.maxTokens).toBe(12000);
    expect(config.timeoutMs).toBe(180000);
  });

  it("honors LLM_MAX_TOKENS and clamps to the supported range", () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");
    vi.stubEnv("LLM_MAX_TOKENS", "99999");

    expect(getLlmConfig().maxTokens).toBe(16000);
  });

  it("treats an empty placeholder response as a busy model error", async () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "", choices: null, usage: { total_tokens: 0 } }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateAgentCompletion({
        prompt: "system prompt",
        context: {} as never,
        requestText: "帮我安排今天",
      }),
    ).rejects.toThrow(/模型服务繁忙/);
  });

  it("reports a truncated reasoning response as a length error", async () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "思考中" } }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateAgentCompletion({
        prompt: "system prompt",
        context: {} as never,
        requestText: "帮我安排今天",
      }),
    ).rejects.toThrow(/长度限制/);
  });

  it("uses a larger token budget on retry", async () => {
    vi.stubEnv("LLM_PROVIDER", "modelscope");
    vi.stubEnv("LLM_BASE_URL", "https://api-inference.modelscope.cn/v1");
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct");

    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAgentCompletion({
      prompt: "system prompt",
      context: {} as never,
      requestText: "帮我安排今天",
      retry: true,
    });

    expect(result.content).toBe("{}");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit | undefined)?.body as string);
    expect(body.max_tokens).toBe(16000);
  });
});