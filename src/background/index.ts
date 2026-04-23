import { NEW_CONVERSATION_TITLE } from "../shared/constants";
import { defaultAppState } from "../shared/defaults";
import { requestModelReply, streamModelReply } from "../shared/model-client";
import { getCurrentModelConfig, loadAppState, saveAppState, updateAppState } from "../shared/storage";
import type { RuntimeRequest, RuntimeResponse } from "../shared/runtime-messages";
import type {
  Attachment,
  ChatRequestPayload,
  Conversation,
  ConversationMessage,
  QuickActionStreamEventPayload,
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

function findPreviousUserMessageIndex(messages: ConversationMessage[], assistantIndex: number) {
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }

  return -1;
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

      const selectionQuote = message.meta?.selectionQuote?.trim();
      const userContent = selectionQuote
        ? [
            "请基于下面的划词引用回答用户问题。",
            `引用内容：\n${selectionQuote}`,
            `用户问题：\n${message.content}`,
          ].join("\n\n")
        : message.content;

      return {
        role: message.role,
        content: `${userContent}${buildAttachmentContext(message.attachments)}`,
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
    meta: payload.quotedText ? { selectionQuote: payload.quotedText } : undefined,
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
    await persistAssistantMessage(activeConversation.id, assistantMessageId, {
      content: "请先在设置页配置并启用一个模型，然后再开始对话。",
      status: "error",
      error: "未配置模型",
    });
    return;
  }

  const streamUpdater = createConversationStreamUpdater(activeConversation.id, assistantMessageId);
  let streamedContent = "";

  try {
    const content = await streamModelReply(currentModel, toModelMessages(activeConversation.messages), {
      onChunk: (_chunk, fullText) => {
        streamedContent = fullText;
        streamUpdater.update(fullText);
      },
    });
    streamedContent = content;
    await streamUpdater.done(content);
  } catch (error) {
    await streamUpdater.fail(error instanceof Error ? error.message : "模型调用失败，请稍后重试。", streamedContent);
  }
}

async function regenerateAssistantMessage(payload: { conversationId: string; assistantMessageId: string }) {
  const stateAfterQueue = await updateAppState((state) => {
    const conversation = state.conversations.find((item) => item.id === payload.conversationId);
    if (!conversation) {
      throw new Error("当前会话不存在。");
    }

    const assistantIndex = conversation.messages.findIndex(
      (message) => message.id === payload.assistantMessageId && message.role === "assistant",
    );
    if (assistantIndex === -1) {
      throw new Error("未找到需要重新生成的回答。");
    }

    const targetMessage = conversation.messages[assistantIndex];
    if (targetMessage.status === "pending") {
      throw new Error("这条回答仍在生成中。");
    }

    const previousUserIndex = findPreviousUserMessageIndex(conversation.messages, assistantIndex);
    if (previousUserIndex === -1) {
      throw new Error("找不到对应的用户提问，无法重新生成。");
    }

    const nextConversation: Conversation = {
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message, index) =>
        index === assistantIndex
          ? {
              ...message,
              content: "",
              error: undefined,
              status: "pending",
            }
          : message,
      ),
    };

    return {
      ...state,
      activeConversationId: nextConversation.id,
      conversations: upsertConversation(state.conversations, nextConversation),
    };
  });

  const conversation = stateAfterQueue.conversations.find((item) => item.id === payload.conversationId);
  if (!conversation) {
    throw new Error("当前会话不存在。");
  }

  const assistantIndex = conversation.messages.findIndex((message) => message.id === payload.assistantMessageId && message.role === "assistant");
  if (assistantIndex === -1) {
    throw new Error("未找到需要重新生成的回答。");
  }

  const contextMessages = conversation.messages.slice(0, assistantIndex);
  const currentModel = await getCurrentModelConfig(stateAfterQueue);

  if (!currentModel) {
    await persistAssistantMessage(conversation.id, payload.assistantMessageId, {
      content: "请先在设置页配置并启用一个模型，然后再开始对话。",
      status: "error",
      error: "未配置模型",
    });
    return;
  }

  const streamUpdater = createConversationStreamUpdater(conversation.id, payload.assistantMessageId);
  let streamedContent = "";

  try {
    const content = await streamModelReply(currentModel, toModelMessages(contextMessages), {
      onChunk: (_chunk, fullText) => {
        streamedContent = fullText;
        streamUpdater.update(fullText);
      },
    });
    streamedContent = content;
    await streamUpdater.done(content);
  } catch (error) {
    await streamUpdater.fail(error instanceof Error ? error.message : "模型调用失败，请稍后重试。", streamedContent);
  }
}

