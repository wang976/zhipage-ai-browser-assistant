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
  .zp-card,
  .zp-toast {
    pointer-events: auto;
  }

  .zp-avatar-wrap {
    position: fixed;
    right: 18px;
    top: 42%;
    display: grid;
    justify-items: end;
    gap: 10px;
  }

  .zp-avatar-button {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(180deg, #f9fbff, #ddebff);
    box-shadow:
      0 14px 28px rgba(31, 55, 115, 0.22),
      inset 0 0 0 1px rgba(255, 255, 255, 0.9);
  }

  .zp-avatar-button img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
  }

  .zp-avatar-tip {
    opacity: 0;
    transform: translateX(8px);
    padding: 10px 16px;
    border-radius: 16px;
    color: white;
    background: #11161f;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-menu {
    display: grid;
    gap: 8px;
    min-width: 166px;
    opacity: 0;
    transform: translateY(-6px);
    padding: 12px;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 42px rgba(30, 48, 92, 0.16);
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-wrap:hover .zp-avatar-tip,
  .zp-avatar-wrap:hover .zp-avatar-menu {
    opacity: 1;
    transform: translateY(0);
  }

  .zp-avatar-action {
    border: 0;
    border-radius: 16px;
    padding: 12px 14px;
    color: #182132;
    text-align: left;
    background: rgba(239, 244, 255, 0.96);
  }

  .zp-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 1px solid rgba(114, 128, 154, 0.16);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 18px 38px rgba(28, 43, 78, 0.18);
    backdrop-filter: blur(18px);
  }

  .zp-toolbar.is-minimal {
    gap: 6px;
  }

  .zp-toolbar-button,
  .zp-toolbar-avatar,
  .zp-card-close,
  .zp-chat-send,
  .zp-toast,
  .zp-card-select {
    border: 0;
  }

  .zp-toolbar-avatar {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 16px;
    background: rgba(219, 231, 255, 0.75);
  }

  .zp-toolbar-avatar img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .zp-toolbar-button {
    min-height: 42px;
    border-radius: 16px;
    padding: 0 14px;
    color: #182132;
    background: transparent;
  }

  .zp-toolbar.is-minimal .zp-toolbar-button {
    padding: 0 12px;
    font-size: 13px;
  }

  .zp-toolbar-button:hover,
  .zp-avatar-action:hover,
  .zp-card-close:hover,
  .zp-chat-send:hover {
    background: rgba(47, 106, 247, 0.09);
  }

  .zp-toolbar-separator {
    width: 1px;
    height: 24px;
    background: rgba(114, 128, 154, 0.22);
  }

  .zp-chat-mode {
    gap: 12px;
    padding: 12px;
  }

  .zp-chat-input {
    width: 320px;
    border: 0;
    outline: none;
    border-radius: 18px;
    padding: 12px 14px;
    color: #182132;
    background: rgba(242, 246, 255, 0.92);
  }

  .zp-chat-send {
    min-width: 88px;
    border-radius: 16px;
    padding: 12px 16px;
    color: white;
    background: linear-gradient(135deg, #2f6af7, #4d8dff);
  }

  .zp-card-stack {
    position: fixed;
    top: 106px;
    right: 24px;
    display: grid;
    gap: 14px;
    width: min(400px, calc(100vw - 32px));
  }

  .zp-card {
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 48px rgba(30, 48, 92, 0.18);
    backdrop-filter: blur(20px);
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
    cards = [];
    toast = "";
    toastTimer = null;
    unsubscribe = null;
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
      this.shadowRoot.addEventListener("keydown", (event) => {
        void this.handleShadowKeydown(event);
      });
      document.addEventListener("mouseup", () => {
        window.setTimeout(() => this.captureSelection(), 0);
      });
      document.addEventListener("keyup", () => {
        window.setTimeout(() => this.captureSelection(), 0);
      });
      document.addEventListener(
        "mousedown",
        (event) => {
          if (event.composedPath().includes(this.host)) {
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
      this.render();
    }
    destroy() {
      this.unsubscribe?.();
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
      if (!this.shouldShowAvatar()) {
        this.avatarZone.innerHTML = "";
        return;
      }
      const iconUrl = getIconUrl();
      this.avatarZone.innerHTML = `
      <div class="zp-avatar-wrap">
        <div class="zp-avatar-tip">Ctrl + K</div>
        <button class="zp-avatar-button" data-action="open-side-panel" type="button">
          <img alt="\u667A\u9875\u6D4F\u89C8\u5668 AI \u52A9\u624B" src="${iconUrl}" />
        </button>
        <div class="zp-avatar-menu">
          <button class="zp-avatar-action" data-action="avatar-ocr" type="button">\u622A\u56FE\u8BC6\u522B\u6587\u5B57</button>
          <button class="zp-avatar-action" data-action="avatar-summary" type="button">\u603B\u7ED3\u6B64\u9875\u9762</button>
          <button class="zp-avatar-action" data-action="avatar-translate" type="button">\u7FFB\u8BD1\u6B64\u9875\u9762</button>
        </div>
      </div>
    `;
    }
    getToolbarPosition() {
      if (!this.selection) {
        return "";
      }
      const width = this.toolbarMode === "chat" ? 460 : this.getToolbarAppearance() === "rich" ? 560 : 420;
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
      if (this.toolbarMode === "chat") {
        this.toolbarZone.innerHTML = `
        <div class="zp-toolbar zp-chat-mode" style="${style}">
          <button class="zp-toolbar-avatar" data-action="open-side-panel" type="button">
            <img alt="\u667A\u9875\u6D4F\u89C8\u5668 AI \u52A9\u624B" src="${iconUrl}" />
          </button>
          <input class="zp-chat-input" data-role="chat-input" placeholder="\u8F93\u5165\u60F3\u95EE\u7684\u95EE\u9898" value="${escapeHtml(
          this.toolbarDraft
        )}" />
          <button class="zp-chat-send" data-action="send-selection-chat" type="button">\u53D1\u9001</button>
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
      const appearance = this.getToolbarAppearance();
      const buttonLabel = (rich, minimal) => appearance === "rich" ? rich : minimal;
      this.toolbarZone.innerHTML = `
      <div class="zp-toolbar ${appearance === "minimal" ? "is-minimal" : ""}" style="${style}">
        <button class="zp-toolbar-avatar" data-action="open-side-panel" type="button">
          <img alt="\u667A\u9875\u6D4F\u89C8\u5668 AI \u52A9\u624B" src="${iconUrl}" />
        </button>
        <button class="zp-toolbar-button" data-action="toolbar-search" type="button">${buttonLabel("AI\u641C\u7D22", "AI")}</button>
        <button class="zp-toolbar-button" data-action="toolbar-explain" type="button">${buttonLabel("\u89E3\u91CA", "\u91CA")}</button>
        <button class="zp-toolbar-button" data-action="toolbar-read" type="button">${buttonLabel("\u6717\u8BFB", "\u8BFB")}</button>
        <button class="zp-toolbar-button" data-action="toolbar-translate" type="button">${buttonLabel("\u7FFB\u8BD1", "\u8BD1")}</button>
        <div class="zp-toolbar-separator"></div>
        <button class="zp-toolbar-button" data-action="toolbar-chat" type="button">${buttonLabel("\u95EE\u95EE\u667A\u9875", "\u804A")}</button>
      </div>
    `;
    }
    renderCards() {
      if (!this.cards.length) {
        this.cardZone.innerHTML = "";
        return;
      }
      this.cardZone.innerHTML = `
      <div class="zp-card-stack">
        ${this.cards.map((card) => {
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
              <section class="zp-card">
                <div class="zp-card-header">
                  <strong>${card.kind === "translate" ? "\u7FFB\u8BD1" : "\u89E3\u91CA"}</strong>
                  <button class="zp-card-close" data-action="close-card" data-card-id="${card.id}" type="button">\u2715</button>
                </div>
                ${languageRow}
                <div class="zp-card-source">${multiline(truncateText(card.sourceText, 180))}</div>
                <div class="zp-card-body">${card.status === "loading" ? "\u6B63\u5728\u8BF7\u6C42\u5F53\u524D\u6A21\u578B\u2026" : card.status === "error" ? `<span style="color:#cf4f4f">${multiline(card.result)}</span>` : multiline(card.result)}</div>
                <div class="zp-card-footer">\u56DE\u7B54\u4F1A\u4F18\u5148\u7ED3\u5408\u5F53\u524D\u7F51\u9875\u5185\u5BB9\u4E0E\u6240\u9009\u6A21\u578B\u914D\u7F6E\u3002</div>
              </section>
            `;
      }).join("")}
      </div>
    `;
    }
    renderToast() {
      this.toastZone.innerHTML = this.toast ? `<div class="zp-toast">${escapeHtml(this.toast)}</div>` : "";
    }
    hideToolbar() {
      this.selection = null;
      this.toolbarMode = "actions";
      this.toolbarDraft = "";
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
    async requestQuickAction(kind, cardId) {
      const card = this.cards.find((item) => item.id === cardId);
      if (!card) {
        return;
      }
      card.status = "loading";
      card.result = "";
      this.renderCards();
      try {
        const data = await runtimeRequest({
          type: "QUICK_ACTION",
          payload: {
            mode: kind,
            selectedText: card.sourceText,
            targetLanguage: card.targetLanguage,
            pageTitle: document.title,
            pageUrl: window.location.href
          }
        });
        card.status = "done";
        card.result = data.text;
      } catch (error) {
        card.status = "error";
        card.result = error instanceof Error ? error.message : "\u8BF7\u6C42\u5931\u8D25";
      }
      this.renderCards();
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
        result: ""
      };
      this.cards = [card, ...this.cards];
      this.renderCards();
      await this.requestQuickAction(kind, card.id);
    }
    extractPageText() {
      return truncateText(document.body?.innerText || "", 12e3);
    }
    async summarizeCurrentPage() {
      await runtimeRequest({
        type: "PAGE_SUMMARY",
        payload: {
          pageTitle: document.title,
          pageUrl: window.location.href,
          pageText: this.extractPageText()
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
      await this.requestQuickAction("translate", card.id);
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
          await this.openSidePanel();
          break;
        case "avatar-summary":
          await this.summarizeCurrentPage();
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
          this.toolbarMode = "chat";
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
    async handleShadowKeydown(event) {
      const target = event.target;
      if (target?.getAttribute("data-role") !== "chat-input") {
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await this.sendSelectionChat();
      }
    }
  };
  if (window.top === window.self && document.documentElement) {
    const assistant = new ContentAssistant();
    void assistant.init();
    window.addEventListener("beforeunload", () => assistant.destroy(), { once: true });
  }
})();
//# sourceMappingURL=content.js.map
