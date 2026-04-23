import { useEffect, useState } from "react";
import {
  PROVIDER_LABELS,
  PROVIDER_MODEL_HINTS,
  PROVIDER_URL_HINTS,
  TARGET_LANGUAGES,
} from "../shared/constants";
import { updateAppState } from "../shared/storage";
import { useAppState } from "../shared/use-app-state";
import type { AppState, ModelConfig, ProviderName } from "../shared/types";

type SectionKey = "general" | "models" | "avatar" | "selection" | "shortcut";

const sections: Array<{ key: SectionKey; label: string }> = [
  { key: "general", label: "通用" },
  { key: "models", label: "模型设置" },
  { key: "avatar", label: "头像侧边栏" },
  { key: "selection", label: "划词工具栏" },
  { key: "shortcut", label: "快捷键设置" },
];

function getIconUrl() {
  return chrome.runtime.getURL("assets/icon.svg");
}

function createModelDraft(providerName: ProviderName = "chatgpt"): ModelConfig {
  return {
    id: `custom-${crypto.randomUUID()}`,
    providerName,
    displayName: PROVIDER_LABELS[providerName],
    baseUrl: PROVIDER_URL_HINTS[providerName],
    apiKey: "",
    model: PROVIDER_MODEL_HINTS[providerName],
    enabled: false,
  };
}

