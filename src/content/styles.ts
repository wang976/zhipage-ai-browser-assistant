export const contentStyles = `
  :host {
    all: initial;
  }

  .zp-root {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    color: #182132;
    font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  }

  .zp-avatar-wrap,
  .zp-selection-highlight,
  .zp-toolbar,
  .zp-chat-toolbar,
  .zp-card,
  .zp-toast {
    pointer-events: auto;
  }

  .zp-avatar-wrap {
    position: fixed;
    right: 18px;
    width: 44px;
    height: 44px;
  }

  .zp-selection-highlight {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  .zp-selection-highlight-rect {
    position: fixed;
    border-radius: 2px;
    background: rgba(47, 106, 247, 0.26);
  }

  .zp-avatar-button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(180deg, #f9fbff, #ddebff);
    box-shadow:
      0 10px 20px rgba(31, 55, 115, 0.18),
      inset 0 0 0 1px rgba(255, 255, 255, 0.9);
  }

  .zp-avatar-button img {
    width: 34px;
    height: 34px;
    border-radius: 50%;
  }

  .zp-avatar-tip {
    position: absolute;
    right: calc(100% + 18px);
    top: 0;
    opacity: 0;
    transform: translateX(8px);
    padding: 8px 12px;
    border-radius: 14px;
    color: white;
    font-size: 12px;
    line-height: 1.1;
    white-space: nowrap;
    pointer-events: none;
    background: #11161f;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-tip::after {
    content: "";
    position: absolute;
    top: 50%;
    right: -6px;
    width: 10px;
    height: 10px;
    background: #11161f;
    transform: translateY(-50%) rotate(45deg);
  }

  .zp-avatar-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: -4px;
    display: grid;
    justify-items: center;
    width: 52px;
    opacity: 0;
    transform: translateY(-6px);
    padding: 8px 0;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 42px rgba(30, 48, 92, 0.16);
    transition: opacity 140ms ease, transform 140ms ease;
    pointer-events: none;
  }

  .zp-avatar-menu::before {
    content: "";
    position: absolute;
    top: -8px;
    right: 0;
    width: 100%;
    height: 8px;
    background: transparent;
  }

  .zp-avatar-dismiss {
    position: absolute;
    left: -9px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(114, 128, 154, 0.24);
    border-radius: 50%;
    padding: 0;
    color: #8e98aa;
    font-size: 18px;
    line-height: 1;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 6px 14px rgba(30, 48, 92, 0.12);
    opacity: 0;
    transform: scale(0.88);
    pointer-events: none;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-wrap:hover .zp-avatar-tip,
  .zp-avatar-wrap:hover .zp-avatar-menu {
    opacity: 1;
    transform: translateY(0);
  }

  .zp-avatar-wrap:hover .zp-avatar-menu {
    pointer-events: auto;
  }

  .zp-avatar-wrap:hover .zp-avatar-dismiss {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }

  .zp-avatar-action {
    position: relative;
    border: 0;
    width: 100%;
    height: 44px;
    border-radius: 16px;
    padding: 0;
    color: #182132;
    background: transparent;
  }

  .zp-avatar-action svg {
    width: 19px;
    height: 19px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .zp-avatar-action::before {
    content: attr(data-tooltip);
    position: absolute;
    right: calc(100% + 16px);
    top: 50%;
    opacity: 0;
    transform: translate(8px, -50%);
    padding: 8px 10px;
    border-radius: 14px;
    color: white;
    font-size: 12px;
    line-height: 1.15;
    white-space: nowrap;
    pointer-events: none;
    background: #11161f;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-action::after {
    content: "";
    position: absolute;
    top: 50%;
    right: calc(100% + 10px);
    width: 10px;
    height: 10px;
    opacity: 0;
    pointer-events: none;
    background: #11161f;
    transform: translateY(-50%) rotate(45deg);
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-action:hover::before {
    opacity: 1;
    transform: translate(0, -50%);
  }

  .zp-avatar-action:hover::after {
    opacity: 1;
  }

  .zp-avatar-divider {
    width: 20px;
    height: 1px;
    background: rgba(114, 128, 154, 0.18);
  }

  .zp-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: calc(100vw - 28px);
    padding: 5px 7px;
    border: 1px solid rgba(114, 128, 154, 0.16);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: 0 12px 28px rgba(28, 43, 78, 0.14);
    backdrop-filter: blur(18px);
  }

  .zp-toolbar.is-minimal {
    gap: 3px;
    padding: 5px;
  }

  .zp-toolbar-button,
  .zp-toolbar-avatar,
  .zp-toolbar-control,
  .zp-chat-toolbar,
  .zp-card-close,
  .zp-chat-send,
  .zp-toast,
  .zp-card-select {
    border: 0;
  }

  .zp-toolbar,
  .zp-toolbar-avatar,
  .zp-toolbar-button,
  .zp-toolbar-control,
  .zp-chat-toolbar,
  .zp-chat-send {
    box-sizing: border-box;
  }

  .zp-toolbar-grip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: 0 0 auto;
    padding: 0 3px 0 1px;
  }

  .zp-toolbar-grip span {
    width: 2px;
    height: 16px;
    border-radius: 999px;
    background: rgba(114, 128, 154, 0.52);
  }

  .zp-toolbar-avatar {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    padding: 0;
    background: linear-gradient(180deg, #f8fbff, #d9e7ff);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.95);
  }

  .zp-toolbar-avatar img {
    width: 18px;
    height: 18px;
    border-radius: 50%;
  }

  .zp-toolbar-button,
  .zp-toolbar-control,
  .zp-chat-send {
    cursor: pointer;
    transition:
      background 140ms ease,
      color 140ms ease,
      transform 140ms ease,
      box-shadow 140ms ease;
  }

  .zp-toolbar-button,
  .zp-toolbar-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    flex: 0 0 auto;
    min-height: 30px;
    border-radius: 12px;
    padding: 0 9px;
    color: #182132;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }

  .zp-toolbar-control {
    width: 30px;
    min-width: 30px;
    padding: 0;
  }

  .zp-toolbar-button.is-active {
    background: rgba(47, 106, 247, 0.1);
    color: #2458d8;
  }

  .zp-toolbar-button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
  }

  .zp-toolbar-button-text {
    white-space: nowrap;
  }

  .zp-toolbar-button svg,
  .zp-toolbar-control svg,
  .zp-chat-send svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .zp-toolbar.is-minimal .zp-toolbar-button {
    width: 30px;
    min-width: 30px;
    padding: 0;
  }

  .zp-toolbar.is-minimal .zp-toolbar-button-text {
    display: none;
  }

  .zp-toolbar-button:hover,
  .zp-toolbar-control:hover,
  .zp-avatar-action:hover,
  .zp-avatar-dismiss:hover,
  .zp-card-close:hover {
    background: rgba(47, 106, 247, 0.09);
  }

  .zp-toolbar-separator {
    width: 1px;
    height: 16px;
    flex: 0 0 auto;
    background: rgba(114, 128, 154, 0.22);
  }

  .zp-chat-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100vw - 28px);
    min-height: 44px;
    padding: 0 10px 0 8px;
    border: 1px solid rgba(198, 205, 216, 0.9);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 10px 24px rgba(17, 24, 39, 0.1);
    backdrop-filter: blur(18px);
    transform-origin: center center;
    animation: zp-chat-expand 180ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }

  .zp-chat-input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    outline: none;
    padding: 0;
    color: #182132;
    font-size: 13px;
    line-height: 1.2;
    background: transparent;
  }

  .zp-chat-input::placeholder {
    color: #c3c7ce;
  }

  .zp-chat-send {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    min-width: 28px;
    padding: 0;
    border-radius: 50%;
    color: white;
    background: linear-gradient(135deg, #2f6af7, #4d8dff);
  }

  .zp-chat-send:hover {
    background: linear-gradient(135deg, #255ee4, #3d7ef9);
    box-shadow: 0 8px 18px rgba(47, 106, 247, 0.22);
  }

  .zp-chat-send:disabled {
    cursor: default;
    color: #ffffff;
    background: #d7d9de;
    box-shadow: none;
  }

  .zp-chat-send:disabled:hover {
    background: #d7d9de;
  }

  @keyframes zp-chat-expand {
    from {
      opacity: 0.72;
      transform: scaleX(0.62);
    }

    to {
      opacity: 1;
      transform: scaleX(1);
    }
  }

  .zp-card {
    position: fixed;
    display: grid;
    gap: 14px;
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    padding: 18px;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 48px rgba(30, 48, 92, 0.18);
    backdrop-filter: blur(20px);
  }

  .zp-card-drag-zone {
    display: grid;
    place-items: center;
    margin-top: -2px;
  }

  .zp-card-drag-handle {
    width: 38px;
    height: 6px;
    border: 0;
    border-radius: 999px;
    background: rgba(114, 128, 154, 0.42);
    cursor: grab;
  }

  .zp-card-drag-handle:active {
    cursor: grabbing;
  }

  .zp-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .zp-card-header strong {
    font-size: 18px;
  }

  .zp-card-close {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    color: #72809a;
    background: transparent;
  }

  .zp-card-lang-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .zp-card-lang-row span {
    text-align: center;
    color: #72809a;
  }

  .zp-card-select {
    width: 100%;
    border-radius: 16px;
    padding: 12px 14px;
    color: #182132;
    background: rgba(242, 246, 255, 0.96);
  }

  .zp-card-source {
    border-left: 4px solid rgba(47, 106, 247, 0.28);
    padding-left: 12px;
    color: #72809a;
    line-height: 1.6;
  }

  .zp-card-body {
    min-height: 58px;
    font-size: 14px;
    line-height: 1.72;
  }

  .zp-card-body.is-error {
    color: #cf4f4f;
  }

  .zp-markdown > :first-child {
    margin-top: 0;
  }

  .zp-markdown > :last-child {
    margin-bottom: 0;
  }

  .zp-markdown h1,
  .zp-markdown h2,
  .zp-markdown h3,
  .zp-markdown h4,
  .zp-markdown h5,
  .zp-markdown h6,
  .zp-markdown p,
  .zp-markdown ul,
  .zp-markdown ol,
  .zp-markdown blockquote,
  .zp-markdown pre,
  .zp-markdown table {
    margin: 0 0 12px;
  }

  .zp-markdown h1 {
    font-size: 1.2em;
  }

  .zp-markdown h2 {
    font-size: 1.12em;
  }

  .zp-markdown h3 {
    font-size: 1.05em;
  }

  .zp-markdown h4,
  .zp-markdown h5,
  .zp-markdown h6 {
    font-size: 1em;
  }

  .zp-markdown ul,
  .zp-markdown ol {
    padding-left: 1.35em;
  }

  .zp-markdown li + li {
    margin-top: 6px;
  }

  .zp-markdown blockquote {
    padding: 10px 12px;
    border-left: 4px solid rgba(47, 106, 247, 0.28);
    border-radius: 0 14px 14px 0;
    color: #516079;
    background: rgba(47, 106, 247, 0.06);
  }

  .zp-markdown pre {
    overflow: auto;
    padding: 13px 14px;
    border-radius: 16px;
    line-height: 1.58;
    color: #1f2937;
    background: #ffffff;
    border: 1px solid rgba(114, 128, 154, 0.18);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }

  .zp-markdown code {
    font-family:
      "SFMono-Regular",
      "JetBrains Mono",
      "Fira Code",
      "Cascadia Code",
      Consolas,
      monospace;
    font-size: 0.86em;
  }

  .zp-markdown :not(pre) > code {
    padding: 0.15em 0.4em;
    border-radius: 8px;
    color: #c43d62;
    background: rgba(196, 61, 98, 0.1);
  }

  .zp-markdown pre code {
    display: block;
    white-space: pre;
    background: transparent;
  }

  .zp-markdown table {
    width: 100%;
    border-collapse: collapse;
    overflow: hidden;
    border-radius: 14px;
    font-size: 0.9em;
  }

  .zp-markdown th,
  .zp-markdown td {
    padding: 9px 11px;
    border: 1px solid rgba(114, 128, 154, 0.22);
    text-align: left;
  }

  .zp-markdown th {
    background: rgba(47, 106, 247, 0.08);
  }

  .zp-markdown a {
    color: #2f6af7;
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .zp-markdown .hljs {
    display: block;
    overflow-x: auto;
    color: #1f2937;
    background: transparent;
  }

  .zp-markdown .hljs-comment,
  .zp-markdown .hljs-quote {
    color: #8b95a7;
    font-style: italic;
  }

  .zp-markdown .hljs-keyword,
  .zp-markdown .hljs-selector-tag,
  .zp-markdown .hljs-literal,
  .zp-markdown .hljs-section,
  .zp-markdown .hljs-link {
    color: #7c3aed;
    font-weight: 600;
  }

  .zp-markdown .hljs-string,
  .zp-markdown .hljs-title,
  .zp-markdown .hljs-name,
  .zp-markdown .hljs-attribute,
  .zp-markdown .hljs-symbol,
  .zp-markdown .hljs-bullet,
  .zp-markdown .hljs-addition {
    color: #0f766e;
  }

  .zp-markdown .hljs-number,
  .zp-markdown .hljs-built_in,
  .zp-markdown .hljs-type,
  .zp-markdown .hljs-template-tag,
  .zp-markdown .hljs-template-variable {
    color: #c2410c;
  }

  .zp-markdown .hljs-variable,
  .zp-markdown .hljs-regexp,
  .zp-markdown .hljs-meta,
  .zp-markdown .hljs-selector-id,
  .zp-markdown .hljs-selector-class {
    color: #2563eb;
  }

  .zp-markdown .hljs-attr,
  .zp-markdown .hljs-property,
  .zp-markdown .hljs-params,
  .zp-markdown .hljs-function {
    color: #b45309;
  }

  .zp-markdown .hljs-deletion {
    color: #b42318;
  }

  .zp-markdown .hljs-emphasis {
    font-style: italic;
  }

  .zp-markdown .hljs-strong {
    font-weight: 700;
  }

  .zp-card-footer {
    color: #72809a;
    font-size: 12px;
  }

  .zp-toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    padding: 12px 16px;
    border-radius: 16px;
    color: white;
    background: rgba(17, 22, 31, 0.94);
    box-shadow: 0 14px 32px rgba(17, 22, 31, 0.24);
  }
`;
