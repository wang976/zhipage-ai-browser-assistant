// src/shared/constants.ts
var STORAGE_KEY = "zhipage-assistant-state";
var NEW_CONVERSATION_TITLE = "\u65B0\u4F1A\u8BDD";
var DEFAULT_TRANSLATE_TARGET = "\u4E2D\u6587\uFF08\u7B80\u4F53\uFF09";
var PROVIDER_LABELS = {
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  doubao: "Doubao"
};
var PROVIDER_URL_HINTS = {
  chatgpt: "https://api.openai.com/v1",
  kimi: "https://api.moonshot.cn/v1",
  deepseek: "https://api.deepseek.com/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  doubao: "https://ark.cn-beijing.volces.com/api/v3"
};
var PROVIDER_MODEL_HINTS = {
  chatgpt: "gpt-4.1-mini",
  kimi: "moonshot-v1-8k",
  deepseek: "deepseek-chat",
  qwen: "qwen-plus",
  doubao: "doubao-seed-1-6-flash-250615"
};

// src/shared/utils.ts
function createId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}
function createConversation(now = Date.now()) {
  return {
    id: createId("conversation"),
    title: NEW_CONVERSATION_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}
function truncateText(text, maxLength) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}\u2026`;
}
function createConversationTitle(input) {
  const nextTitle = truncateText(input.replace(/\n+/g, " "), 18);
  return nextTitle || NEW_CONVERSATION_TITLE;
}
function sortConversations(conversations) {
  return [...conversations].sort((left, right) => right.updatedAt - left.updatedAt);
}
function buildAttachmentContext(attachments = []) {
  if (!attachments.length) {
    return "";
  }
  const attachmentDetails = attachments.map((attachment) => {
    if (attachment.kind === "text" && attachment.textPreview) {
      return `\u6587\u4EF6 ${attachment.name}\uFF1A
${truncateText(attachment.textPreview, 1500)}`;
    }
    return `\u6587\u4EF6 ${attachment.name}\uFF08${attachment.mimeType || "\u672A\u77E5\u7C7B\u578B"}\uFF0C${attachment.size} bytes\uFF09`;
  }).join("\n\n");
  return `

\u9644\u52A0\u6587\u4EF6\u4FE1\u606F\uFF1A
${attachmentDetails}

