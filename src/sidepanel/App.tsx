import { useEffect, useRef, useState } from "react";
import { PROVIDER_LABELS } from "../shared/constants";
import { updateAppState } from "../shared/storage";
import { useAppState } from "../shared/use-app-state";
import type { Attachment, Conversation, ModelConfig } from "../shared/types";
import { formatRelativeTime } from "../shared/utils";

function getIconUrl() {
  return chrome.runtime.getURL("assets/icon.svg");
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const mimeType = file.type || "application/octet-stream";
  const isTextLike = /^text\/|json|javascript|xml|markdown/.test(mimeType) || /\.(md|txt|json|ts|tsx|js|jsx|css|html)$/i.test(file.name);
  const isImageLike = mimeType.startsWith("image/");

  const attachment: Attachment = {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType,
    size: file.size,
    kind: isTextLike ? "text" : isImageLike ? "image" : "file",
  };

  if (isTextLike) {
    attachment.textPreview = (await readFileAsText(file)).slice(0, 4000);
  } else if (isImageLike) {
    attachment.dataUrl = await readFileAsDataUrl(file);
  }

  return attachment;
}

async function runtimeRequest<T>(payload: unknown) {
  const response = (await chrome.runtime.sendMessage(payload)) as { ok: boolean; data?: T; error?: string };
  if (!response?.ok) {
    throw new Error(response?.error || "请求失败");
  }
  return response.data as T;
}

function ModelBadge({ model }: { model: ModelConfig | null }) {
  if (!model) {
    return <span className="sp-empty-model">未配置模型</span>;
  }

  return (
    <span className="sp-model-inline">
      <span className="sp-model-provider">{PROVIDER_LABELS[model.providerName]}</span>
      <span>{model.displayName}</span>
    </span>
  );
}

function ConversationItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
}) {
  const latestMessage = [...conversation.messages].reverse().find((message) => message.content.trim());

  return (
    <button className={`sp-history-item ${active ? "is-active" : ""}`} onClick={onSelect} type="button">
      <div className="sp-history-title">{conversation.title}</div>
      <div className="sp-history-meta">
        <span>{latestMessage?.content?.slice(0, 42) || "还没有消息，点击继续对话"}</span>
        <span>{formatRelativeTime(conversation.updatedAt)}</span>
      </div>
    </button>
  );
}

