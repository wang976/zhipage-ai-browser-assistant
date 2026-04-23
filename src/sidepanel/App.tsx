import { useEffect, useRef, useState } from "react";
import { renderMarkdownToHtml } from "../shared/markdown";
import { updateAppState } from "../shared/storage";
import { useAppState } from "../shared/use-app-state";
import type { Attachment, Conversation, ConversationMessage } from "../shared/types";
import { formatRelativeTime } from "../shared/utils";

function getUploadIconUrl() {
  return new URL("../../img/upload.svg", import.meta.url).href;
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
  const preview = latestMessage?.content?.replace(/\s+/g, " ").trim().slice(0, 56) || "还没有消息，点击继续对话";

  return (
    <button className={`sp-history-item ${active ? "is-active" : ""}`} onClick={onSelect} type="button">
      <div className="sp-history-main">
        <div className="sp-history-title">{conversation.title}</div>
        <div className="sp-history-preview">{preview}</div>
      </div>
      <span className="sp-history-time">{formatRelativeTime(conversation.updatedAt)}</span>
    </button>
  );
}

function OverflowMenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

type MessageActionName = "copy" | "regenerate" | "speak" | "like" | "dislike";
type MessageFeedback = "like" | "dislike";

function MessageActionIcon({ name }: { name: MessageActionName }) {
  switch (name) {
    case "copy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="9" width="10" height="10" rx="2" />
          <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        </svg>
      );
    case "regenerate":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0 2 5.3" />
          <path d="M20 4v7h-7" />
        </svg>
      );
    case "speak":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 14h3l4 4V6L8 10H5z" />
          <path d="M16 9a4.5 4.5 0 0 1 0 6" />
          <path d="M18.8 6.5a8 8 0 0 1 0 11" />
        </svg>
      );
    case "like":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.5 10V7.8c0-1.9 1-3.7 2.6-4.8l.7-.5.8.6c.6.4 1 1.2 1 2v2.7h3.2c1.3 0 2.3 1.2 2.1 2.5l-.9 5.8A2.5 2.5 0 0 1 15.5 18H8.5" />
          <path d="M4 10h4.5v8H4z" />
        </svg>
      );
    case "dislike":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.5 14v2.2c0 1.9-1 3.7-2.6 4.8l-.7.5-.8-.6c-.6-.4-1-1.2-1-2v-2.7H6.3c-1.3 0-2.3-1.2-2.1-2.5l.9-5.8A2.5 2.5 0 0 1 7.5 6h8" />
          <path d="M20 14h-4.5V6H20z" />
        </svg>
      );
  }
}

