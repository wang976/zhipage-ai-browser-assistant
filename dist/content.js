"use strict";
(() => {
  // src/shared/constants.ts
  var STORAGE_KEY = "zhipage-assistant-state";
  var NEW_CONVERSATION_TITLE = "\u65B0\u4F1A\u8BDD";
  var DEFAULT_TRANSLATE_TARGET = "\u4E2D\u6587\uFF08\u7B80\u4F53\uFF09";
  var TARGET_LANGUAGES = [
    "\u4E2D\u6587\uFF08\u7B80\u4F53\uFF09",
    "English",
    "\u65E5\u672C\u8A9E",
    "\uD55C\uAD6D\uC5B4",
    "Fran\xE7ais",
    "Deutsch"
  ];
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
  function sortConversations(conversations) {
    return [...conversations].sort((left, right) => right.updatedAt - left.updatedAt);
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
  function subscribeToAppState(listener) {
    const handleChange = (changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) {
        return;
      }
      listener(normalizeState(changes[STORAGE_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }

  // src/content/styles.ts
  var contentStyles = `
  :host {
    all: initial;
  }

  .zp-root {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    color: #182132;
    font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  }

  .zp-avatar-wrap,
  .zp-toolbar,
  .zp-chat-toolbar,
  .zp-card,
  .zp-toast {
    pointer-events: auto;
  }

  .zp-avatar-wrap {
    position: fixed;
    right: 18px;
    width: 44px;
    height: 44px;
  }

  .zp-avatar-button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(180deg, #f9fbff, #ddebff);
    box-shadow:
      0 10px 20px rgba(31, 55, 115, 0.18),
      inset 0 0 0 1px rgba(255, 255, 255, 0.9);
  }

  .zp-avatar-button img {
    width: 34px;
    height: 34px;
    border-radius: 50%;
  }

  .zp-avatar-tip {
    position: absolute;
    right: calc(100% + 18px);
    top: 0;
    opacity: 0;
    transform: translateX(8px);
    padding: 8px 12px;
    border-radius: 14px;
    color: white;
    font-size: 12px;
    line-height: 1.1;
    white-space: nowrap;
    pointer-events: none;
    background: #11161f;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-tip::after {
    content: "";
    position: absolute;
    top: 50%;
    right: -6px;
    width: 10px;
    height: 10px;
    background: #11161f;
    transform: translateY(-50%) rotate(45deg);
  }

  .zp-avatar-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: -4px;
    display: grid;
    justify-items: center;
    width: 52px;
    opacity: 0;
    transform: translateY(-6px);
    padding: 8px 0;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 42px rgba(30, 48, 92, 0.16);
    transition: opacity 140ms ease, transform 140ms ease;
    pointer-events: none;
  }

  .zp-avatar-menu::before {
    content: "";
    position: absolute;
    top: -8px;
    right: 0;
    width: 100%;
    height: 8px;
    background: transparent;
  }

  .zp-avatar-dismiss {
    position: absolute;
    left: -9px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(114, 128, 154, 0.24);
    border-radius: 50%;
    padding: 0;
    color: #8e98aa;
    font-size: 18px;
    line-height: 1;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 6px 14px rgba(30, 48, 92, 0.12);
    opacity: 0;
    transform: scale(0.88);
    pointer-events: none;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-wrap:hover .zp-avatar-tip,
  .zp-avatar-wrap:hover .zp-avatar-menu {
    opacity: 1;
    transform: translateY(0);
  }

  .zp-avatar-wrap:hover .zp-avatar-menu {
    pointer-events: auto;
  }

  .zp-avatar-wrap:hover .zp-avatar-dismiss {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }

  .zp-avatar-action {
    position: relative;
    border: 0;
    width: 100%;
    height: 44px;
    border-radius: 16px;
    padding: 0;
    color: #182132;
    background: transparent;
  }

  .zp-avatar-action svg {
    width: 19px;
    height: 19px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .zp-avatar-action::before {
    content: attr(data-tooltip);
    position: absolute;
    right: calc(100% + 16px);
    top: 50%;
    opacity: 0;
    transform: translate(8px, -50%);
    padding: 8px 10px;
    border-radius: 14px;
    color: white;
    font-size: 12px;
    line-height: 1.15;
    white-space: nowrap;
    pointer-events: none;
    background: #11161f;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-action::after {
    content: "";
    position: absolute;
    top: 50%;
    right: calc(100% + 10px);
    width: 10px;
    height: 10px;
    opacity: 0;
    pointer-events: none;
    background: #11161f;
    transform: translateY(-50%) rotate(45deg);
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-action:hover::before {
    opacity: 1;
    transform: translate(0, -50%);
  }

  .zp-avatar-action:hover::after {
    opacity: 1;
  }

  .zp-avatar-divider {
    width: 20px;
    height: 1px;
    background: rgba(114, 128, 154, 0.18);
  }

  .zp-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: calc(100vw - 28px);
    padding: 5px 7px;
    border: 1px solid rgba(114, 128, 154, 0.16);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: 0 12px 28px rgba(28, 43, 78, 0.14);
    backdrop-filter: blur(18px);
  }

  .zp-toolbar.is-minimal {
    gap: 3px;
    padding: 5px;
  }

  .zp-toolbar-button,
  .zp-toolbar-avatar,
  .zp-toolbar-control,
  .zp-chat-toolbar,
  .zp-card-close,
  .zp-chat-send,
  .zp-toast,
  .zp-card-select {
    border: 0;
  }

  .zp-toolbar,
  .zp-toolbar-avatar,
  .zp-toolbar-button,
  .zp-toolbar-control,
  .zp-chat-toolbar,
  .zp-chat-send {
    box-sizing: border-box;
  }

  .zp-toolbar-grip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: 0 0 auto;
    padding: 0 3px 0 1px;
  }

  .zp-toolbar-grip span {
    width: 2px;
    height: 16px;
    border-radius: 999px;
    background: rgba(114, 128, 154, 0.52);
  }

  .zp-toolbar-avatar {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    padding: 0;
    background: linear-gradient(180deg, #f8fbff, #d9e7ff);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.95);
  }

  .zp-toolbar-avatar img {
    width: 18px;
    height: 18px;
    border-radius: 50%;
  }

  .zp-toolbar-button,
  .zp-toolbar-control,
  .zp-chat-send {
    cursor: pointer;
    transition:
      background 140ms ease,
      color 140ms ease,
      transform 140ms ease,
      box-shadow 140ms ease;
  }

  .zp-toolbar-button,
  .zp-toolbar-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    flex: 0 0 auto;
    min-height: 30px;
    border-radius: 12px;
    padding: 0 9px;
    color: #182132;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }

  .zp-toolbar-control {
    width: 30px;
    min-width: 30px;
    padding: 0;
  }

  .zp-toolbar-button.is-active {
    background: rgba(47, 106, 247, 0.1);
    color: #2458d8;
  }

  .zp-toolbar-button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
  }

  .zp-toolbar-button-text {
    white-space: nowrap;
  }

  .zp-toolbar-button svg,
  .zp-toolbar-control svg,
  .zp-chat-send svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .zp-toolbar.is-minimal .zp-toolbar-button {
    width: 30px;
    min-width: 30px;
    padding: 0;
  }

  .zp-toolbar.is-minimal .zp-toolbar-button-text {
    display: none;
  }

  .zp-toolbar-button:hover,
  .zp-toolbar-control:hover,
  .zp-avatar-action:hover,
  .zp-avatar-dismiss:hover,
  .zp-card-close:hover {
    background: rgba(47, 106, 247, 0.09);
  }

  .zp-toolbar-separator {
    width: 1px;
    height: 16px;
    flex: 0 0 auto;
    background: rgba(114, 128, 154, 0.22);
  }

  .zp-chat-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100vw - 28px);
    min-height: 44px;
    padding: 0 10px 0 8px;
    border: 1px solid rgba(198, 205, 216, 0.9);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 10px 24px rgba(17, 24, 39, 0.1);
    backdrop-filter: blur(18px);
    transform-origin: center center;
    animation: zp-chat-expand 180ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }

  .zp-chat-input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    outline: none;
    padding: 0;
    color: #182132;
    font-size: 13px;
    line-height: 1.2;
    background: transparent;
  }

  .zp-chat-input::placeholder {
    color: #c3c7ce;
  }

  .zp-chat-send {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    min-width: 28px;
    padding: 0;
    border-radius: 50%;
    color: white;
    background: linear-gradient(135deg, #2f6af7, #4d8dff);
  }

  .zp-chat-send:hover {
    background: linear-gradient(135deg, #255ee4, #3d7ef9);
    box-shadow: 0 8px 18px rgba(47, 106, 247, 0.22);
  }

  .zp-chat-send:disabled {
    cursor: default;
    color: #ffffff;
    background: #d7d9de;
    box-shadow: none;
  }

  .zp-chat-send:disabled:hover {
    background: #d7d9de;
  }

  @keyframes zp-chat-expand {
    from {
      opacity: 0.72;
      transform: scaleX(0.62);
    }

    to {
      opacity: 1;
      transform: scaleX(1);
    }
  }

  .zp-card {
    position: fixed;
    display: grid;
    gap: 14px;
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    padding: 18px;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 48px rgba(30, 48, 92, 0.18);
    backdrop-filter: blur(20px);
  }

  .zp-card-drag-zone {
    display: grid;
    place-items: center;
    margin-top: -2px;
  }

  .zp-card-drag-handle {
    width: 38px;
    height: 6px;
    border: 0;
    border-radius: 999px;
    background: rgba(114, 128, 154, 0.42);
    cursor: grab;
  }

  .zp-card-drag-handle:active {
    cursor: grabbing;
  }

  .zp-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .zp-card-header strong {
    font-size: 18px;
  }

  .zp-card-close {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    color: #72809a;
    background: transparent;
  }

  .zp-card-lang-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .zp-card-lang-row span {
    text-align: center;
    color: #72809a;
  }

  .zp-card-select {
    width: 100%;
    border-radius: 16px;
    padding: 12px 14px;
    color: #182132;
    background: rgba(242, 246, 255, 0.96);
  }

  .zp-card-source {
    border-left: 4px solid rgba(47, 106, 247, 0.28);
    padding-left: 12px;
    color: #72809a;
    line-height: 1.6;
  }

  .zp-card-body {
    min-height: 58px;
    white-space: pre-wrap;
    line-height: 1.78;
  }

  .zp-card-footer {
    color: #72809a;
    font-size: 12px;
  }

  .zp-toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    padding: 12px 16px;
    border-radius: 16px;
    color: white;
    background: rgba(17, 22, 31, 0.94);
    box-shadow: 0 14px 32px rgba(17, 22, 31, 0.24);
  }
`;

  // src/content/index.ts
  function escapeHtml(text) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function multiline(text) {
    return escapeHtml(text).replaceAll("\n", "<br />");
  }
  function isEditableNode(node) {
    const element = node instanceof Element ? node : node?.parentElement;
    return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
  }
  function matchesDisabledSite(patterns) {
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    const URLPatternCtor = globalThis.URLPattern;
    return patterns.some((pattern) => {
      const normalized = pattern.trim();
      if (!normalized) {
        return false;
      }
      if (normalized.includes("://")) {
        if (URLPatternCtor) {
          try {
            return new URLPatternCtor(normalized).test(currentUrl);
          } catch {
            return currentUrl.includes(normalized);
          }
        }
        return currentUrl.includes(normalized);
      }
      if (normalized.startsWith("*.")) {
        const suffix = normalized.slice(2);
        return hostname === suffix || hostname.endsWith(`.${suffix}`);
      }
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  }
  function getIconUrl() {
    return chrome.runtime.getURL("assets/icon.svg");
  }
  function getAvatarActionIcon(kind) {
    if (kind === "ocr") {
      return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4H5a1 1 0 0 0-1 1v2M17 4h2a1 1 0 0 1 1 1v2M7 20H5a1 1 0 0 1-1-1v-2M17 20h2a1 1 0 0 0 1-1v-2M8 8h8v8H8z" />
      </svg>
    `;
    }
    if (kind === "summary") {
      return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4h6l4 4v11a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm5 1.5V9h3.5M9 12h6M9 15h6M9 18h4" />
      </svg>
    `;
    }
    return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h8M9 7c0 6-2.5 10-5.5 12M9 7c0 3.5 2 7 5.5 9M15 5l4 4M18.5 10.5l-7 7M14 19l5 1-1-5" />
    </svg>
  `;
  }
  function getToolbarActionIcon(kind) {
    switch (kind) {
      case "search":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 4a7 7 0 1 0 7 7M20 20l-4-4M18 5l.6 1.4L20 7l-1.4.6L18 9l-.6-1.4L16 7l1.4-.6z" />
        </svg>
      `;
      case "explain":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5h9a2 2 0 0 1 2 2v11.5H8.5a2.5 2.5 0 1 0 0 5H19" />
          <path d="M6.5 18H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h1.5" />
        </svg>
      `;
      case "read":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9v6M9 7v10M14 8c2 1.2 3.2 3.1 3.2 5s-1.2 3.8-3.2 5" />
          <path d="M17.5 5.5c3.1 2 5 4.8 5 7.5s-1.9 5.5-5 7.5" />
        </svg>
      `;
      case "translate":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h9M8.5 6c0 5.2-2.4 9.3-5.5 12M8.5 6c1 3.3 3 6.3 6 8.7M14 5h6M17 5v12" />
          <path d="M13 19l4-9 4 9M14.3 16h5.4" />
        </svg>
      `;
      case "chat":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 15.5h10M7 11.5h7M20 11c0 4.4-4 8-9 8-1.1 0-2.1-.2-3.1-.5L4 20l1.2-3.1C4.4 15.4 4 14.2 4 13c0-4.4 4-8 9-8s7 2.7 7 6z" />
        </svg>
      `;
      case "collapse":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      `;
      case "send":
        return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M6 11l6-6 6 6" />
        </svg>
      `;
    }
  }
  function createToolbarButtonContent(label, icon, appearance) {
    return `
    <span class="zp-toolbar-button-icon" aria-hidden="true">${icon}</span>
    ${appearance === "rich" ? `<span class="zp-toolbar-button-text">${escapeHtml(label)}</span>` : ""}
  `;
  }
  function createToolbarButton(action, label, icon, appearance, active = false) {
    return `
    <button
      aria-label="${escapeHtml(label)}"
      class="zp-toolbar-button${active ? " is-active" : ""}"
      data-action="${action}"
      type="button"
    >
      ${createToolbarButtonContent(label, icon, appearance)}
    </button>
  `;
  }
  function createToolbarIconButton(action, label, icon) {
    return `
    <button aria-label="${escapeHtml(label)}" class="zp-toolbar-control" data-action="${action}" type="button">
      ${icon}
    </button>
  `;
  }
  function runtimeRequest(payload) {
    return chrome.runtime.sendMessage(payload).then((response) => {
      if (!response?.ok) {
        throw new Error(response?.error || "\u8BF7\u6C42\u5931\u8D25");
      }
      return response.data;
    });
  }
  var ContentAssistant = class {
    state = null;
    host;
    shadowRoot;
    avatarZone;
    toolbarZone;
    cardZone;
    toastZone;
    selection = null;
    toolbarMode = "actions";
    toolbarDraft = "";
    chatToolbarWidth = null;
    cards = [];
    nextCardZIndex = 20;
    avatarDismissed = false;
    avatarTop = Math.round(window.innerHeight * 0.42);
    suppressAvatarClick = false;
    toast = "";
    toastTimer = null;
    unsubscribe = null;
    runtimeMessageListener = (message) => {
      if (message?.type !== "QUICK_ACTION_STREAM_EVENT") {
        return;
      }
      const card = this.cards.find((item) => item.activeRequestId === message.payload.requestId);
      if (!card) {
        return;
      }
      if (message.payload.phase === "start") {
        card.status = "loading";
        card.result = "";
      } else if (message.payload.phase === "delta") {
        card.status = "loading";
        card.result = message.payload.content;
      } else if (message.payload.phase === "done") {
        card.status = "done";
        card.result = message.payload.content;
      } else if (message.payload.phase === "error") {
        card.status = "error";
        card.result = message.payload.content || message.payload.error || "\u8BF7\u6C42\u5931\u8D25";
      }
      this.renderCards();
    };
    constructor() {
      this.host = document.createElement("div");
      this.host.id = "zhipage-assistant-root";
      this.shadowRoot = this.host.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>${contentStyles}</style>
      <div class="zp-root">
        <div data-zone="avatar"></div>
        <div data-zone="toolbar"></div>
        <div data-zone="cards"></div>
        <div data-zone="toast"></div>
      </div>
    `;
      this.avatarZone = this.shadowRoot.querySelector("[data-zone='avatar']");
      this.toolbarZone = this.shadowRoot.querySelector("[data-zone='toolbar']");
      this.cardZone = this.shadowRoot.querySelector("[data-zone='cards']");
      this.toastZone = this.shadowRoot.querySelector("[data-zone='toast']");
    }
    isEventInsideAssistant(event) {
      return event.composedPath().includes(this.host);
    }
    async init() {
      document.documentElement.append(this.host);
      this.state = await loadAppState();
      this.unsubscribe = subscribeToAppState((nextState) => {
        this.state = nextState;
        if (!this.shouldShowToolbar()) {
          this.hideToolbar();
        }
        this.render();
      });
      this.shadowRoot.addEventListener("click", (event) => {
        void this.handleShadowClick(event);
      });
      this.shadowRoot.addEventListener("input", (event) => this.handleShadowInput(event));
      this.shadowRoot.addEventListener("change", (event) => {
        void this.handleShadowChange(event);
      });
      this.shadowRoot.addEventListener("pointerdown", (event) => {
        this.handleShadowPointerDown(event);
      });
      this.shadowRoot.addEventListener("keydown", (event) => {
        void this.handleShadowKeydown(event);
      });
      chrome.runtime.onMessage.addListener(this.runtimeMessageListener);
      document.addEventListener("mouseup", (event) => {
        if (this.isEventInsideAssistant(event)) {
          return;
        }
        window.setTimeout(() => this.captureSelection(), 0);
      });
      document.addEventListener("keyup", (event) => {
        if (this.isEventInsideAssistant(event)) {
          return;
        }
        window.setTimeout(() => this.captureSelection(), 0);
      });
      document.addEventListener(
        "mousedown",
        (event) => {
          if (this.isEventInsideAssistant(event)) {
            return;
          }
          this.hideToolbar();
        },
        true
      );
      document.addEventListener(
        "keydown",
        (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            void this.openSidePanel();
          }
        },
        true
      );
      window.addEventListener(
        "scroll",
        () => {
          if (this.selection) {
            this.hideToolbar();
          }
        },
        true
      );
      window.addEventListener("resize", () => {
        this.avatarTop = this.clampAvatarTop(this.avatarTop);
        const avatarWrap = this.shadowRoot.querySelector(".zp-avatar-wrap");
        if (avatarWrap) {
          avatarWrap.style.top = `${this.avatarTop}px`;
        }
      });
      this.render();
    }
    destroy() {
      this.unsubscribe?.();
      chrome.runtime.onMessage.removeListener(this.runtimeMessageListener);
      this.host.remove();
    }
    shouldShowAvatar() {
      if (!this.state) {
        return false;
      }
      if (!this.state.settings.avatarSidebar.enabled) {
        return false;
      }
      return !matchesDisabledSite(this.state.settings.avatarSidebar.disabledSites);
    }
    shouldShowToolbar() {
      return Boolean(this.state?.settings.selectionToolbar.enabled);
    }
    getToolbarAppearance() {
      return this.state?.settings.selectionToolbar.appearance || "rich";
    }
    showToast(message) {
      this.toast = message;
      this.renderToast();
      if (this.toastTimer) {
        window.clearTimeout(this.toastTimer);
      }
      this.toastTimer = window.setTimeout(() => {
        this.toast = "";
        this.renderToast();
      }, 2200);
    }
    render() {
      this.renderAvatar();
      this.renderToolbar();
      this.renderCards();
      this.renderToast();
    }
    renderAvatar() {
      if (!this.shouldShowAvatar() || this.avatarDismissed) {
        this.avatarZone.innerHTML = "";
        return;
      }
      const iconUrl = getIconUrl();
      this.avatarZone.innerHTML = `
      <div class="zp-avatar-wrap" style="top:${this.avatarTop}px;">
        <div class="zp-avatar-tip">Ctrl + K</div>
        <button aria-label="\u9690\u85CF\u60AC\u6D6E\u5934\u50CF" class="zp-avatar-dismiss" data-action="dismiss-avatar" type="button">\xD7</button>
        <button class="zp-avatar-button" data-action="open-side-panel" data-drag-avatar="true" type="button">
          <img alt="\u667A\u9875\u6D4F\u89C8\u5668 AI \u52A9\u624B" src="${iconUrl}" />
        </button>
        <div class="zp-avatar-menu">
          <button
            aria-label="\u622A\u56FE\u8BC6\u522B\u6587\u5B57"
            class="zp-avatar-action"
            data-action="avatar-ocr"
            data-tooltip="\u622A\u56FE\u8BC6\u522B\u6587\u5B57"
            title="\u622A\u56FE\u8BC6\u522B\u6587\u5B57"
            type="button"
          >
            ${getAvatarActionIcon("ocr")}
          </button>
          <div class="zp-avatar-divider"></div>
          <button
            aria-label="\u603B\u7ED3\u6B64\u9875\u9762"
            class="zp-avatar-action"
            data-action="avatar-summary"
            data-tooltip="\u603B\u7ED3\u6B64\u9875\u9762"
            title="\u603B\u7ED3\u6B64\u9875\u9762"
            type="button"
          >
            ${getAvatarActionIcon("summary")}
          </button>
          <div class="zp-avatar-divider"></div>
          <button
            aria-label="\u7FFB\u8BD1\u6B64\u9875\u9762"
            class="zp-avatar-action"
            data-action="avatar-translate"
            data-tooltip="\u7FFB\u8BD1\u6B64\u9875\u9762"
            title="\u7FFB\u8BD1\u6B64\u9875\u9762"
            type="button"
          >
            ${getAvatarActionIcon("translate")}
          </button>
        </div>
      </div>
    `;
    }
    getDefaultToolbarWidth() {
      const preferredWidth = this.getToolbarAppearance() === "rich" ? 600 : 360;
      return Math.min(preferredWidth, Math.max(window.innerWidth - 28, 260));
    }
    getChatToolbarWidth() {
      return Math.min(this.chatToolbarWidth ?? this.getDefaultToolbarWidth(), Math.max(window.innerWidth - 28, 260));
    }
    getToolbarPosition(width = this.toolbarMode === "chat" ? this.getChatToolbarWidth() : this.getDefaultToolbarWidth()) {
      if (!this.selection) {
        return "";
      }
      const left = Math.min(
        Math.max(this.selection.rect.left + this.selection.rect.width / 2 - width / 2, 14),
        window.innerWidth - width - 14
      );
      const preferredTop = this.selection.rect.top - 64;
      const top = preferredTop > 16 ? preferredTop : this.selection.rect.bottom + 12;
      return `left:${left}px; top:${top}px;`;
    }
    renderToolbar() {
      if (!this.selection || !this.shouldShowToolbar()) {
        this.toolbarZone.innerHTML = "";
        return;
      }
      const iconUrl = getIconUrl();
      const style = this.getToolbarPosition();
      const appearance = this.getToolbarAppearance();
      const toolbarClassName = ["zp-toolbar", appearance === "minimal" ? "is-minimal" : ""].filter(Boolean).join(" ");
      const toolbarGrip = `
      <div class="zp-toolbar-grip" aria-hidden="true">
        <span></span>
        <span></span>
      </div>
    `;
      const actionButtons = [
        createToolbarButton("toolbar-search", "AI\u641C\u7D22", getToolbarActionIcon("search"), appearance),
        createToolbarButton("toolbar-explain", "\u89E3\u91CA", getToolbarActionIcon("explain"), appearance),
        createToolbarButton("toolbar-read", "\u6717\u8BFB", getToolbarActionIcon("read"), appearance),
        createToolbarButton("toolbar-translate", "\u7FFB\u8BD1", getToolbarActionIcon("translate"), appearance)
      ].join("");
      if (this.toolbarMode === "chat") {
        const canSend = Boolean(this.toolbarDraft.trim());
        const chatWidth = this.getChatToolbarWidth();
        this.toolbarZone.innerHTML = `
        <div class="zp-chat-toolbar" style="${style} width:${chatWidth}px;">
          ${createToolbarIconButton("toolbar-chat-close", "\u6536\u8D77\u63D0\u95EE\u8F93\u5165", getToolbarActionIcon("collapse"))}
          <input
            class="zp-chat-input"
            data-role="chat-input"
            placeholder="\u8F93\u5165\u60F3\u95EE\u7684\u95EE\u9898"
            spellcheck="false"
            value="${escapeHtml(this.toolbarDraft)}"
          />
          <button
            aria-label="\u53D1\u9001\u63D0\u95EE"
            class="zp-chat-send"
            data-action="send-selection-chat"
            type="button"
            ${canSend ? "" : "disabled"}
          >
            ${getToolbarActionIcon("send")}
          </button>
        </div>
      `;
        window.setTimeout(() => {
          const input = this.shadowRoot.querySelector("[data-role='chat-input']");
          input?.focus();
          if (input) {
            input.selectionStart = input.value.length;
            input.selectionEnd = input.value.length;
          }
        }, 0);
        return;
      }
      this.toolbarZone.innerHTML = `
      <div class="${toolbarClassName}" style="${style}">
        ${toolbarGrip}
        <button class="zp-toolbar-avatar" data-action="open-side-panel" type="button">
          <img alt="\u667A\u9875\u6D4F\u89C8\u5668 AI \u52A9\u624B" src="${iconUrl}" />
        </button>
        ${actionButtons}
        <div class="zp-toolbar-separator"></div>
        ${createToolbarButton("toolbar-chat", "\u95EE\u95EE\u667A\u9875", getToolbarActionIcon("chat"), appearance, true)}
      </div>
    `;
    }
    renderCards() {
      if (!this.cards.length) {
        this.cardZone.innerHTML = "";
        return;
      }
      this.cardZone.innerHTML = this.cards.map((card) => {
        const languageRow = card.kind === "translate" ? `
                <div class="zp-card-lang-row">
                  <select class="zp-card-select" disabled>
                    <option>\u81EA\u52A8\u68C0\u6D4B</option>
                  </select>
                  <span>\u2192</span>
                  <select class="zp-card-select" data-card-target="${card.id}">
                    ${TARGET_LANGUAGES.map(
          (language) => `<option value="${escapeHtml(language)}" ${card.targetLanguage === language ? "selected" : ""}>${escapeHtml(language)}</option>`
        ).join("")}
                  </select>
                </div>
              ` : "";
        return `
          <section
            class="zp-card"
            data-card-id="${card.id}"
            style="left:${card.position.x}px; top:${card.position.y}px; z-index:${card.zIndex};"
          >
            <div class="zp-card-drag-zone">
              <button class="zp-card-drag-handle" data-drag-card="${card.id}" type="button" aria-label="\u62D6\u52A8\u5361\u7247"></button>
            </div>
            <div class="zp-card-header">
              <strong>${card.kind === "translate" ? "\u7FFB\u8BD1" : "\u89E3\u91CA"}</strong>
              <button class="zp-card-close" data-action="close-card" data-card-id="${card.id}" type="button">\u2715</button>
            </div>
            ${languageRow}
            <div class="zp-card-source">${multiline(truncateText(card.sourceText, 180))}</div>
            <div class="zp-card-body">${card.status === "loading" ? card.result ? multiline(card.result) : "\u6B63\u5728\u8BF7\u6C42\u5F53\u524D\u6A21\u578B\u2026" : card.status === "error" ? `<span style="color:#cf4f4f">${multiline(card.result)}</span>` : multiline(card.result)}</div>
            <div class="zp-card-footer">\u56DE\u7B54\u4F1A\u4F18\u5148\u7ED3\u5408\u5F53\u524D\u7F51\u9875\u5185\u5BB9\u4E0E\u6240\u9009\u6A21\u578B\u914D\u7F6E\u3002</div>
          </section>
        `;
      }).join("");
    }
    renderToast() {
      this.toastZone.innerHTML = this.toast ? `<div class="zp-toast">${escapeHtml(this.toast)}</div>` : "";
    }
    hideToolbar() {
      this.selection = null;
      this.toolbarMode = "actions";
      this.toolbarDraft = "";
      this.chatToolbarWidth = null;
      this.renderToolbar();
    }
    captureSelection() {
      if (!this.shouldShowToolbar()) {
        this.hideToolbar();
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        this.hideToolbar();
        return;
      }
      const text = selection.toString().replace(/\s+/g, " ").trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!text || !rect || isEditableNode(selection.anchorNode) || selection.anchorNode && this.host.contains(selection.anchorNode)) {
        this.hideToolbar();
        return;
      }
      if (rect.width === 0 && rect.height === 0) {
        this.hideToolbar();
        return;
      }
      this.selection = {
        text: truncateText(text, 6e3),
        rect
      };
      this.toolbarMode = "actions";
      this.toolbarDraft = "";
      this.renderToolbar();
    }
    async openSidePanel() {
      await runtimeRequest({ type: "OPEN_SIDE_PANEL" });
    }
    requestQuickAction(kind, cardId) {
      const card = this.cards.find((item) => item.id === cardId);
      if (!card) {
        return;
      }
      const requestId = crypto.randomUUID();
      card.activeRequestId = requestId;
      card.status = "loading";
      card.result = "";
      this.bringCardToFront(cardId);
      this.renderCards();
      void runtimeRequest({
        type: "QUICK_ACTION",
        payload: {
          requestId,
          mode: kind,
          selectedText: card.sourceText,
          targetLanguage: card.targetLanguage,
          pageTitle: document.title,
          pageUrl: window.location.href
        }
      }).catch((error) => {
        if (card.activeRequestId !== requestId) {
          return;
        }
        card.status = "error";
        card.result = error instanceof Error ? error.message : "\u8BF7\u6C42\u5931\u8D25";
        this.renderCards();
      });
    }
    async addCard(kind) {
      if (!this.selection || !this.state) {
        return;
      }
      const card = {
        id: crypto.randomUUID(),
        kind,
        sourceText: this.selection.text,
        targetLanguage: this.state.settings.general.defaultTranslateTarget,
        status: "loading",
        result: "",
        activeRequestId: null,
        position: this.createCardPosition(),
        zIndex: ++this.nextCardZIndex
      };
      this.cards = [card, ...this.cards];
      this.renderCards();
      this.requestQuickAction(kind, card.id);
    }
    async summarizeCurrentPage() {
      await runtimeRequest({
        type: "PAGE_SUMMARY",
        payload: {
          pageUrl: window.location.href
        }
      });
      this.showToast("\u5DF2\u628A\u5F53\u524D\u9875\u9762\u603B\u7ED3\u8BF7\u6C42\u53D1\u9001\u5230\u4FA7\u8FB9\u680F\u3002");
    }
    async sendSelectionChat() {
      if (!this.selection || !this.toolbarDraft.trim()) {
        return;
      }
      await runtimeRequest({
        type: "SELECTION_CHAT",
        payload: {
          selectedText: this.selection.text,
          prompt: this.toolbarDraft.trim(),
          titleHint: this.toolbarDraft.trim()
        }
      });
      this.showToast("\u5DF2\u6253\u5F00\u4FA7\u8FB9\u680F\uFF0C\u5E76\u628A\u9009\u4E2D\u6587\u672C\u4F5C\u4E3A\u4E0A\u4E0B\u6587\u53D1\u9001\u3002");
      this.hideToolbar();
    }
    handleShadowInput(event) {
      const target = event.target;
      if (target?.dataset.role === "chat-input") {
        this.toolbarDraft = target.value;
      }
    }
    async handleShadowChange(event) {
      const target = event.target;
      const cardId = target?.dataset.cardTarget;
      if (!cardId) {
        return;
      }
      const card = this.cards.find((item) => item.id === cardId);
      if (!card) {
        return;
      }
      card.targetLanguage = target.value;
      this.requestQuickAction("translate", card.id);
    }
    async handleShadowClick(event) {
      const trigger = event.target?.closest("[data-action]");
      if (!trigger) {
        return;
      }
      const action = trigger.dataset.action;
      if (!action) {
        return;
      }
      switch (action) {
        case "open-side-panel":
          if (this.suppressAvatarClick) {
            this.suppressAvatarClick = false;
            break;
          }
          await this.openSidePanel();
          break;
        case "avatar-summary":
          await this.summarizeCurrentPage();
          break;
        case "dismiss-avatar":
          this.avatarDismissed = true;
          this.renderAvatar();
          break;
        case "avatar-ocr":
        case "avatar-translate":
        case "toolbar-search":
        case "toolbar-read":
          this.showToast("\u6682\u672A\u5B9E\u73B0\uFF0C\u5DF2\u9884\u7559\u6269\u5C55\u5165\u53E3\u3002");
          break;
        case "toolbar-explain":
          await this.addCard("explain");
          break;
        case "toolbar-translate":
          await this.addCard("translate");
          break;
        case "toolbar-chat":
          this.chatToolbarWidth = this.shadowRoot.querySelector(".zp-toolbar")?.offsetWidth ?? null;
          this.toolbarMode = "chat";
          this.renderToolbar();
          break;
        case "toolbar-chat-close":
          this.toolbarMode = "actions";
          this.renderToolbar();
          break;
        case "send-selection-chat":
          await this.sendSelectionChat();
          break;
        case "close-card": {
          const cardId = trigger.dataset.cardId;
          this.cards = this.cards.filter((card) => card.id !== cardId);
          this.renderCards();
          break;
        }
        default:
          break;
      }
    }
    handleShadowPointerDown(event) {
      const avatarDragHandle = event.target?.closest("[data-drag-avatar]");
      if (avatarDragHandle) {
        const startY2 = event.clientY;
        const originTop = this.avatarTop;
        let dragged = false;
        const moveAvatar = (moveEvent) => {
          const deltaY = moveEvent.clientY - startY2;
          if (!dragged && Math.abs(deltaY) > 3) {
            dragged = true;
          }
          if (!dragged) {
            return;
          }
          this.avatarTop = this.clampAvatarTop(originTop + deltaY);
          const avatarWrap = this.shadowRoot.querySelector(".zp-avatar-wrap");
          if (avatarWrap) {
            avatarWrap.style.top = `${this.avatarTop}px`;
          }
        };
        const stopDragging2 = () => {
          if (dragged) {
            this.suppressAvatarClick = true;
          }
          window.removeEventListener("pointermove", moveAvatar);
          window.removeEventListener("pointerup", stopDragging2);
          window.removeEventListener("pointercancel", stopDragging2);
        };
        window.addEventListener("pointermove", moveAvatar);
        window.addEventListener("pointerup", stopDragging2);
        window.addEventListener("pointercancel", stopDragging2);
        return;
      }
      const dragHandle = event.target?.closest("[data-drag-card]");
      if (!dragHandle) {
        return;
      }
      const cardId = dragHandle.dataset.dragCard;
      const card = this.cards.find((item) => item.id === cardId);
      if (!card) {
        return;
      }
      event.preventDefault();
      this.bringCardToFront(card.id);
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = card.position.x;
      const originY = card.position.y;
      const moveCard = (moveEvent) => {
        const cardElement = this.shadowRoot.querySelector(`[data-card-id="${card.id}"]`);
        const cardWidth = cardElement?.offsetWidth ?? 420;
        const cardHeight = cardElement?.offsetHeight ?? 320;
        const nextX = Math.min(Math.max(originX + moveEvent.clientX - startX, 16), window.innerWidth - cardWidth - 16);
        const nextY = Math.min(Math.max(originY + moveEvent.clientY - startY, 16), window.innerHeight - cardHeight - 16);
        card.position = {
          x: nextX,
          y: nextY
        };
        if (cardElement) {
          cardElement.style.left = `${nextX}px`;
          cardElement.style.top = `${nextY}px`;
          cardElement.style.zIndex = String(card.zIndex);
        }
      };
      const stopDragging = () => {
        window.removeEventListener("pointermove", moveCard);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
      };
      window.addEventListener("pointermove", moveCard);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
    }
    async handleShadowKeydown(event) {
      const target = event.target;
      if (target?.getAttribute("data-role") !== "chat-input") {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.toolbarMode = "actions";
        this.renderToolbar();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await this.sendSelectionChat();
      }
    }
    createCardPosition() {
      const offset = this.cards.length * 22;
      return {
        x: Math.max(window.innerWidth - 432 - 24 - offset, 16),
        y: Math.min(96 + offset, Math.max(window.innerHeight - 360, 16))
      };
    }
    bringCardToFront(cardId) {
      const card = this.cards.find((item) => item.id === cardId);
      if (!card) {
        return;
      }
      card.zIndex = ++this.nextCardZIndex;
      const cardElement = this.shadowRoot.querySelector(`[data-card-id="${card.id}"]`);
      if (cardElement) {
        cardElement.style.zIndex = String(card.zIndex);
      }
    }
    clampAvatarTop(nextTop) {
      return Math.min(Math.max(nextTop, 20), window.innerHeight - 56);
    }
  };
  if (window.top === window.self && document.documentElement) {
    const assistant = new ContentAssistant();
    void assistant.init();
    window.addEventListener("beforeunload", () => assistant.destroy(), { once: true });
  }
})();
//# sourceMappingURL=content.js.map
