export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "done" | "pending" | "error";
export type ProviderName = "chatgpt" | "kimi" | "deepseek" | "qwen" | "doubao";
export type ToolbarAppearance = "rich" | "minimal";

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "text" | "image" | "file";
  textPreview?: string;
  dataUrl?: string;
}

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  error?: string;
  attachments?: Attachment[];
  meta?: Record<string, string>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
}

export interface ModelConfig {
  id: string;
  providerName: ProviderName;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface GeneralSettings {
  defaultTranslateTarget: string;
}

export interface AvatarSidebarSettings {
  enabled: boolean;
  disabledSites: string[];
}

export interface SelectionToolbarSettings {
  enabled: boolean;
  appearance: ToolbarAppearance;
}

export interface ShortcutSettings {
  openSidePanel: string;
}

export interface AppSettings {
  general: GeneralSettings;
  avatarSidebar: AvatarSidebarSettings;
  selectionToolbar: SelectionToolbarSettings;
  shortcuts: ShortcutSettings;
}

export interface AppState {
  conversations: Conversation[];
  activeConversationId: string;
  models: ModelConfig[];
  currentModelId: string | null;
  settings: AppSettings;
}

export interface ChatRequestPayload {
  conversationId?: string;
  content: string;
  attachments?: Attachment[];
  titleHint?: string;
  quotedText?: string;
}

export interface QuickTaskPayload {
  requestId: string;
  mode: "explain" | "translate";
  selectedText: string;
  targetLanguage?: string;
  pageTitle?: string;
  pageUrl?: string;
}

export interface QuickActionStreamEventPayload {
  requestId: string;
  mode: QuickTaskPayload["mode"];
  phase: "start" | "delta" | "done" | "error";
  content: string;
  error?: string;
}

export interface SummaryRequestPayload {
  pageUrl: string;
}

export interface SelectionChatPayload {
  selectedText: string;
  prompt: string;
  titleHint?: string;
}
