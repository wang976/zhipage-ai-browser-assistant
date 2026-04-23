import type { ProviderName } from "./types";

export const STORAGE_KEY = "zhipage-assistant-state";
export const STORAGE_META_KEY = `${STORAGE_KEY}:meta`;
export const STORAGE_CONVERSATION_PREFIX = `${STORAGE_KEY}:conversation:`;
export const NEW_CONVERSATION_TITLE = "新会话";
export const DEFAULT_TRANSLATE_TARGET = "中文（简体）";

export const TARGET_LANGUAGES = [
  "中文（简体）",
  "English",
  "日本語",
  "한국어",
  "Français",
  "Deutsch",
];

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  doubao: "Doubao",
};

export const PROVIDER_URL_HINTS: Record<ProviderName, string> = {
  chatgpt: "https://api.openai.com/v1",
  kimi: "https://api.moonshot.cn/v1",
  deepseek: "https://api.deepseek.com/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  doubao: "https://ark.cn-beijing.volces.com/api/v3",
};

export const PROVIDER_MODEL_HINTS: Record<ProviderName, string> = {
  chatgpt: "gpt-4.1-mini",
  kimi: "moonshot-v1-8k",
  deepseek: "deepseek-chat",
  qwen: "qwen-plus",
  doubao: "doubao-seed-1-6-flash-250615",
};
