import { NEW_CONVERSATION_TITLE } from "./constants";
import type { Attachment, Conversation, ConversationMessage } from "./types";

export function createId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createConversation(now = Date.now()): Conversation {
  return {
    id: createId("conversation"),
    title: NEW_CONVERSATION_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function createMessage(
  role: ConversationMessage["role"],
  content: string,
  options: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: createId("message"),
    role,
    content,
    createdAt: Date.now(),
    status: role === "assistant" ? "done" : undefined,
    ...options,
  };
}

export function truncateText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

export function createConversationTitle(input: string) {
  const nextTitle = truncateText(input.replace(/\n+/g, " "), 18);
  return nextTitle || NEW_CONVERSATION_TITLE;
}

export function formatRelativeTime(timestamp: number) {
  const deltaMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (deltaMinutes < 1) {
    return "刚刚";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes} 分钟前`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} 小时前`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 30) {
    return `${deltaDays} 天前`;
  }

  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function buildAttachmentContext(attachments: Attachment[] = []) {
  if (!attachments.length) {
    return "";
  }

  const attachmentDetails = attachments
    .map((attachment) => {
      if (attachment.kind === "text" && attachment.textPreview) {
        return `文件 ${attachment.name}：\n${truncateText(attachment.textPreview, 1500)}`;
      }

      return `文件 ${attachment.name}（${attachment.mimeType || "未知类型"}，${attachment.size} bytes）`;
    })
    .join("\n\n");

  return `\n\n附加文件信息：\n${attachmentDetails}\n\n注意：图片仅展示为占位信息，后续可扩展为真实多模态上传。`;
}

export function buildChatCompletionUrl(baseUrl: string) {
  const sanitized = baseUrl.trim().replace(/\/+$/, "");
  if (!sanitized) {
    return "";
  }
  if (sanitized.endsWith("/chat/completions")) {
    return sanitized;
  }

  return `${sanitized}/chat/completions`;
}

export function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> }).choices;
  const content = choices?.[0]?.message?.content ?? choices?.[0]?.text ?? (payload as { output_text?: unknown }).output_text;
  return extractTextPayload(content).trim();
}

export function extractStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choice = (payload as { choices?: Array<{ delta?: { content?: unknown }; text?: unknown }> }).choices?.[0];
  const content = choice?.delta?.content ?? choice?.text;
  return extractTextPayload(content);
}

function extractTextPayload(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (!item || typeof item !== "object") {
          return "";
        }
        if ("text" in item && typeof item.text === "string") {
          return item.text;
        }
        if ("content" in item && typeof item.content === "string") {
          return item.content;
        }
        return "";
      })
      .join("");
  }

  if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
    return content.text;
  }

  return "";
}
