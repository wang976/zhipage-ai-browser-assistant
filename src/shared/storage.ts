import { STORAGE_CONVERSATION_PREFIX, STORAGE_KEY, STORAGE_META_KEY } from "./constants";
import { defaultAppState } from "./defaults";
import type { AppSettings, AppState, Conversation, ModelConfig } from "./types";
import { createConversation, sortConversations } from "./utils";

interface AppStorageMeta {
  activeConversationId: string;
  conversationIds: string[];
  models: ModelConfig[];
  currentModelId: string | null;
  settings: AppSettings;
}

let initializationPromise: Promise<void> | null = null;

function createDefaultState() {
  return structuredClone(defaultAppState);
}

function getConversationStorageKey(conversationId: string) {
  return `${STORAGE_CONVERSATION_PREFIX}${conversationId}`;
}

function normalizeConversation(conversation: Partial<Conversation> | undefined): Conversation {
  const base = createConversation();

  return {
    ...base,
    ...conversation,
    id: conversation?.id || base.id,
    title: conversation?.title?.trim() || base.title,
    messages: Array.isArray(conversation?.messages) ? conversation.messages : [],
  };
}

function normalizeState(state: Partial<AppState> | undefined): AppState {
  const base = createDefaultState();
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
    conversations: state?.conversations?.length ? sortConversations(state.conversations.map((conversation) => normalizeConversation(conversation))) : [createConversation()],
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

function normalizeMeta(meta: Partial<AppStorageMeta> | undefined): AppStorageMeta {
  const base = createDefaultState();
  const next: AppStorageMeta = {
    activeConversationId: meta?.activeConversationId ?? base.activeConversationId,
    conversationIds: meta?.conversationIds?.length ? Array.from(new Set(meta.conversationIds)) : base.conversations.map((conversation) => conversation.id),
    models: meta?.models?.length ? meta.models : base.models,
    currentModelId: meta?.currentModelId ?? base.currentModelId,
    settings: {
      ...base.settings,
      ...meta?.settings,
      general: {
        ...base.settings.general,
        ...meta?.settings?.general,
      },
      avatarSidebar: {
        ...base.settings.avatarSidebar,
        ...meta?.settings?.avatarSidebar,
      },
      selectionToolbar: {
        ...base.settings.selectionToolbar,
        ...meta?.settings?.selectionToolbar,
      },
      shortcuts: {
        ...base.settings.shortcuts,
        ...meta?.settings?.shortcuts,
      },
    },
  };

  if (next.currentModelId && !next.models.some((model) => model.id === next.currentModelId && model.enabled)) {
    next.currentModelId = next.models.find((model) => model.enabled)?.id ?? null;
  }

  return next;
}

async function ensureStorageInitialized() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const result = await chrome.storage.local.get([STORAGE_META_KEY, STORAGE_KEY]);
      const meta = result[STORAGE_META_KEY] as Partial<AppStorageMeta> | undefined;

      if (meta) {
        return;
      }

      const legacyState = result[STORAGE_KEY] as Partial<AppState> | undefined;
      if (legacyState) {
        await saveAppState(normalizeState(legacyState));
        await chrome.storage.local.remove(STORAGE_KEY);
        return;
      }

      await saveAppState(createDefaultState());
    })().finally(() => {
      initializationPromise = null;
    });
  }

  await initializationPromise;
}

export async function loadAppState() {
  await ensureStorageInitialized();

  const metaResult = await chrome.storage.local.get(STORAGE_META_KEY);
  const meta = normalizeMeta(metaResult[STORAGE_META_KEY] as Partial<AppStorageMeta> | undefined);
  const conversationKeys = meta.conversationIds.map((conversationId) => getConversationStorageKey(conversationId));
  const conversationResult = conversationKeys.length ? await chrome.storage.local.get(conversationKeys) : {};
  const conversations = sortConversations(
    meta.conversationIds
      .map((conversationId) => {
        const storedConversation = conversationResult[getConversationStorageKey(conversationId)] as Partial<Conversation> | undefined;
        return storedConversation ? normalizeConversation(storedConversation) : null;
      })
      .filter((conversation): conversation is Conversation => Boolean(conversation)),
  );

  if (!conversations.length) {
    const fallbackState = createDefaultState();
    await saveAppState(fallbackState);
    return fallbackState;
  }

  const nextState = normalizeState({
    ...meta,
    conversations,
  });

  const nextConversationIds = nextState.conversations.map((conversation) => conversation.id);
  const needsRepair =
    nextConversationIds.length !== meta.conversationIds.length ||
    nextConversationIds.some((conversationId, index) => conversationId !== meta.conversationIds[index]) ||
    nextState.activeConversationId !== meta.activeConversationId;

  if (needsRepair) {
    await saveAppState(nextState);
  }

  return nextState;
}

export async function saveAppState(state: AppState) {
  const normalized = normalizeState(state);
  const previousMetaResult = await chrome.storage.local.get(STORAGE_META_KEY);
  const previousMeta = normalizeMeta(previousMetaResult[STORAGE_META_KEY] as Partial<AppStorageMeta> | undefined);
  const nextMeta: AppStorageMeta = {
    activeConversationId: normalized.activeConversationId,
    conversationIds: normalized.conversations.map((conversation) => conversation.id),
    models: normalized.models,
    currentModelId: normalized.currentModelId,
    settings: normalized.settings,
  };
  const entries: Record<string, AppStorageMeta | Conversation> = {
    [STORAGE_META_KEY]: nextMeta,
  };

  for (const conversation of normalized.conversations) {
    entries[getConversationStorageKey(conversation.id)] = conversation;
  }

  await chrome.storage.local.set(entries);

  const staleConversationKeys = previousMeta.conversationIds
    .filter((conversationId) => !nextMeta.conversationIds.includes(conversationId))
    .map((conversationId) => getConversationStorageKey(conversationId));

  if (staleConversationKeys.length) {
    await chrome.storage.local.remove(staleConversationKeys);
  }

  return normalized;
}

export async function updateAppState(updater: (state: AppState) => AppState | Promise<AppState>) {
  const current = await loadAppState();
  const next = await updater(current);
  return saveAppState(next);
}

export function subscribeToAppState(listener: (state: AppState) => void) {
  const handleChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const hasRelevantChange = Object.keys(changes).some(
      (key) => key === STORAGE_META_KEY || key === STORAGE_KEY || key.startsWith(STORAGE_CONVERSATION_PREFIX),
    );
    if (!hasRelevantChange) {
      return;
    }

    void loadAppState().then(listener);
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
