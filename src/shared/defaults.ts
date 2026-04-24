import {
  BUILTIN_PROVIDER_NAMES,
  DEFAULT_TRANSLATE_TARGET,
  PROVIDER_LABELS,
  PROVIDER_MODEL_HINTS,
  PROVIDER_URL_HINTS,
} from "./constants";
import type { AppState, BuiltInProviderName, ModelConfig } from "./types";
import { createConversation } from "./utils";

function createModelTemplate(providerName: BuiltInProviderName): ModelConfig {
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
  models: BUILTIN_PROVIDER_NAMES.map((providerName) => createModelTemplate(providerName)),
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
