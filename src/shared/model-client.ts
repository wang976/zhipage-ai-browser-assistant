import { buildChatCompletionUrl, extractResponseText, extractStreamDelta } from "./utils";
import type { ConversationMessage, ModelConfig } from "./types";

interface StreamHandlers {
  onChunk?: (chunk: string, fullText: string) => void | Promise<void>;
  onComplete?: (fullText: string) => void | Promise<void>;
}

function validateConfig(config: ModelConfig) {
  if (!config.enabled) {
    throw new Error("当前模型已禁用，请在设置页启用后再试。");
  }
  if (!config.baseUrl.trim()) {
    throw new Error("当前模型缺少 API 地址。");
  }
  if (!config.apiKey.trim()) {
    throw new Error("当前模型缺少 API Key。");
  }
  if (!config.model.trim()) {
    throw new Error("当前模型缺少模型名称。");
  }

  const endpoint = buildChatCompletionUrl(config.baseUrl);
  if (!endpoint) {
    throw new Error("模型 API 地址无效。");
  }

  return endpoint;
}

export async function streamModelReply(
  config: ModelConfig,
  messages: Array<Pick<ConversationMessage, "role" | "content">>,
  handlers: StreamHandlers = {},
) {
  const endpoint = validateConfig(config);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        stream: true,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`模型请求失败（${response.status}）：${detail || response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!response.body || contentType.includes("application/json")) {
      const payload = (await response.json()) as unknown;
      const text = extractResponseText(payload);
      if (!text) {
        throw new Error("模型返回为空，无法解析回复内容。");
      }
      await handlers.onChunk?.(text, text);
      await handlers.onComplete?.(text);
      return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    const flushEventBlock = async (rawEvent: string) => {
      const data = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();

      if (!data || data === "[DONE]") {
        return;
      }

      const payload = JSON.parse(data) as unknown;
      const delta = extractStreamDelta(payload);
      if (!delta) {
        return;
      }

      fullText += delta;
      await handlers.onChunk?.(delta, fullText);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const eventBlock = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);
        if (eventBlock) {
          await flushEventBlock(eventBlock);
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      await flushEventBlock(buffer.trim());
    }

    if (!fullText.trim()) {
      throw new Error("模型返回为空，无法解析回复内容。");
    }

    await handlers.onComplete?.(fullText);
    return fullText;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("模型请求超时，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestModelReply(config: ModelConfig, messages: Array<Pick<ConversationMessage, "role" | "content">>) {
  let finalText = "";
  await streamModelReply(config, messages, {
    onChunk: (_chunk, fullText) => {
      finalText = fullText;
    },
  });
  return finalText;
}
