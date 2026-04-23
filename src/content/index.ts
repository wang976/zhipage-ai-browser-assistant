import { TARGET_LANGUAGES } from "../shared/constants";
import { loadAppState, subscribeToAppState } from "../shared/storage";
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
  private cards: FloatingCard[] = [];
  private toast = "";
  private toastTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;

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
      void this.handleShadowKeydown(event as KeyboardEvent);
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

    this.render();
  }

  destroy() {
    this.unsubscribe?.();
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
    if (!this.shouldShowAvatar()) {
      this.avatarZone.innerHTML = "";
      return;
    }

    const iconUrl = getIconUrl();
    this.avatarZone.innerHTML = `
      <div class="zp-avatar-wrap">
        <div class="zp-avatar-tip">Ctrl + K</div>
        <button class="zp-avatar-button" data-action="open-side-panel" type="button">
          <img alt="智页浏览器 AI 助手" src="${iconUrl}" />
        </button>
        <div class="zp-avatar-menu">
          <button class="zp-avatar-action" data-action="avatar-ocr" type="button">截图识别文字</button>
          <button class="zp-avatar-action" data-action="avatar-summary" type="button">总结此页面</button>
          <button class="zp-avatar-action" data-action="avatar-translate" type="button">翻译此页面</button>
        </div>
      </div>
    `;
  }

  private getToolbarPosition() {
    if (!this.selection) {
      return "";
    }

    const width = this.toolbarMode === "chat" ? 460 : this.getToolbarAppearance() === "rich" ? 560 : 420;
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

    if (this.toolbarMode === "chat") {
      this.toolbarZone.innerHTML = `
        <div class="zp-toolbar zp-chat-mode" style="${style}">
          <button class="zp-toolbar-avatar" data-action="open-side-panel" type="button">
            <img alt="智页浏览器 AI 助手" src="${iconUrl}" />
          </button>
          <input class="zp-chat-input" data-role="chat-input" placeholder="输入想问的问题" value="${escapeHtml(
            this.toolbarDraft,
          )}" />
          <button class="zp-chat-send" data-action="send-selection-chat" type="button">发送</button>
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

    const appearance = this.getToolbarAppearance();
    const buttonLabel = (rich: string, minimal: string) => (appearance === "rich" ? rich : minimal);
    this.toolbarZone.innerHTML = `
      <div class="zp-toolbar ${appearance === "minimal" ? "is-minimal" : ""}" style="${style}">
        <button class="zp-toolbar-avatar" data-action="open-side-panel" type="button">
          <img alt="智页浏览器 AI 助手" src="${iconUrl}" />
        </button>
        <button class="zp-toolbar-button" data-action="toolbar-search" type="button">${buttonLabel("AI搜索", "AI")}</button>
        <button class="zp-toolbar-button" data-action="toolbar-explain" type="button">${buttonLabel("解释", "释")}</button>
        <button class="zp-toolbar-button" data-action="toolbar-read" type="button">${buttonLabel("朗读", "读")}</button>
        <button class="zp-toolbar-button" data-action="toolbar-translate" type="button">${buttonLabel("翻译", "译")}</button>
        <div class="zp-toolbar-separator"></div>
        <button class="zp-toolbar-button" data-action="toolbar-chat" type="button">${buttonLabel("问问智页", "聊")}</button>
      </div>
    `;
  }

  private renderCards() {
    if (!this.cards.length) {
      this.cardZone.innerHTML = "";
      return;
    }

    this.cardZone.innerHTML = `
      <div class="zp-card-stack">
        ${this.cards
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
              <section class="zp-card">
                <div class="zp-card-header">
                  <strong>${card.kind === "translate" ? "翻译" : "解释"}</strong>
                  <button class="zp-card-close" data-action="close-card" data-card-id="${card.id}" type="button">✕</button>
                </div>
                ${languageRow}
                <div class="zp-card-source">${multiline(truncateText(card.sourceText, 180))}</div>
                <div class="zp-card-body">${
                  card.status === "loading"
                    ? "正在请求当前模型…"
                    : card.status === "error"
                      ? `<span style="color:#cf4f4f">${multiline(card.result)}</span>`
                      : multiline(card.result)
                }</div>
                <div class="zp-card-footer">回答会优先结合当前网页内容与所选模型配置。</div>
              </section>
            `;
          })
          .join("")}
      </div>
    `;
  }

  private renderToast() {
    this.toastZone.innerHTML = this.toast ? `<div class="zp-toast">${escapeHtml(this.toast)}</div>` : "";
  }

  private hideToolbar() {
    this.selection = null;
    this.toolbarMode = "actions";
    this.toolbarDraft = "";
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

  private async requestQuickAction(kind: CardKind, cardId: string) {
    const card = this.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    card.status = "loading";
    card.result = "";
    this.renderCards();

    try {
      const data = await runtimeRequest<{ text: string }>({
        type: "QUICK_ACTION",
        payload: {
          mode: kind,
          selectedText: card.sourceText,
          targetLanguage: card.targetLanguage,
          pageTitle: document.title,
          pageUrl: window.location.href,
        },
      });
      card.status = "done";
      card.result = data.text;
    } catch (error) {
      card.status = "error";
      card.result = error instanceof Error ? error.message : "请求失败";
    }

    this.renderCards();
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
    };

    this.cards = [card, ...this.cards];
    this.renderCards();
    await this.requestQuickAction(kind, card.id);
  }

  private extractPageText() {
    return truncateText(document.body?.innerText || "", 12000);
  }

  private async summarizeCurrentPage() {
    await runtimeRequest({
      type: "PAGE_SUMMARY",
      payload: {
        pageTitle: document.title,
        pageUrl: window.location.href,
        pageText: this.extractPageText(),
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
    await this.requestQuickAction("translate", card.id);
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
        await this.openSidePanel();
        break;

      case "avatar-summary":
        await this.summarizeCurrentPage();
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

  private async handleShadowKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.getAttribute("data-role") !== "chat-input") {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await this.sendSelectionChat();
    }
  }
}

if (window.top === window.self && document.documentElement) {
  const assistant = new ContentAssistant();
  void assistant.init();
  window.addEventListener("beforeunload", () => assistant.destroy(), { once: true });
}