function MessageActionButton({
  active = false,
  disabled = false,
  icon,
  onClick,
  tooltip,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: MessageActionName;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <button
      aria-disabled={disabled || undefined}
      aria-label={tooltip}
      className={`sp-message-action${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
      data-tooltip={tooltip}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      type="button"
    >
      <MessageActionIcon name={icon} />
    </button>
  );
}

function ComposerSendIcon() {
  return (
    <svg aria-hidden="true" className="sp-send-circle-icon" viewBox="0 0 24 24">
      <path d="M12 18V7" />
      <path d="m7 12 5-5 5 5" />
    </svg>
  );
}

function extractSpeechText(markdown: string) {
  const container = document.createElement("div");
  container.innerHTML = renderMarkdownToHtml(markdown);
  return container.innerText.replace(/\n{3,}/g, "\n\n").trim() || markdown;
}

async function persistMessageFeedback(conversationId: string, messageId: string, feedback: MessageFeedback | null) {
  await updateAppState((currentState) => ({
    ...currentState,
    conversations: currentState.conversations.map((conversation) => {
      if (conversation.id !== conversationId) {
        return conversation;
      }

      return {
        ...conversation,
        messages: conversation.messages.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const nextMeta = { ...message.meta };
          if (feedback) {
            nextMeta.feedback = feedback;
          } else {
            delete nextMeta.feedback;
          }

          return {
            ...message,
            meta: Object.keys(nextMeta).length ? nextMeta : undefined,
          };
        }),
      };
    }),
  }));
}

export function SidePanelApp() {
  const { state } = useAppState();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const floatingLayerRef = useRef<HTMLDivElement | null>(null);
  const activeConversation = state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? state.conversations[0];
  const enabledModels = state.models.filter((model) => model.enabled);
  const currentModel = enabledModels.find((model) => model.id === state.currentModelId) ?? enabledModels[0] ?? null;
  const hasPendingMessage = activeConversation?.messages.some((message) => message.status === "pending");

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [activeConversation?.id, activeConversation?.updatedAt, activeConversation?.messages.length]);

  useEffect(
    () => () => {
      globalThis.speechSynthesis?.cancel();
      speechUtteranceRef.current = null;
    },
    [],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (floatingLayerRef.current?.contains(event.target as Node)) {
        return;
      }

      setMenuOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

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
    setHistoryOpen(false);
    setDraft("");
    setAttachments([]);
  }

  function handleHistoryToggle() {
    setMenuOpen(false);
    setHistoryOpen((current) => !current);
  }

  async function handleConversationSelect(conversationId: string) {
    setMenuOpen(false);
    setHistoryOpen(false);
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

  function stopSpeaking() {
    globalThis.speechSynthesis?.cancel();
    speechUtteranceRef.current = null;
    setSpeakingMessageId(null);
  }

  async function handleCopyMessage(content: string) {
    setErrorMessage("");

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "复制失败");
    }
  }

  async function handleRegenerateMessage(assistantMessageId: string) {
    if (!activeConversation) {
      return;
    }

    setErrorMessage("");

    try {
      await runtimeRequest({
        type: "REGENERATE_ASSISTANT_MESSAGE",
        payload: {
          assistantMessageId,
          conversationId: activeConversation.id,
        },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "重新生成失败");
    }
  }

  function handleSpeakMessage(message: ConversationMessage) {
    setErrorMessage("");

    const synth = globalThis.speechSynthesis;
    if (!synth) {
      setErrorMessage("当前环境不支持朗读。");
      return;
    }

    if (speakingMessageId === message.id) {
      stopSpeaking();
      return;
    }

    const text = extractSpeechText(message.content);
    if (!text.trim()) {
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || "zh-CN";
    utterance.rate = 1;
    utterance.onend = () => {
      if (speechUtteranceRef.current !== utterance) {
        return;
      }
      speechUtteranceRef.current = null;
      setSpeakingMessageId((current) => (current === message.id ? null : current));
    };
    utterance.onerror = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null;
      }
      setSpeakingMessageId((current) => (current === message.id ? null : current));
      setErrorMessage("朗读失败，请稍后重试。");
    };

    speechUtteranceRef.current = utterance;
    setSpeakingMessageId(message.id);
    synth.speak(utterance);
  }

  async function handleToggleFeedback(message: ConversationMessage, feedback: MessageFeedback) {
    if (!activeConversation) {
      return;
    }

    setErrorMessage("");

    try {
      const nextFeedback = message.meta?.feedback === feedback ? null : feedback;
      await persistMessageFeedback(activeConversation.id, message.id, nextFeedback);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "反馈保存失败");
    }
  }

  return (
    <div className="sp-shell">
      <section className="sp-panel">
        <div className="sp-floating-layer" ref={floatingLayerRef}>
          <div className="sp-menu-wrap">
            <button
              aria-expanded={menuOpen}
              aria-label="打开选项"
              className="sp-menu-button sp-floating-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              <OverflowMenuIcon />
            </button>
            {menuOpen ? (
              <div className="sp-menu-popover">
                <button onClick={() => void handleCreateConversation()} type="button">
                  新建会话
                </button>
                <button className={historyOpen ? "is-active" : ""} onClick={handleHistoryToggle} type="button">
                  历史会话
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

          {historyOpen ? (
            <section className="sp-history-panel">
              <div className="sp-history-header">
                <div>
                  <p className="sp-eyebrow">历史会话</p>
                  <h2>选择会话</h2>
                </div>
                <span className="sp-history-count">{state.conversations.length} 个</span>
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
            </section>
          ) : null}
        </div>

        <main className="sp-conversation" onPointerDown={() => setMenuOpen(false)} ref={messageListRef}>
          {activeConversation?.messages.length ? (
            activeConversation.messages.map((message) => (
              <article key={message.id} className={`sp-message ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                {message.role === "assistant" ? (
                  <div className="sp-message-meta">
                    {message.status === "pending" ? <span>生成中…</span> : null}
                    {message.status === "error" ? <span className="sp-message-error-tag">失败</span> : null}
                  </div>
                ) : null}
                <div
                  className={
                    message.role === "assistant"
                      ? `sp-message-content ${message.status === "error" ? "is-error" : ""}`
                      : `sp-message-bubble${message.meta?.selectionQuote ? " has-quote" : ""}`
                  }
                >
                  {message.role === "assistant" ? (
                    message.content ? (
                      <div className="sp-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(message.content) }} />
                    ) : (
                      "正在等待模型返回内容…"
                    )
                  ) : (
                    <>
                      {message.meta?.selectionQuote ? (
                        <div className="sp-user-quote">
                          <span className="sp-user-quote-bar" aria-hidden="true"></span>
                          <span>{message.meta.selectionQuote}</span>
                        </div>
                      ) : null}
                      <div className="sp-user-question">{message.content || "正在等待模型返回内容…"}</div>
                    </>
                  )}
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
                {message.role === "assistant" && message.status !== "pending" && message.content ? (
                  <div className="sp-message-actions" role="toolbar" aria-label="回答操作">
                    <MessageActionButton icon="copy" onClick={() => void handleCopyMessage(message.content)} tooltip="复制回答" />
                    <MessageActionButton
                      disabled={hasPendingMessage}
                      icon="regenerate"
                      onClick={() => void handleRegenerateMessage(message.id)}
                      tooltip="重新生成"
                    />
                    {message.status === "done" ? (
                      <>
                        <MessageActionButton
                          active={speakingMessageId === message.id}
                          icon="speak"
                          onClick={() => handleSpeakMessage(message)}
                          tooltip={speakingMessageId === message.id ? "停止朗读" : "朗读回答"}
                        />
                        <MessageActionButton
                          active={message.meta?.feedback === "like"}
                          icon="like"
                          onClick={() => void handleToggleFeedback(message, "like")}
                          tooltip={message.meta?.feedback === "like" ? "取消喜欢" : "喜欢"}
                        />
                        <MessageActionButton
                          active={message.meta?.feedback === "dislike"}
                          icon="dislike"
                          onClick={() => void handleToggleFeedback(message, "dislike")}
                          tooltip={message.meta?.feedback === "dislike" ? "取消不喜欢" : "不喜欢"}
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="sp-empty-state">
              <div className="sp-empty-card">
                <span className="sp-eyebrow">欢迎使用</span>
                <h2>在网页里提问、总结、解释和翻译</h2>
                <p>当前侧边栏支持右上角历史会话、划词联动、页面总结，以及通过底部模型选择器切换已配置模型。</p>
                <div className="sp-empty-tags">
                  <span>多会话历史</span>
                  <span>划词解释 / 翻译</span>
                  <span>页面总结</span>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="sp-composer" onPointerDown={() => setMenuOpen(false)}>
          {errorMessage ? <div className="sp-inline-error">{errorMessage}</div> : null}
          <div className="sp-composer-box">
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
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage();
                }
              }}
              placeholder="发送消息、输入 @ 或 / 选择技能"
              rows={1}
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
                <button aria-label="上传文件" className="sp-square-button" onClick={() => fileInputRef.current?.click()} type="button">
                  <img alt="" aria-hidden="true" className="sp-square-button-icon" src={getUploadIconUrl()} />
                </button>
                <button
                  aria-label="发送"
                  className="sp-send-circle"
                  disabled={hasPendingMessage && !draft.trim()}
                  onClick={() => void handleSendMessage()}
                  type="button"
                >
                  <ComposerSendIcon />
                </button>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
