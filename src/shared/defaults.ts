import {
  DEFAULT_TRANSLATE_TARGET,
  PROVIDER_LABELS,
  PROVIDER_MODEL_HINTS,
  PROVIDER_URL_HINTS,
} from "./constants";
import type { AppState, ModelConfig, ProviderName } from "./types";
import { createConversation } from "./utils";

function createModelTemplate(providerName: ProviderName): ModelConfig {
  return {
    id: `provider-${providerName}`,
    providerName,
    displayName: PROVIDER_LABELS[providerName],
    baseUrl: PROVIDER_URL_HINTS[providerName],
    apiKey: "",
    model: PROVIDER_MODEL_HINTS[providerName],
    enabled: false,
  };
}

const initialConversation = createConversation();

export const defaultAppState: AppState = {
  conversations: [initialConversation],
  activeConversationId: initialConversation.id,
  models: [
    createModelTemplate("chatgpt"),
    createModelTemplate("kimi"),
    createModelTemplate("deepseek"),
    createModelTemplate("qwen"),
    createModelTemplate("doubao"),
  ],
  currentModelId: null,
  settings: {
    general: {
      defaultTranslateTarget: DEFAULT_TRANSLATE_TARGET,
    },
    avatarSidebar: {
      enabled: true,
      disabledSites: [],
    },
    selectionToolbar: {
      enabled: true,
      appearance: "rich",
    },
    shortcuts: {
      openSidePanel: "Ctrl+K",
    },
  },
};
