import { NEW_CONVERSATION_TITLE } from "../shared/constants";
import { defaultAppState } from "../shared/defaults";
import { requestModelReply } from "../shared/model-client";
import { getCurrentModelConfig, loadAppState, saveAppState, updateAppState } from "../shared/storage";
import type { RuntimeRequest, RuntimeResponse } from "../shared/runtime-messages";
import type {
  Attachment,
  ChatRequestPayload,
  Conversation,
  ConversationMessage,
  QuickTaskPayload,
  SelectionChatPayload,
  SummaryRequestPayload,
} from "../shared/types";
import {
  buildAttachmentContext,
  createConversation,
  createConversationTitle,
  createId,
  sortConversations,
  truncateText,
} from "../shared/utils";

const OPEN_SIDE_PANEL_COMMAND = "open-side-panel";

async function initializeExtensionState() {
  const state = await loadAppState().catch(async () => saveAppState(defaultAppState));
  await saveAppState(state);
  await chrome.sidePanel.setOptions({ enabled: true, path: "sidepanel.html" }).catch(console.error);
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
}

async function openSidePanelForCurrentWindow(windowId?: number) {
  if (windowId) {
    await chrome.sidePanel.open({ windowId });
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.windowId) {
    await chrome.sidePanel.open({ windowId: activeTab.windowId });
  }
}

function upsertConversation(conversations: Conversation[], nextConversation: Conversation) {
  const remaining = conversations.filter((conversation) => conversation.id !== nextConversation.id);
  return sortConversations([nextConversation, ...remaining]);
}

function ensureConversation(conversations: Conversation[], conversationId?: string) {
  return conversations.find((conversation) => conversation.id === conversationId) ?? conversations[0] ?? createConversation();
}

function toModelMessages(messages: ConversationMessage[]) {
  return messages
    .filter((message) => message.role !== "assistant" || message.status !== "pending")
    .map((message) => {
      if (message.role !== "user") {
        return {
          role: message.role,
          content: message.content,
        };
      }

      return {
        role: message.role,
        content: `${message.content}${buildAttachmentContext(message.attachments)}`,
      };
    });
}

async function processConversationMessage(payload: ChatRequestPayload) {
  const userMessage: ConversationMessage = {
    id: createId("message"),
    role: "user",
    content: payload.content,
    createdAt: Date.now(),
    attachments: payload.attachments,
  };

  const assistantMessageId = createId("message");
  const pendingAssistantMessage: ConversationMessage = {
    id: assistantMessageId,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    status: "pending",
  };

  const stateAfterQueue = await updateAppState((state) => {
    const baseConversation = ensureConversation(state.conversations, payload.conversationId ?? state.activeConversationId);
    const shouldRename =
      baseConversation.title === NEW_CONVERSATION_TITLE && baseConversation.messages.filter((message) => message.role === "user").length === 0;
    const nextConversation: Conversation = {
      ...baseConversation,
      title: shouldRename ? createConversationTitle(payload.titleHint || payload.content) : baseConversation.title,
      updatedAt: Date.now(),
      messages: [...baseConversation.messages, userMessage, pendingAssistantMessage],
    };

    return {
      ...state,
      activeConversationId: nextConversation.id,
      conversations: upsertConversation(state.conversations, nextConversation),
    };
  });

  const activeConversation = ensureConversation(stateAfterQueue.conversations, stateAfterQueue.activeConversationId);
  const currentModel = await getCurrentModelConfig(stateAfterQueue);

  if (!currentModel) {
    await finalizeAssistantMessage(activeConversation.id, assistantMessageId, {
      content: "请先在设置页配置并启用一个模型，然后再开始对话。",
      status: "error",
      error: "未配置模型",
    });
    return;
  }

  try {
    const content = await requestModelReply(currentModel, toModelMessages(activeConversation.messages));
    await finalizeAssistantMessage(activeConversation.id, assistantMessageId, {
      content,
      status: "done",
    });
  } catch (error) {
    await finalizeAssistantMessage(activeConversation.id, assistantMessageId, {
      content: error instanceof Error ? error.message : "模型调用失败，请稍后重试。",
      status: "error",
      error: error instanceof Error ? error.message : "模型调用失败",
    });
  }
}

