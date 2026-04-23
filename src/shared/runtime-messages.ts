import type {
  ChatRequestPayload,
  ModelConfig,
  QuickTaskPayload,
  SelectionChatPayload,
  SummaryRequestPayload,
} from "./types";

export type RuntimeRequest =
  | { type: "OPEN_SIDE_PANEL" }
  | { type: "CREATE_CONVERSATION" }
  | { type: "SET_ACTIVE_CONVERSATION"; payload: { conversationId: string } }
  | { type: "SEND_CHAT_MESSAGE"; payload: ChatRequestPayload }
  | { type: "PAGE_SUMMARY"; payload: SummaryRequestPayload }
  | { type: "SELECTION_CHAT"; payload: SelectionChatPayload }
  | { type: "QUICK_ACTION"; payload: QuickTaskPayload }
  | { type: "TEST_MODEL_CONNECTION"; payload: { config: ModelConfig } };

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