async function persistAssistantMessage(
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

function createConversationStreamUpdater(conversationId: string, messageId: string) {
  let latestContent = "";
  let latestStatus: ConversationMessage["status"] = "pending";
  let latestError: string | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingCommit = Promise.resolve();

  const commit = async () => {
    const snapshot = {
      content: latestContent,
      status: latestStatus,
      error: latestError,
    };
    pendingCommit = pendingCommit.then(() => persistAssistantMessage(conversationId, messageId, snapshot));
    await pendingCommit;
  };

  return {
    update(content: string) {
      latestContent = content;
      if (timer !== null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        void commit();
      }, 100);
    },
    async done(content: string) {
      latestContent = content;
      latestStatus = "done";
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await commit();
    },
    async fail(errorMessage: string, partialContent = latestContent) {
      latestContent = partialContent.trim() ? partialContent : errorMessage;
      latestStatus = "error";
      latestError = errorMessage;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await commit();
    },
  };
}

function createQuickActionStreamEmitter(
  sender: chrome.runtime.MessageSender,
  requestId: string,
  mode: QuickTaskPayload["mode"],
) {
  let latestContent = "";
  let latestPhase: QuickActionStreamEventPayload["phase"] = "delta";
  let latestError: string | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingSend = Promise.resolve();

  const postMessage = async (payload: QuickActionStreamEventPayload) => {
    if (!sender.tab?.id) {
      return;
    }

    await chrome.tabs
      .sendMessage(
        sender.tab.id,
        {
          type: "QUICK_ACTION_STREAM_EVENT",
          payload,
        },
        sender.frameId !== undefined ? { frameId: sender.frameId } : undefined,
      )
      .catch(() => undefined);
  };

  const flush = async () => {
    const snapshot: QuickActionStreamEventPayload = {
      requestId,
      mode,
      phase: latestPhase,
      content: latestContent,
      error: latestError,
    };
    pendingSend = pendingSend.then(() => postMessage(snapshot));
    await pendingSend;
  };

  return {
    start() {
      void postMessage({
        requestId,
        mode,
        phase: "start",
        content: "",
      });
    },
    update(content: string) {
      latestContent = content;
      latestPhase = "delta";
      latestError = undefined;
      if (timer !== null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, 80);
    },
    async done(content: string) {
      latestContent = content;
      latestPhase = "done";
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    },
    async fail(errorMessage: string, partialContent = latestContent) {
      latestContent = partialContent.trim() ? partialContent : errorMessage;
      latestPhase = "error";
      latestError = errorMessage;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    },
  };
}

function startQuickActionStream(payload: QuickTaskPayload, sender: chrome.runtime.MessageSender) {
  const emitter = createQuickActionStreamEmitter(sender, payload.requestId, payload.mode);
  emitter.start();

  void (async () => {
    const state = await loadAppState();
    const currentModel = await getCurrentModelConfig(state);
    if (!currentModel) {
      await emitter.fail("请先在设置页配置并启用模型。");
      return;
    }

    const prompt =
      payload.mode === "translate"
        ? `请把下面的内容翻译成 ${payload.targetLanguage || state.settings.general.defaultTranslateTarget}，只输出译文。\n\n原文：\n${payload.selectedText}`
        : `请结合上下文解释下面这段内容，尽量清晰简洁。\n\n内容：\n${payload.selectedText}`;

    let streamedContent = "";

    try {
      const content = await streamModelReply(currentModel, [
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
      ], {
        onChunk: (_chunk, fullText) => {
          streamedContent = fullText;
          emitter.update(fullText);
        },
      });

      streamedContent = content;
      await emitter.done(content);
    } catch (error) {
      await emitter.fail(error instanceof Error ? error.message : "模型调用失败，请稍后重试。", streamedContent);
    }
  })();
}

async function handleSummaryRequest(payload: SummaryRequestPayload, sender: chrome.runtime.MessageSender) {
  await openSidePanelForCurrentWindow(sender.tab?.windowId);
  await processConversationMessage({
    titleHint: "页面总结",
    content: `请总结此页面。\n\n页面 URL：${payload.pageUrl}`,
  });
}

async function handleSelectionChat(payload: SelectionChatPayload, sender: chrome.runtime.MessageSender) {
  await openSidePanelForCurrentWindow(sender.tab?.windowId);
  await processConversationMessage({
    titleHint: payload.titleHint || payload.prompt,
    content: payload.prompt,
    quotedText: payload.selectedText,
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
      void processConversationMessage(message.payload);
      return { ok: true };

    case "REGENERATE_ASSISTANT_MESSAGE":
      void regenerateAssistantMessage(message.payload);
      return { ok: true };

    case "PAGE_SUMMARY":
      void handleSummaryRequest(message.payload, sender);
      return { ok: true };

    case "SELECTION_CHAT":
      void handleSelectionChat(message.payload, sender);
      return { ok: true };

    case "QUICK_ACTION":
      startQuickActionStream(message.payload, sender);
      return { ok: true, data: { requestId: message.payload.requestId } };

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