async function finalizeAssistantMessage(
  conversationId: string,
  messageId: string,
  payload: Pick<ConversationMessage, "content" | "status" | "error">,
) {
  await updateAppState((state) => {
    const conversation = ensureConversation(state.conversations, conversationId);
    const nextConversation: Conversation = {
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: payload.content,
              status: payload.status,
              error: payload.error,
            }
          : message,
      ),
    };

    return {
      ...state,
      conversations: upsertConversation(state.conversations, nextConversation),
      activeConversationId: nextConversation.id,
    };
  });
}

async function handleQuickAction(payload: QuickTaskPayload) {
  const state = await loadAppState();
  const currentModel = await getCurrentModelConfig(state);
  if (!currentModel) {
    throw new Error("请先在设置页配置并启用模型。");
  }

  const prompt =
    payload.mode === "translate"
      ? `请把下面的内容翻译成 ${payload.targetLanguage || state.settings.general.defaultTranslateTarget}，只输出译文。\n\n原文：\n${payload.selectedText}`
      : `请结合上下文解释下面这段内容，尽量清晰简洁。\n\n内容：\n${payload.selectedText}`;

  const content = await requestModelReply(currentModel, [
    {
      role: "system",
      content:
        payload.mode === "translate"
          ? "你是一名准确自然的翻译助手，会保留原文关键信息。"
          : "你是一名擅长网页内容解释的助手，会基于用户提供的片段给出直接、清晰的解释。",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return {
    text: content,
  };
}

async function handleSummaryRequest(payload: SummaryRequestPayload, sender: chrome.runtime.MessageSender) {
  await openSidePanelForCurrentWindow(sender.tab?.windowId);
  await processConversationMessage({
    titleHint: payload.pageTitle || "页面总结",
    content: [
      "请总结此页面的核心内容，并给出结构化摘要。",
      `页面标题：${payload.pageTitle || "未知标题"}`,
      `页面 URL：${payload.pageUrl}`,
      `页面正文：${truncateText(payload.pageText, 7000)}`,
    ].join("\n\n"),
  });
}

async function handleSelectionChat(payload: SelectionChatPayload, sender: chrome.runtime.MessageSender) {
  await openSidePanelForCurrentWindow(sender.tab?.windowId);
  await processConversationMessage({
    titleHint: payload.titleHint || payload.prompt,
    content: [
      "请基于下面的选中文本回答我的问题。",
      `选中文本：\n${payload.selectedText}`,
      `我的要求：\n${payload.prompt}`,
    ].join("\n\n"),
  });
}

async function handleCreateConversation() {
  const conversation = createConversation();
  await updateAppState((state) => ({
    ...state,
    activeConversationId: conversation.id,
    conversations: upsertConversation(state.conversations, conversation),
  }));

  return {
    conversationId: conversation.id,
  };
}

async function handleMessage(message: RuntimeRequest, sender: chrome.runtime.MessageSender): Promise<RuntimeResponse> {
  switch (message.type) {
    case "OPEN_SIDE_PANEL":
      await openSidePanelForCurrentWindow(sender.tab?.windowId);
      return { ok: true };

    case "CREATE_CONVERSATION": {
      const data = await handleCreateConversation();
      return { ok: true, data };
    }

    case "SET_ACTIVE_CONVERSATION":
      await updateAppState((state) => ({
        ...state,
        activeConversationId: message.payload.conversationId,
      }));
      return { ok: true };

    case "SEND_CHAT_MESSAGE":
      await processConversationMessage(message.payload);
      return { ok: true };

    case "PAGE_SUMMARY":
      await handleSummaryRequest(message.payload, sender);
      return { ok: true };

    case "SELECTION_CHAT":
      await handleSelectionChat(message.payload, sender);
      return { ok: true };

    case "QUICK_ACTION": {
      const data = await handleQuickAction(message.payload);
      return { ok: true, data };
    }

    case "TEST_MODEL_CONNECTION": {
      const text = await requestModelReply(message.payload.config, [
        {
          role: "user",
          content: "请回复“连接成功”。",
        },
      ]);
      return { ok: true, data: { text } };
    }

    default:
      return { ok: false, error: "未知消息类型。" };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtensionState();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeExtensionState();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== OPEN_SIDE_PANEL_COMMAND) {
    return;
  }

  void openSidePanelForCurrentWindow();
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "发生未知错误。",
      }),
    );

  return true;
});
