import { STORAGE_KEY } from "./constants";
import { defaultAppState } from "./defaults";
import type { AppState } from "./types";
import { createConversation, sortConversations } from "./utils";

function normalizeState(state: Partial<AppState> | undefined): AppState {
  const base = structuredClone(defaultAppState);
  const next: AppState = {
    ...base,
    ...state,
    settings: {
      ...base.settings,
      ...state?.settings,
      general: {
        ...base.settings.general,
        ...state?.settings?.general,
      },
      avatarSidebar: {
        ...base.settings.avatarSidebar,
        ...state?.settings?.avatarSidebar,
      },
      selectionToolbar: {
        ...base.settings.selectionToolbar,
        ...state?.settings?.selectionToolbar,
      },
      shortcuts: {
        ...base.settings.shortcuts,
        ...state?.settings?.shortcuts,
      },
    },
    conversations: state?.conversations?.length ? sortConversations(state.conversations) : [createConversation()],
    models: state?.models?.length ? state.models : base.models,
    currentModelId: state?.currentModelId ?? base.currentModelId,
  };

  if (!next.conversations.some((conversation) => conversation.id === next.activeConversationId)) {
    next.activeConversationId = next.conversations[0].id;
  }

  if (next.currentModelId && !next.models.some((model) => model.id === next.currentModelId && model.enabled)) {
    next.currentModelId = next.models.find((model) => model.enabled)?.id ?? null;
  }

  return next;
}

export async function loadAppState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(result[STORAGE_KEY] as Partial<AppState> | undefined);
}

export async function saveAppState(state: AppState) {
  const normalized = normalizeState(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function updateAppState(updater: (state: AppState) => AppState | Promise<AppState>) {
  const current = await loadAppState();
  const next = await updater(current);
  return saveAppState(next);
}

export function subscribeToAppState(listener: (state: AppState) => void) {
  const handleChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) {
      return;
    }

    listener(normalizeState(changes[STORAGE_KEY].newValue as Partial<AppState>));
  };

  chrome.storage.onChanged.addListener(handleChange);
  return () => chrome.storage.onChanged.removeListener(handleChange);
}

export async function getCurrentModelConfig(state?: AppState) {
  const nextState = state ?? (await loadAppState());
  const enabledModels = nextState.models.filter((model) => model.enabled);
  if (!enabledModels.length) {
    return null;
  }

  return enabledModels.find((model) => model.id === nextState.currentModelId) ?? enabledModels[0];
}