export function SidePanelApp() {
  const { state, ready } = useAppState();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const activeConversation = state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? state.conversations[0];
  const enabledModels = state.models.filter((model) => model.enabled);
  const currentModel = enabledModels.find((model) => model.id === state.currentModelId) ?? enabledModels[0] ?? null;
  const hasPendingMessage = activeConversation?.messages.some((message) => message.status === "pending");

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [activeConversation?.messages.length, historyOpen]);

  async function handleSendMessage() {
    if (!draft.trim() && attachments.length === 0) {
      return;
    }

    setErrorMessage("");

    try {
      await runtimeRequest({
        type: "SEND_CHAT_MESSAGE",
        payload: {
          conversationId: activeConversation?.id,
          content: draft.trim() || "请结合附件继续分析。",
          attachments,
        },
      });
      setDraft("");
      setAttachments([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发送失败");
    }
  }

  async function handleCreateConversation() {
    setMenuOpen(false);
    await runtimeRequest({
      type: "CREATE_CONVERSATION",
    });
    setHistoryOpen(true);
  }

  async function handleConversationSelect(conversationId: string) {
    await runtimeRequest({
      type: "SET_ACTIVE_CONVERSATION",
      payload: { conversationId },
    });
  }

  async function handleModelChange(modelId: string) {
    await updateAppState((currentState) => ({
      ...currentState,
      currentModelId: modelId || null,
    }));
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      return;
    }

    const nextAttachments = await Promise.all(selectedFiles.map((file) => fileToAttachment(file)));
    setAttachments((current) => [...current, ...nextAttachments]);
    event.target.value = "";
  }

  return (
    <div className={`sp-shell ${historyOpen ? "history-open" : ""}`}>
      <aside className="sp-history-panel">
        <div className="sp-history-header">
          <div>
            <p className="sp-eyebrow">历史对话</p>
            <h2>多会话工作区</h2>
          </div>
          <button className="sp-primary-button" onClick={handleCreateConversation} type="button">
            新建会话
          </button>
        </div>
        <div className="sp-history-list">
          {state.conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              active={conversation.id === activeConversation?.id}
              conversation={conversation}
              onSelect={() => void handleConversationSelect(conversation.id)}
            />
          ))}
        </div>
      </aside>

      <section className="sp-panel">
        <header className="sp-topbar">
          <div className="sp-brand">
            <img alt="智页浏览器 AI 助手" src={getIconUrl()} />
            <div>
              <strong>智页浏览器 AI 助手</strong>
              <span>{ready ? <ModelBadge model={currentModel} /> : "正在加载..."}</span>
            </div>
          </div>

          <div className="sp-topbar-actions">
            <button
              className="sp-ghost-button"
              onClick={() => setHistoryOpen((current) => !current)}
              type="button"
            >
              {historyOpen ? "隐藏历史" : "历史对话"}
            </button>
            <div className="sp-menu-wrap">
              <button className="sp-menu-button" onClick={() => setMenuOpen((current) => !current)} type="button">
                ☰
              </button>
              {menuOpen ? (
                <div className="sp-menu-popover">
                  <button
                    onClick={() => {
                      setHistoryOpen(true);
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    历史对话
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      chrome.runtime.openOptionsPage();
                    }}
                    type="button"
                  >
                    设置
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="sp-conversation" ref={messageListRef}>
          {activeConversation?.messages.length ? (
            activeConversation.messages.map((message) => (
              <article key={message.id} className={`sp-message ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                <div className="sp-message-meta">
                  <span>{message.role === "user" ? "你" : "智页"}</span>
                  {message.status === "pending" ? <span>生成中…</span> : null}
                  {message.status === "error" ? <span className="sp-message-error-tag">失败</span> : null}
                </div>
                <div className="sp-message-bubble">
                  {message.content || "正在等待模型返回内容…"}
                  {message.attachments?.length ? (
                    <div className="sp-attachment-stack">
                      {message.attachments.map((attachment) => (
                        <div key={attachment.id} className="sp-attachment-chip">
                          <span>{attachment.name}</span>
                          <small>
                            {attachment.kind === "text" ? "文本预览" : attachment.kind === "image" ? "图片占位" : "文件占位"}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="sp-empty-state">
              <div className="sp-empty-card">
                <span className="sp-eyebrow">欢迎使用</span>
                <h2>在网页里提问、总结、解释和翻译</h2>
                <p>当前侧边栏支持独立会话、划词联动、页面总结，以及通过左下角切换已配置模型。</p>
                <div className="sp-empty-tags">
                  <span>多会话历史</span>
                  <span>划词解释 / 翻译</span>
                  <span>页面总结</span>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="sp-composer">
          {errorMessage ? <div className="sp-inline-error">{errorMessage}</div> : null}
          {attachments.length ? (
            <div className="sp-composer-attachments">
              {attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  className="sp-attachment-pill"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  type="button"
                >
                  <span>{attachment.name}</span>
                  <span>移除</span>
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            className="sp-textarea"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder="发送消息，输入 @ 或 / 选择技能"
            rows={5}
            value={draft}
          />
          <div className="sp-composer-row">
            <div className="sp-model-select-wrap">
              <select
                className="sp-model-select"
                onChange={(event) => void handleModelChange(event.target.value)}
                value={currentModel?.id || ""}
              >
                {!enabledModels.length ? <option value="">未配置模型</option> : null}
                {enabledModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="sp-composer-actions">
              <input hidden multiple onChange={(event) => void handleFileSelection(event)} ref={fileInputRef} type="file" />
              <button className="sp-icon-button" onClick={() => fileInputRef.current?.click()} type="button">
                上传文件
              </button>
              <button className="sp-send-button" disabled={hasPendingMessage && !draft.trim()} onClick={() => void handleSendMessage()} type="button">
                发送
              </button>
            </div>
          </div>
          <p className="sp-footnote">快捷键默认建议为 `Ctrl+K`。文件上传已支持基础展示，图片能力保留扩展位。</p>
        </footer>
      </section>
    </div>
  );
}
