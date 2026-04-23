# 智页浏览器 AI 助手

基于 Chrome Extension Manifest V3 实现的浏览器 AI 助手，包含：

- Chrome Side Panel 主对话侧边栏
- 多会话历史管理
- 悬浮头像入口
- 网页划词工具栏
- 解释 / 翻译卡片
- 模型配置与切换
- 设置页与快捷键说明

项目按 `AGENTS.md` 要求实现，参考图均来自仓库 `./images`。

## 技术栈

- TypeScript
- React
- Vite
- Chrome Extension Manifest V3
- `chrome.storage.local`

## 已实现功能

- 点击扩展图标可打开 Side Panel
- `Ctrl+K` / `Command+K` 快捷键可打开 Side Panel
- Side Panel 内支持多会话、新建会话、切换会话、持久化历史
- Side Panel 支持文本输入、文件选择占位、发送消息、切换已配置模型
- 侧边栏右上角菜单支持历史对话与设置页
- 设置页支持：
  - 通用设置
  - 模型设置
  - 头像侧边栏
  - 划词工具栏
  - 快捷键设置
- 网页右侧悬浮头像支持：
  - 打开侧边栏
  - 总结此页面
  - 截图识别文字（预留）
  - 翻译此页面（预留）
- 划词工具栏支持：
  - 打开侧边栏
  - 解释
  - 翻译
  - chat 联动侧边栏
  - AI 搜索 / 朗读（预留）
- 所有配置与会话历史持久化到 `chrome.storage.local`

## 安装依赖

```bash
npm install
```

## 本地构建

```bash
npm run build
```

构建产物会输出到 `dist/`，其中包含：

- `manifest.json`
- `background.js`
- `content.js`
- `sidepanel.html`
- `options.html`
- 扩展图标与静态资源

## 加载到 Chrome 扩展

1. 打开 Chrome。
2. 进入 `chrome://extensions/`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目的 `dist/` 目录。

## 配置模型 API

1. 打开扩展的 Side Panel。
2. 点击右上角菜单，进入“设置”。
3. 在“模型设置”中新增或编辑模型配置。
4. 至少填写以下字段：
   - `displayName`
   - `baseUrl`
   - `apiKey`
   - `model`
5. 启用该模型，并可将其设为默认模型。
6. 回到 Side Panel，在底部左下角选择当前使用模型。

### 兼容方式

当前模型调用层按 OpenAI-compatible Chat Completions 方式封装，请确保你填写的接口支持：

- `POST {baseUrl}/chat/completions`
- `Authorization: Bearer <apiKey>`
- 请求体包含 `model` 与 `messages`

## 快捷键说明

- 清单内建议快捷键为 `Ctrl+K`，macOS 为 `Command+K`
- Chrome 对扩展快捷键的动态修改有限制
- 如需修改，请进入 `chrome://extensions/shortcuts`

## 预留接口

以下功能已保留 UI 或处理入口，但未实现真实能力：

- 截图识别文字
- 整页翻译
- AI 搜索
- 朗读
- 文件多模态上传

## 开发说明

- 图标源文件使用 `images/icon.svg`
- 构建脚本会自动生成 Manifest 所需 PNG 图标
- 内容脚本使用 Shadow DOM，避免污染网页样式
- Side Panel / 设置页使用 React
- 背景脚本统一处理模型请求、消息流转和 Side Panel 打开逻辑

## 验证

已执行：

```bash
npm run check
npm run build
```