\u6CE8\u610F\uFF1A\u56FE\u7247\u4EC5\u5C55\u793A\u4E3A\u5360\u4F4D\u4FE1\u606F\uFF0C\u540E\u7EED\u53EF\u6269\u5C55\u4E3A\u771F\u5B9E\u591A\u6A21\u6001\u4E0A\u4F20\u3002`;
}
function buildChatCompletionUrl(baseUrl) {
  const sanitized = baseUrl.trim().replace(/\/+$/, "");
  if (!sanitized) {
    return "";
  }
  if (sanitized.endsWith("/chat/completions")) {
    return sanitized;
  }
  return `${sanitized}/chat/completions`;
}
function extractResponseText(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choices = payload.choices;
  const content = choices?.[0]?.message?.content ?? choices?.[0]?.text ?? payload.output_text;
  return extractTextPayload(content).trim();
}
function extractStreamDelta(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choice = payload.choices?.[0];
  const content = choice?.delta?.content ?? choice?.text;
  return extractTextPayload(content);
}
function extractTextPayload(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => {
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
    }).join("");
  }
  if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

// src/shared/defaults.ts
function createModelTemplate(providerName) {
  return {
    id: `provider-${providerName}`,
    providerName,
    displayName: PROVIDER_LABELS[providerName],
    baseUrl: PROVIDER_URL_HINTS[providerName],
    apiKey: "",
    model: PROVIDER_MODEL_HINTS[providerName],
    enabled: false
  };
}
var initialConversation = createConversation();
var defaultAppState = {
  conversations: [initialConversation],
  activeConversationId: initialConversation.id,
  models: [
    createModelTemplate("chatgpt"),
    createModelTemplate("kimi"),
    createModelTemplate("deepseek"),
    createModelTemplate("qwen"),
    createModelTemplate("doubao")
  ],
  currentModelId: null,
  settings: {
    general: {
      defaultTranslateTarget: DEFAULT_TRANSLATE_TARGET
    },
    avatarSidebar: {
      enabled: true,
      disabledSites: []
    },
    selectionToolbar: {
      enabled: true,
      appearance: "rich"
    },
    shortcuts: {
      openSidePanel: "Ctrl+K"
    }
  }
};

// src/shared/model-client.ts
function validateConfig(config) {
  if (!config.enabled) {
    throw new Error("\u5F53\u524D\u6A21\u578B\u5DF2\u7981\u7528\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u9875\u542F\u7528\u540E\u518D\u8BD5\u3002");
  }
  if (!config.baseUrl.trim()) {
    throw new Error("\u5F53\u524D\u6A21\u578B\u7F3A\u5C11 API \u5730\u5740\u3002");
  }
  if (!config.apiKey.trim()) {
    throw new Error("\u5F53\u524D\u6A21\u578B\u7F3A\u5C11 API Key\u3002");
  }
  if (!config.model.trim()) {
    throw new Error("\u5F53\u524D\u6A21\u578B\u7F3A\u5C11\u6A21\u578B\u540D\u79F0\u3002");
  }
  const endpoint = buildChatCompletionUrl(config.baseUrl);
  if (!endpoint) {
    throw new Error("\u6A21\u578B API \u5730\u5740\u65E0\u6548\u3002");
  }
  return endpoint;
}
async function streamModelReply(config, messages, handlers = {}) {
  const endpoint = validateConfig(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6e4);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        stream: true,
        messages
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`\u6A21\u578B\u8BF7\u6C42\u5931\u8D25\uFF08${response.status}\uFF09\uFF1A${detail || response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!response.body || contentType.includes("application/json")) {
      const payload = await response.json();
      const text = extractResponseText(payload);
      if (!text) {
        throw new Error("\u6A21\u578B\u8FD4\u56DE\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u89E3\u6790\u56DE\u590D\u5185\u5BB9\u3002");
      }
      await handlers.onChunk?.(text, text);
      await handlers.onComplete?.(text);
      return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    const flushEventBlock = async (rawEvent) => {
      const data = rawEvent.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n").trim();
      if (!data || data === "[DONE]") {
        return;
      }
      const payload = JSON.parse(data);
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
      throw new Error("\u6A21\u578B\u8FD4\u56DE\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u89E3\u6790\u56DE\u590D\u5185\u5BB9\u3002");
    }
    await handlers.onComplete?.(fullText);
    return fullText;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("\u6A21\u578B\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function requestModelReply(config, messages) {
  let finalText = "";
  await streamModelReply(config, messages, {
    onChunk: (_chunk, fullText) => {
      finalText = fullText;
    }
  });
  return finalText;
}

// src/shared/storage.ts
function normalizeState(state) {
  const base = structuredClone(defaultAppState);
  const next = {
    ...base,
    ...state,
    settings: {
      ...base.settings,
      ...state?.settings,
      general: {
        ...base.settings.general,
        ...state?.settings?.general
      },
      avatarSidebar: {
        ...base.settings.avatarSidebar,
        ...state?.settings?.avatarSidebar
      },
      selectionToolbar: {
        ...base.settings.selectionToolbar,
        ...state?.settings?.selectionToolbar
      },
      shortcuts: {
        ...base.settings.shortcuts,
        ...state?.settings?.shortcuts
      }
    },
    conversations: state?.conversations?.length ? sortConversations(state.conversations) : [createConversation()],
    models: state?.models?.length ? state.models : base.models,
    currentModelId: state?.currentModelId ?? base.currentModelId
  };
  if (!next.conversations.some((conversation) => conversation.id === next.activeConversationId)) {
    next.activeConversationId = next.conversations[0].id;
  }
  if (next.currentModelId && !next.models.some((model) => model.id === next.currentModelId && model.enabled)) {
    next.currentModelId = next.models.find((model) => model.enabled)?.id ?? null;
  }
  return next;
}
async function loadAppState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(result[STORAGE_KEY]);
}
async function saveAppState(state) {
  const normalized = normalizeState(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}
async function updateAppState(updater) {
  const current = await loadAppState();
  const next = await updater(current);
  return saveAppState(next);
}
async function getCurrentModelConfig(state) {
  const nextState = state ?? await loadAppState();
  const enabledModels = nextState.models.filter((model) => model.enabled);
  if (!enabledModels.length) {
    return null;
  }
  return enabledModels.find((model) => model.id === nextState.currentModelId) ?? enabledModels[0];
}

// src/background/index.ts
var OPEN_SIDE_PANEL_COMMAND = "open-side-panel";
async function initializeExtensionState() {
  const state = await loadAppState().catch(async () => saveAppState(defaultAppState));
  await saveAppState(state);
  await chrome.sidePanel.setOptions({ enabled: true, path: "sidepanel.html" }).catch(console.error);
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
}
async function openSidePanelForCurrentWindow(windowId) {
  if (windowId) {
    await chrome.sidePanel.open({ windowId });
    return;
  }
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.windowId) {
    await chrome.sidePanel.open({ windowId: activeTab.windowId });
  }
}
function upsertConversation(conversations, nextConversation) {
  const remaining = conversations.filter((conversation) => conversation.id !== nextConversation.id);
  return sortConversations([nextConversation, ...remaining]);
}
function ensureConversation(conversations, conversationId) {
  return conversations.find((conversation) => conversation.id === conversationId) ?? conversations[0] ?? createConversation();
}
function toModelMessages(messages) {
  return messages.filter((message) => message.role !== "assistant" || message.status !== "pending").map((message) => {
    if (message.role !== "user") {
      return {
        role: message.role,
        content: message.content
      };
    }
    return {
      role: message.role,
      content: `${message.content}${buildAttachmentContext(message.attachments)}`
    };
  });
}
async function processConversationMessage(payload) {
  const userMessage = {
    id: createId("message"),
    role: "user",
    content: payload.content,
    createdAt: Date.now(),
    attachments: payload.attachments
  };
  const assistantMessageId = createId("message");
  const pendingAssistantMessage = {
    id: assistantMessageId,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    status: "pending"
  };
  const stateAfterQueue = await updateAppState((state) => {
    const baseConversation = ensureConversation(state.conversations, payload.conversationId ?? state.activeConversationId);
    const shouldRename = baseConversation.title === NEW_CONVERSATION_TITLE && baseConversation.messages.filter((message) => message.role === "user").length === 0;
    const nextConversation = {
      ...baseConversation,
      title: shouldRename ? createConversationTitle(payload.titleHint || payload.content) : baseConversation.title,
      updatedAt: Date.now(),
      messages: [...baseConversation.messages, userMessage, pendingAssistantMessage]
    };
    return {
      ...state,
      activeConversationId: nextConversation.id,
      conversations: upsertConversation(state.conversations, nextConversation)
    };
  });
  const activeConversation = ensureConversation(stateAfterQueue.conversations, stateAfterQueue.activeConversationId);
  const currentModel = await getCurrentModelConfig(stateAfterQueue);
  if (!currentModel) {
    await persistAssistantMessage(activeConversation.id, assistantMessageId, {
      content: "\u8BF7\u5148\u5728\u8BBE\u7F6E\u9875\u914D\u7F6E\u5E76\u542F\u7528\u4E00\u4E2A\u6A21\u578B\uFF0C\u7136\u540E\u518D\u5F00\u59CB\u5BF9\u8BDD\u3002",
      status: "error",
      error: "\u672A\u914D\u7F6E\u6A21\u578B"
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
      }
    });
    streamedContent = content;
    await streamUpdater.done(content);
  } catch (error) {
    await streamUpdater.fail(error instanceof Error ? error.message : "\u6A21\u578B\u8C03\u7528\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", streamedContent);
  }
}
async function persistAssistantMessage(conversationId, messageId, payload) {
  await updateAppState((state) => {
    const conversation = ensureConversation(state.conversations, conversationId);
    const nextConversation = {
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map(
        (message) => message.id === messageId ? {
          ...message,
          content: payload.content,
          status: payload.status,
          error: payload.error
        } : message
      )
    };
    return {
      ...state,
      conversations: upsertConversation(state.conversations, nextConversation),
      activeConversationId: nextConversation.id
    };
  });
}
function createConversationStreamUpdater(conversationId, messageId) {
  let latestContent = "";
  let latestStatus = "pending";
  let latestError;
  let timer = null;
  let pendingCommit = Promise.resolve();
  const commit = async () => {
    const snapshot = {
      content: latestContent,
      status: latestStatus,
      error: latestError
    };
    pendingCommit = pendingCommit.then(() => persistAssistantMessage(conversationId, messageId, snapshot));
    await pendingCommit;
  };
  return {
    update(content) {
      latestContent = content;
      if (timer !== null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        void commit();
      }, 100);
    },
    async done(content) {
      latestContent = content;
      latestStatus = "done";
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await commit();
    },
    async fail(errorMessage, partialContent = latestContent) {
      latestContent = partialContent.trim() ? partialContent : errorMessage;
      latestStatus = "error";
      latestError = errorMessage;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await commit();
    }
  };
}
function createQuickActionStreamEmitter(sender, requestId, mode) {
  let latestContent = "";
  let latestPhase = "delta";
  let latestError;
  let timer = null;
  let pendingSend = Promise.resolve();
  const postMessage = async (payload) => {
    if (!sender.tab?.id) {
      return;
    }
    await chrome.tabs.sendMessage(
      sender.tab.id,
      {
        type: "QUICK_ACTION_STREAM_EVENT",
        payload
      },
      sender.frameId !== void 0 ? { frameId: sender.frameId } : void 0
    ).catch(() => void 0);
  };
  const flush = async () => {
    const snapshot = {
      requestId,
      mode,
      phase: latestPhase,
      content: latestContent,
      error: latestError
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
        content: ""
      });
    },
    update(content) {
      latestContent = content;
      latestPhase = "delta";
      latestError = void 0;
      if (timer !== null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, 80);
    },
    async done(content) {
      latestContent = content;
      latestPhase = "done";
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    },
    async fail(errorMessage, partialContent = latestContent) {
      latestContent = partialContent.trim() ? partialContent : errorMessage;
      latestPhase = "error";
      latestError = errorMessage;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    }
  };
}
function startQuickActionStream(payload, sender) {
  const emitter = createQuickActionStreamEmitter(sender, payload.requestId, payload.mode);
  emitter.start();
  void (async () => {
    const state = await loadAppState();
    const currentModel = await getCurrentModelConfig(state);
    if (!currentModel) {
      await emitter.fail("\u8BF7\u5148\u5728\u8BBE\u7F6E\u9875\u914D\u7F6E\u5E76\u542F\u7528\u6A21\u578B\u3002");
      return;
    }
    const prompt = payload.mode === "translate" ? `\u8BF7\u628A\u4E0B\u9762\u7684\u5185\u5BB9\u7FFB\u8BD1\u6210 ${payload.targetLanguage || state.settings.general.defaultTranslateTarget}\uFF0C\u53EA\u8F93\u51FA\u8BD1\u6587\u3002

\u539F\u6587\uFF1A
${payload.selectedText}` : `\u8BF7\u7ED3\u5408\u4E0A\u4E0B\u6587\u89E3\u91CA\u4E0B\u9762\u8FD9\u6BB5\u5185\u5BB9\uFF0C\u5C3D\u91CF\u6E05\u6670\u7B80\u6D01\u3002

\u5185\u5BB9\uFF1A
${payload.selectedText}`;
    let streamedContent = "";
    try {
      const content = await streamModelReply(currentModel, [
        {
          role: "system",
          content: payload.mode === "translate" ? "\u4F60\u662F\u4E00\u540D\u51C6\u786E\u81EA\u7136\u7684\u7FFB\u8BD1\u52A9\u624B\uFF0C\u4F1A\u4FDD\u7559\u539F\u6587\u5173\u952E\u4FE1\u606F\u3002" : "\u4F60\u662F\u4E00\u540D\u64C5\u957F\u7F51\u9875\u5185\u5BB9\u89E3\u91CA\u7684\u52A9\u624B\uFF0C\u4F1A\u57FA\u4E8E\u7528\u6237\u63D0\u4F9B\u7684\u7247\u6BB5\u7ED9\u51FA\u76F4\u63A5\u3001\u6E05\u6670\u7684\u89E3\u91CA\u3002"
        },
        {
          role: "user",
          content: prompt
        }
      ], {
        onChunk: (_chunk, fullText) => {
          streamedContent = fullText;
          emitter.update(fullText);
        }
      });
      streamedContent = content;
      await emitter.done(content);
    } catch (error) {
      await emitter.fail(error instanceof Error ? error.message : "\u6A21\u578B\u8C03\u7528\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", streamedContent);
    }
  })();
}
async function handleSummaryRequest(payload, sender) {
  await openSidePanelForCurrentWindow(sender.tab?.windowId);
  await processConversationMessage({
    titleHint: "\u9875\u9762\u603B\u7ED3",
    content: `\u8BF7\u603B\u7ED3\u6B64\u9875\u9762\u3002

\u9875\u9762 URL\uFF1A${payload.pageUrl}`
  });
}
async function handleSelectionChat(payload, sender) {
  await openSidePanelForCurrentWindow(sender.tab?.windowId);
  await processConversationMessage({
    titleHint: payload.titleHint || payload.prompt,
    content: [
      "\u8BF7\u57FA\u4E8E\u4E0B\u9762\u7684\u9009\u4E2D\u6587\u672C\u56DE\u7B54\u6211\u7684\u95EE\u9898\u3002",
      `\u9009\u4E2D\u6587\u672C\uFF1A
${payload.selectedText}`,
      `\u6211\u7684\u8981\u6C42\uFF1A
${payload.prompt}`
    ].join("\n\n")
  });
}
async function handleCreateConversation() {
  const conversation = createConversation();
  await updateAppState((state) => ({
    ...state,
    activeConversationId: conversation.id,
    conversations: upsertConversation(state.conversations, conversation)
  }));
  return {
    conversationId: conversation.id
  };
}
async function handleMessage(message, sender) {
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
        activeConversationId: message.payload.conversationId
      }));
      return { ok: true };
    case "SEND_CHAT_MESSAGE":
      void processConversationMessage(message.payload);
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
          content: "\u8BF7\u56DE\u590D\u201C\u8FDE\u63A5\u6210\u529F\u201D\u3002"
        }
      ]);
      return { ok: true, data: { text } };
    }
    default:
      return { ok: false, error: "\u672A\u77E5\u6D88\u606F\u7C7B\u578B\u3002" };
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender).then((response) => sendResponse(response)).catch(
    (error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "\u53D1\u751F\u672A\u77E5\u9519\u8BEF\u3002"
    })
  );
  return true;
});
//# sourceMappingURL=background.js.map