async function testModelConnection(config: ModelConfig) {
  const response = (await chrome.runtime.sendMessage({
    type: "TEST_MODEL_CONNECTION",
    payload: { config },
  })) as { ok: boolean; data?: { text: string }; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error || "连接测试失败");
  }

  return response.data?.text || "连接成功";
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="op-card">
      <div className="op-section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function OptionsApp() {
  const { state } = useAppState();
  const [activeSection, setActiveSection] = useState<SectionKey>("general");
  const [draftModel, setDraftModel] = useState<ModelConfig>(() => createModelDraft());
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [disabledSiteInput, setDisabledSiteInput] = useState("");
  const [shortcutValue, setShortcutValue] = useState("Ctrl+K");
  const [testingMessage, setTestingMessage] = useState("");

  useEffect(() => {
    void chrome.commands.getAll().then((commands) => {
      const command = commands.find((item) => item.name === "open-side-panel");
      setShortcutValue(command?.shortcut || "未设置");
    });
  }, []);

  useEffect(() => {
    if (!editingModelId) {
      return;
    }

    const currentModel = state.models.find((model) => model.id === editingModelId);
    if (currentModel) {
      setDraftModel(currentModel);
    }
  }, [editingModelId, state.models]);

  async function patchState(recipe: (currentState: AppState) => AppState) {
    await updateAppState(recipe);
  }

  async function saveDraftModel() {
    await patchState((currentState) => {
      const exists = currentState.models.some((model) => model.id === draftModel.id);
      const nextModels = exists
        ? currentState.models.map((model) => (model.id === draftModel.id ? draftModel : model))
        : [draftModel, ...currentState.models];
      const nextCurrentModelId =
        currentState.currentModelId || !draftModel.enabled ? currentState.currentModelId : draftModel.id;

      return {
        ...currentState,
        models: nextModels,
        currentModelId: nextCurrentModelId,
      };
    });

    setEditingModelId(draftModel.id);
  }

  async function deleteModel(modelId: string) {
    await patchState((currentState) => {
      const nextModels = currentState.models.filter((model) => model.id !== modelId);
      const nextCurrentModelId =
        currentState.currentModelId === modelId ? nextModels.find((model) => model.enabled)?.id ?? null : currentState.currentModelId;
      return {
        ...currentState,
        models: nextModels.length ? nextModels : [createModelDraft("chatgpt")],
        currentModelId: nextCurrentModelId,
      };
    });

    setEditingModelId(null);
    setDraftModel(createModelDraft());
  }

  async function setDefaultModel(modelId: string) {
    await patchState((currentState) => ({
      ...currentState,
      currentModelId: modelId,
      models: currentState.models.map((model) => (model.id === modelId ? { ...model, enabled: true } : model)),
    }));
  }

  async function addDisabledSite() {
    const candidate = disabledSiteInput.trim();
    if (!candidate) {
      return;
    }

    await patchState((currentState) => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        avatarSidebar: {
          ...currentState.settings.avatarSidebar,
          disabledSites: Array.from(new Set([...currentState.settings.avatarSidebar.disabledSites, candidate])),
        },
      },
    }));

    setDisabledSiteInput("");
  }

  async function removeDisabledSite(site: string) {
    await patchState((currentState) => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        avatarSidebar: {
          ...currentState.settings.avatarSidebar,
          disabledSites: currentState.settings.avatarSidebar.disabledSites.filter((item) => item !== site),
        },
      },
    }));
  }

  function renderContent() {
    if (activeSection === "general") {
      return (
        <div className="op-content-grid">
          <SectionCard
            description="保持轻量、浅色、可立即配置的体验，默认翻译目标会用于划词翻译卡片。"
            title="通用设置"
          >
            <div className="op-general-hero">
              <img alt="智页浏览器 AI 助手" src={getIconUrl()} />
              <div>
                <h3>智页浏览器 AI 助手</h3>
                <p>版本 {chrome.runtime.getManifest().version}</p>
              </div>
            </div>
            <div className="op-general-stats">
              <div>
                <strong>{state.conversations.length}</strong>
                <span>已保存会话</span>
              </div>
              <div>
                <strong>{state.models.filter((model) => model.enabled).length}</strong>
                <span>已启用模型</span>
              </div>
              <div>
                <strong>{state.currentModelId ? "已选择" : "未选择"}</strong>
                <span>当前模型状态</span>
              </div>
            </div>
            <label className="op-field">
              <span>默认翻译目标</span>
              <select
                onChange={(event) =>
                  void patchState((currentState) => ({
                    ...currentState,
                    settings: {
                      ...currentState.settings,
                      general: {
                        ...currentState.settings.general,
                        defaultTranslateTarget: event.target.value,
                      },
                    },
                  }))
                }
                value={state.settings.general.defaultTranslateTarget}
              >
                {TARGET_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>
          </SectionCard>
        </div>
      );
    }

    if (activeSection === "models") {
      return (
        <div className="op-model-layout">
          <SectionCard
            description="所有侧边栏对话、划词解释、翻译、页面总结都会使用当前选中的模型。"
            title="模型配置"
          >
            <div className="op-model-list">
              {state.models.map((model) => (
                <article key={model.id} className={`op-model-card ${state.currentModelId === model.id ? "is-default" : ""}`}>
                  <div>
                    <h3>{model.displayName}</h3>
                    <p>
                      {PROVIDER_LABELS[model.providerName]} · {model.model || "未填写模型名"}
                    </p>
                  </div>
                  <div className="op-model-actions">
                    <span className={`op-pill ${model.enabled ? "is-enabled" : ""}`}>{model.enabled ? "已启用" : "已禁用"}</span>
                    <button onClick={() => setEditingModelId(model.id)} type="button">
                      编辑
                    </button>
                    <button onClick={() => void setDefaultModel(model.id)} type="button">
                      设为默认
                    </button>
                    <button onClick={() => void deleteModel(model.id)} type="button">
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="op-primary-action"
              onClick={() => {
                const nextDraft = createModelDraft();
                setDraftModel(nextDraft);
                setEditingModelId(null);
              }}
              type="button"
            >
              新增模型配置
            </button>
          </SectionCard>

          <SectionCard description="支持 OpenAI-compatible 风格接口，便于接入不同服务商。" title="编辑模型">
            <div className="op-model-form">
              <label className="op-field">
                <span>服务商</span>
                <select
                  onChange={(event) => {
                    const providerName = event.target.value as ProviderName;
                    setDraftModel((current) => ({
                      ...current,
                      providerName,
                      displayName: current.displayName || PROVIDER_LABELS[providerName],
                      baseUrl: PROVIDER_URL_HINTS[providerName],
                      model: current.model || PROVIDER_MODEL_HINTS[providerName],
                    }));
                  }}
                  value={draftModel.providerName}
                >
                  {Object.entries(PROVIDER_LABELS).map(([providerName, label]) => (
                    <option key={providerName} value={providerName}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="op-field">
                <span>显示名称</span>
                <input
                  onChange={(event) => setDraftModel((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="例如：ChatGPT 主力模型"
                  type="text"
                  value={draftModel.displayName}
                />
              </label>
              <label className="op-field">
                <span>API 地址</span>
                <input
                  onChange={(event) => setDraftModel((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder={PROVIDER_URL_HINTS[draftModel.providerName]}
                  type="text"
                  value={draftModel.baseUrl}
                />
              </label>
              <label className="op-field">
                <span>API Key</span>
                <input
                  onChange={(event) => setDraftModel((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder="sk-..."
                  type="password"
                  value={draftModel.apiKey}
                />
              </label>
              <label className="op-field">
                <span>模型名称</span>
                <input
                  onChange={(event) => setDraftModel((current) => ({ ...current, model: event.target.value }))}
                  placeholder={PROVIDER_MODEL_HINTS[draftModel.providerName]}
                  type="text"
                  value={draftModel.model}
                />
              </label>
              <label className="op-switch-row">
                <div>
                  <strong>启用此模型</strong>
                  <p>禁用后不会出现在侧边栏模型选择器中。</p>
                </div>
                <input
                  checked={draftModel.enabled}
                  onChange={(event) => setDraftModel((current) => ({ ...current, enabled: event.target.checked }))}
                  type="checkbox"
                />
              </label>
              <div className="op-inline-actions">
                <button className="op-primary-action" onClick={() => void saveDraftModel()} type="button">
                  保存配置
                </button>
                <button
                  className="op-secondary-action"
                  onClick={async () => {
                    setTestingMessage("正在测试连接...");
                    try {
                      const text = await testModelConnection({ ...draftModel, enabled: true });
                      setTestingMessage(text);
                    } catch (error) {
                      setTestingMessage(error instanceof Error ? error.message : "连接失败");
                    }
                  }}
                  type="button"
                >
                  测试连接
                </button>
              </div>
              {testingMessage ? <p className="op-feedback">{testingMessage}</p> : null}
            </div>
          </SectionCard>
        </div>
      );
    }

    if (activeSection === "avatar") {
      return (
        <SectionCard description="控制网页右侧悬浮头像是否长期出现，以及禁用站点列表。" title="头像侧边栏">
          <label className="op-switch-card">
            <div>
              <h3>始终悬浮在网页侧边</h3>
              <p>关闭后，网页中不会显示悬浮头像入口，Ctrl+K 仍可通过命令打开侧边栏。</p>
            </div>
            <input
              checked={state.settings.avatarSidebar.enabled}
              onChange={(event) =>
                void patchState((currentState) => ({
                  ...currentState,
                  settings: {
                    ...currentState.settings,
                    avatarSidebar: {
                      ...currentState.settings.avatarSidebar,
                      enabled: event.target.checked,
                    },
                  },
                }))
              }
              type="checkbox"
            />
          </label>
          <div className="op-disabled-sites">
            <div className="op-inline-input">
              <input
                onChange={(event) => setDisabledSiteInput(event.target.value)}
                placeholder="例如：github.com 或 *://*.example.com/*"
                type="text"
                value={disabledSiteInput}
              />
              <button className="op-primary-action" onClick={() => void addDisabledSite()} type="button">
                添加禁用网站
              </button>
            </div>
            <div className="op-chip-list">
              {state.settings.avatarSidebar.disabledSites.length ? (
                state.settings.avatarSidebar.disabledSites.map((site) => (
                  <button key={site} className="op-chip" onClick={() => void removeDisabledSite(site)} type="button">
                    <span>{site}</span>
                    <span>删除</span>
                  </button>
                ))
              ) : (
                <p className="op-empty-copy">当前没有禁用站点，悬浮头像会在大多数网页上显示。</p>
              )}
            </div>
          </div>
        </SectionCard>
      );
    }

    if (activeSection === "selection") {
      return (
        <SectionCard description="控制选中网页文本时的工具栏出现逻辑与两种外观。" title="划词工具栏">
          <label className="op-switch-card">
            <div>
              <h3>选中网页文字时出现</h3>
              <p>解释、翻译和 chat 都依赖这里的开关。</p>
            </div>
            <input
              checked={state.settings.selectionToolbar.enabled}
              onChange={(event) =>
                void patchState((currentState) => ({
                  ...currentState,
                  settings: {
                    ...currentState.settings,
                    selectionToolbar: {
                      ...currentState.settings.selectionToolbar,
                      enabled: event.target.checked,
                    },
                  },
                }))
              }
              type="checkbox"
            />
          </label>
          <div className="op-appearance-grid">
            {[
              {
                key: "rich",
                title: "直观的",
                preview: "头像 AI搜索 解释 翻译 问问智页",
              },
              {
                key: "minimal",
                title: "极简的",
                preview: "头像 · 解释 · 翻译 · Chat",
              },
            ].map((appearance) => (
              <button
                key={appearance.key}
                className={`op-appearance-card ${
                  state.settings.selectionToolbar.appearance === appearance.key ? "is-active" : ""
                }`}
                onClick={() =>
                  void patchState((currentState) => ({
                    ...currentState,
                    settings: {
                      ...currentState.settings,
                      selectionToolbar: {
                        ...currentState.settings.selectionToolbar,
                        appearance: appearance.key as AppState["settings"]["selectionToolbar"]["appearance"],
                      },
                    },
                  }))
                }
                type="button"
              >
                <div className="op-appearance-preview">{appearance.preview}</div>
                <strong>{appearance.title}</strong>
              </button>
            ))}
          </div>
        </SectionCard>
      );
    }

    return (
      <SectionCard description="Chrome 对扩展快捷键的动态修改能力有限，因此这里展示当前快捷键并提供跳转入口。" title="快捷键设置">
        <div className="op-shortcut-list">
          <div className="op-shortcut-row">
            <div>
              <strong>唤起侧边栏</strong>
              <p>当前命令名：open-side-panel</p>
            </div>
            <span className="op-shortcut-pill">{shortcutValue}</span>
          </div>
        </div>
        <div className="op-inline-actions">
          <button
            className="op-primary-action"
            onClick={() => {
              void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
            }}
            type="button"
          >
            打开 Chrome 快捷键管理页
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="op-shell">
      <aside className="op-sidebar">
        <div className="op-brand">
          <img alt="智页浏览器 AI 助手" src={getIconUrl()} />
          <div>
            <strong>智页</strong>
            <span>Browser AI Assistant</span>
          </div>
        </div>
        <nav className="op-nav">
          {sections.map((section) => (
            <button
              key={section.key}
              className={`op-nav-item ${activeSection === section.key ? "is-active" : ""}`}
              onClick={() => setActiveSection(section.key)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="op-main">
        <header className="op-page-header">
          <h1>{sections.find((section) => section.key === activeSection)?.label}</h1>
          <p>所有设置均持久化到 `chrome.storage.local`，刷新浏览器后仍会保留。</p>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}
