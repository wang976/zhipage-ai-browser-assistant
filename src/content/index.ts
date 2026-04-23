import { TARGET_LANGUAGES } from "../shared/constants";
import { loadAppState, subscribeToAppState } from "../shared/storage";
import type { RuntimePushMessage } from "../shared/runtime-messages";
import type { AppState, ToolbarAppearance } from "../shared/types";
import { truncateText } from "../shared/utils";
import { contentStyles } from "./styles";

type ToolbarMode = "actions" | "chat";
type CardKind = "explain" | "translate";

interface SelectionSnapshot {
  text: string;
  rect: DOMRect;
}

interface FloatingCard {
  id: string;
  kind: CardKind;
  sourceText: string;
  targetLanguage: string;
  status: "loading" | "done" | "error";
  result: string;
  activeRequestId: string | null;
  position: {
    x: number;
    y: number;
  };
  zIndex: number;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function multiline(text: string) {
  return escapeHtml(text).replaceAll("\n", "<br />");
}

function isEditableNode(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

function matchesDisabledSite(patterns: string[]) {
  const currentUrl = window.location.href;
  const hostname = window.location.hostname;
  const URLPatternCtor = (globalThis as unknown as { URLPattern?: new (pattern: string) => { test(url: string): boolean } })
    .URLPattern;

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

function getAvatarActionIcon(kind: "ocr" | "summary" | "translate") {
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

function getToolbarActionIcon(kind: "search" | "explain" | "read" | "translate" | "chat" | "collapse" | "send") {
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

function createToolbarButtonContent(label: string, icon: string, appearance: ToolbarAppearance) {
  return `
    <span class="zp-toolbar-button-icon" aria-hidden="true">${icon}</span>
    ${appearance === "rich" ? `<span class="zp-toolbar-button-text">${escapeHtml(label)}</span>` : ""}
  `;
}

function createToolbarButton(action: string, label: string, icon: string, appearance: ToolbarAppearance, active = false) {
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

function createToolbarIconButton(action: string, label: string, icon: string) {
  return `
    <button aria-label="${escapeHtml(label)}" class="zp-toolbar-control" data-action="${action}" type="button">
      ${icon}
    </button>
  `;
}

function runtimeRequest<T>(payload: unknown) {
  return chrome.runtime.sendMessage(payload).then((response: { ok: boolean; data?: T; error?: string }) => {
    if (!response?.ok) {
      throw new Error(response?.error || "请求失败");
    }

    return response.data as T;
  });
}

class ContentAssistant {
  private state: AppState | null = null;
  private host: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private avatarZone: HTMLDivElement;
  private toolbarZone: HTMLDivElement;
  private cardZone: HTMLDivElement;
  private toastZone: HTMLDivElement;
  private selection: SelectionSnapshot | null = null;
  private toolbarMode: ToolbarMode = "actions";
  private toolbarDraft = "";
  private chatToolbarWidth: number | null = null;
  private cards: FloatingCard[] = [];
  private nextCardZIndex = 20;
  private avatarDismissed = false;
  private avatarTop = Math.round(window.innerHeight * 0.42);
  private suppressAvatarClick = false;
  private toast = "";
  private toastTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private runtimeMessageListener = (message: RuntimePushMessage) => {
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
      card.result = message.payload.content || message.payload.error || "请求失败";
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
    this.avatarZone = this.shadowRoot.querySelector("[data-zone='avatar']") as HTMLDivElement;
    this.toolbarZone = this.shadowRoot.querySelector("[data-zone='toolbar']") as HTMLDivElement;
    this.cardZone = this.shadowRoot.querySelector("[data-zone='cards']") as HTMLDivElement;
    this.toastZone = this.shadowRoot.querySelector("[data-zone='toast']") as HTMLDivElement;
  }

  private isEventInsideAssistant(event: Event) {
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
      this.handleShadowPointerDown(event as PointerEvent);
    });
    this.shadowRoot.addEventListener("keydown", (event) => {
      void this.handleShadowKeydown(event as KeyboardEvent);
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
      true,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          void this.openSidePanel();
        }
      },
      true,
    );
    window.addEventListener(
      "scroll",
      () => {
        if (this.selection) {
          this.hideToolbar();
        }
      },
      true,
    );
    window.addEventListener("resize", () => {
      this.avatarTop = this.clampAvatarTop(this.avatarTop);
      const avatarWrap = this.shadowRoot.querySelector<HTMLElement>(".zp-avatar-wrap");
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

  private shouldShowAvatar() {
    if (!this.state) {
      return false;
    }
    if (!this.state.settings.avatarSidebar.enabled) {
      return false;
    }
    return !matchesDisabledSite(this.state.settings.avatarSidebar.disabledSites);
  }

  private shouldShowToolbar() {
    return Boolean(this.state?.settings.selectionToolbar.enabled);
  }

  private getToolbarAppearance(): ToolbarAppearance {
    return this.state?.settings.selectionToolbar.appearance || "rich";
  }

  private showToast(message: string) {
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

  private render() {
    this.renderAvatar();
    this.renderToolbar();
    this.renderCards();
    this.renderToast();
  }

  private renderAvatar() {
    if (!this.shouldShowAvatar() || this.avatarDismissed) {
      this.avatarZone.innerHTML = "";
      return;
    }

    const iconUrl = getIconUrl();
    this.avatarZone.innerHTML = `
      <div class="zp-avatar-wrap" style="top:${this.avatarTop}px;">
        <div class="zp-avatar-tip">Ctrl + K</div>
        <button aria-label="隐藏悬浮头像" class="zp-avatar-dismiss" data-action="dismiss-avatar" type="button">×</button>
        <button class="zp-avatar-button" data-action="open-side-panel" data-drag-avatar="true" type="button">
          <img alt="智页浏览器 AI 助手" src="${iconUrl}" />
        </button>
        <div class="zp-avatar-menu">
          <button
            aria-label="截图识别文字"
            class="zp-avatar-action"
            data-action="avatar-ocr"
            data-tooltip="截图识别文字"
            title="截图识别文字"
            type="button"
          >
            ${getAvatarActionIcon("ocr")}
          </button>
          <div class="zp-avatar-divider"></div>
          <button
            aria-label="总结此页面"
            class="zp-avatar-action"
            data-action="avatar-summary"
            data-tooltip="总结此页面"
            title="总结此页面"
            type="button"
          >
            ${getAvatarActionIcon("summary")}
          </button>
          <div class="zp-avatar-divider"></div>
          <button
            aria-label="翻译此页面"
            class="zp-avatar-action"
            data-action="avatar-translate"
            data-tooltip="翻译此页面"
            title="翻译此页面"
            type="button"
          >
            ${getAvatarActionIcon("translate")}
          </button>
        </div>
      </div>
    `;
  }

  private getDefaultToolbarWidth() {
    const preferredWidth = this.getToolbarAppearance() === "rich" ? 600 : 360;
    return Math.min(preferredWidth, Math.max(window.innerWidth - 28, 260));
  }

  private getChatToolbarWidth() {
    return Math.min(this.chatToolbarWidth ?? this.getDefaultToolbarWidth(), Math.max(window.innerWidth - 28, 260));
  }

  private getToolbarPosition(width = this.toolbarMode === "chat" ? this.getChatToolbarWidth() : this.getDefaultToolbarWidth()) {
    if (!this.selection) {
      return "";
    }

    const left = Math.min(
      Math.max(this.selection.rect.left + this.selection.rect.width / 2 - width / 2, 14),
      window.innerWidth - width - 14,
    );
    const preferredTop = this.selection.rect.top - 64;
    const top = preferredTop > 16 ? preferredTop : this.selection.rect.bottom + 12;
    return `left:${left}px; top:${top}px;`;
  }

  private renderToolbar() {
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
      createToolbarButton("toolbar-search", "AI搜索", getToolbarActionIcon("search"), appearance),
      createToolbarButton("toolbar-explain", "解释", getToolbarActionIcon("explain"), appearance),
      createToolbarButton("toolbar-read", "朗读", getToolbarActionIcon("read"), appearance),
      createToolbarButton("toolbar-translate", "翻译", getToolbarActionIcon("translate"), appearance),
    ].join("");

    if (this.toolbarMode === "chat") {
      const canSend = Boolean(this.toolbarDraft.trim());
      const chatWidth = this.getChatToolbarWidth();
      this.toolbarZone.innerHTML = `
        <div class="zp-chat-toolbar" style="${style} width:${chatWidth}px;">
          ${createToolbarIconButton("toolbar-chat-close", "收起提问输入", getToolbarActionIcon("collapse"))}
          <input
            class="zp-chat-input"
            data-role="chat-input"
            placeholder="输入想问的问题"
            spellcheck="false"
            value="${escapeHtml(this.toolbarDraft)}"
          />
          <button
            aria-label="发送提问"
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
        const input = this.shadowRoot.querySelector<HTMLInputElement>("[data-role='chat-input']");
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
          <img alt="智页浏览器 AI 助手" src="${iconUrl}" />
        </button>
        ${actionButtons}
        <div class="zp-toolbar-separator"></div>
        ${createToolbarButton("toolbar-chat", "问问智页", getToolbarActionIcon("chat"), appearance, true)}
      </div>
    `;
  }

  private renderCards() {
    if (!this.cards.length) {
      this.cardZone.innerHTML = "";
      return;
    }

    this.cardZone.innerHTML = this.cards
      .map((card) => {
        const languageRow =
          card.kind === "translate"
            ? `
                <div class="zp-card-lang-row">
                  <select class="zp-card-select" disabled>
                    <option>自动检测</option>
                  </select>
                  <span>→</span>
                  <select class="zp-card-select" data-card-target="${card.id}">
                    ${TARGET_LANGUAGES.map(
                      (language) =>
                        `<option value="${escapeHtml(language)}" ${
                          card.targetLanguage === language ? "selected" : ""
                        }>${escapeHtml(language)}</option>`,
                    ).join("")}
                  </select>
                </div>
              `
            : "";
        return `
          <section
            class="zp-card"
            data-card-id="${card.id}"
            style="left:${card.position.x}px; top:${card.position.y}px; z-index:${card.zIndex};"
          >
            <div class="zp-card-drag-zone">
              <button class="zp-card-drag-handle" data-drag-card="${card.id}" type="button" aria-label="拖动卡片"></button>
            </div>
            <div class="zp-card-header">
              <strong>${card.kind === "translate" ? "翻译" : "解释"}</strong>
              <button class="zp-card-close" data-action="close-card" data-card-id="${card.id}" type="button">✕</button>
            </div>
            ${languageRow}
            <div class="zp-card-source">${multiline(truncateText(card.sourceText, 180))}</div>
            <div class="zp-card-body">${
              card.status === "loading"
                ? card.result
                  ? multiline(card.result)
                  : "正在请求当前模型…"
                : card.status === "error"
                  ? `<span style="color:#cf4f4f">${multiline(card.result)}</span>`
                  : multiline(card.result)
            }</div>
            <div class="zp-card-footer">回答会优先结合当前网页内容与所选模型配置。</div>
          </section>
        `;
      })
      .join("");
  }

  private renderToast() {
    this.toastZone.innerHTML = this.toast ? `<div class="zp-toast">${escapeHtml(this.toast)}</div>` : "";
  }

  private hideToolbar() {
    this.selection = null;
    this.toolbarMode = "actions";
    this.toolbarDraft = "";
    this.chatToolbarWidth = null;
    this.renderToolbar();
  }

  private captureSelection() {
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

    if (!text || !rect || isEditableNode(selection.anchorNode) || (selection.anchorNode && this.host.contains(selection.anchorNode))) {
      this.hideToolbar();
      return;
    }

    if (rect.width === 0 && rect.height === 0) {
      this.hideToolbar();
      return;
    }

    this.selection = {
      text: truncateText(text, 6000),
      rect,
    };
    this.toolbarMode = "actions";
    this.toolbarDraft = "";
    this.renderToolbar();
  }

  private async openSidePanel() {
    await runtimeRequest({ type: "OPEN_SIDE_PANEL" });
  }

  private requestQuickAction(kind: CardKind, cardId: string) {
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

    void runtimeRequest<{ requestId: string }>({
      type: "QUICK_ACTION",
      payload: {
        requestId,
        mode: kind,
        selectedText: card.sourceText,
        targetLanguage: card.targetLanguage,
        pageTitle: document.title,
        pageUrl: window.location.href,
      },
    }).catch((error) => {
      if (card.activeRequestId !== requestId) {
        return;
      }
      card.status = "error";
      card.result = error instanceof Error ? error.message : "请求失败";
      this.renderCards();
    });
  }

  private async addCard(kind: CardKind) {
    if (!this.selection || !this.state) {
      return;
    }

    const card: FloatingCard = {
      id: crypto.randomUUID(),
      kind,
      sourceText: this.selection.text,
      targetLanguage: this.state.settings.general.defaultTranslateTarget,
      status: "loading",
      result: "",
      activeRequestId: null,
      position: this.createCardPosition(),
      zIndex: ++this.nextCardZIndex,
    };

    this.cards = [card, ...this.cards];
    this.renderCards();
    this.requestQuickAction(kind, card.id);
  }

  private async summarizeCurrentPage() {
    await runtimeRequest({
      type: "PAGE_SUMMARY",
      payload: {
        pageUrl: window.location.href,
      },
    });
    this.showToast("已把当前页面总结请求发送到侧边栏。");
  }

  private async sendSelectionChat() {
    if (!this.selection || !this.toolbarDraft.trim()) {
      return;
    }

    await runtimeRequest({
      type: "SELECTION_CHAT",
      payload: {
        selectedText: this.selection.text,
        prompt: this.toolbarDraft.trim(),
        titleHint: this.toolbarDraft.trim(),
      },
    });
    this.showToast("已打开侧边栏，并把选中文本作为上下文发送。");
    this.hideToolbar();
  }

  private handleShadowInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (target?.dataset.role === "chat-input") {
      this.toolbarDraft = target.value;
    }
  }

  private async handleShadowChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
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

  private async handleShadowClick(event: Event) {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-action]");
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
        this.showToast("暂未实现，已预留扩展入口。");
        break;

      case "toolbar-explain":
        await this.addCard("explain");
        break;

      case "toolbar-translate":
        await this.addCard("translate");
        break;

      case "toolbar-chat":
        this.chatToolbarWidth = this.shadowRoot.querySelector<HTMLElement>(".zp-toolbar")?.offsetWidth ?? null;
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

  private handleShadowPointerDown(event: PointerEvent) {
    const avatarDragHandle = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-drag-avatar]");
    if (avatarDragHandle) {
      const startY = event.clientY;
      const originTop = this.avatarTop;
      let dragged = false;

      const moveAvatar = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.clientY - startY;
        if (!dragged && Math.abs(deltaY) > 3) {
          dragged = true;
        }

        if (!dragged) {
          return;
        }

        this.avatarTop = this.clampAvatarTop(originTop + deltaY);
        const avatarWrap = this.shadowRoot.querySelector<HTMLElement>(".zp-avatar-wrap");
        if (avatarWrap) {
          avatarWrap.style.top = `${this.avatarTop}px`;
        }
      };

      const stopDragging = () => {
        if (dragged) {
          this.suppressAvatarClick = true;
        }
        window.removeEventListener("pointermove", moveAvatar);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
      };

      window.addEventListener("pointermove", moveAvatar);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
      return;
    }

    const dragHandle = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-drag-card]");
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

    const moveCard = (moveEvent: PointerEvent) => {
      const cardElement = this.shadowRoot.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`);
      const cardWidth = cardElement?.offsetWidth ?? 420;
      const cardHeight = cardElement?.offsetHeight ?? 320;
      const nextX = Math.min(Math.max(originX + moveEvent.clientX - startX, 16), window.innerWidth - cardWidth - 16);
      const nextY = Math.min(Math.max(originY + moveEvent.clientY - startY, 16), window.innerHeight - cardHeight - 16);

      card.position = {
        x: nextX,
        y: nextY,
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

  private async handleShadowKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
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

  private createCardPosition() {
    const offset = this.cards.length * 22;
    return {
      x: Math.max(window.innerWidth - 432 - 24 - offset, 16),
      y: Math.min(96 + offset, Math.max(window.innerHeight - 360, 16)),
    };
  }

  private bringCardToFront(cardId: string) {
    const card = this.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    card.zIndex = ++this.nextCardZIndex;
    const cardElement = this.shadowRoot.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`);
    if (cardElement) {
      cardElement.style.zIndex = String(card.zIndex);
    }
  }

  private clampAvatarTop(nextTop: number) {
    return Math.min(Math.max(nextTop, 20), window.innerHeight - 56);
  }
}

if (window.top === window.self && document.documentElement) {
  const assistant = new ContentAssistant();
  void assistant.init();
  window.addEventListener("beforeunload", () => assistant.destroy(), { once: true });
}
