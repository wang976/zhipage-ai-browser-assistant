import { buildChatCompletionUrl, extractResponseText } from "./utils";
import type { ConversationMessage, ModelConfig } from "./types";

export async function requestModelReply(config: ModelConfig, messages: Array<Pick<ConversationMessage, "role" | "content">>) {
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
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`模型请求失败（${response.status}）：${detail || response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    const text = extractResponseText(payload);
    if (!text) {
      throw new Error("模型返回为空，无法解析回复内容。");
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("模型请求超时，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
