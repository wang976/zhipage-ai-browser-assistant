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
  .zp-toolbar,
  .zp-card,
  .zp-toast {
    pointer-events: auto;
  }

  .zp-avatar-wrap {
    position: fixed;
    right: 18px;
    top: 42%;
    display: grid;
    justify-items: end;
    gap: 10px;
  }

  .zp-avatar-button {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(180deg, #f9fbff, #ddebff);
    box-shadow:
      0 14px 28px rgba(31, 55, 115, 0.22),
      inset 0 0 0 1px rgba(255, 255, 255, 0.9);
  }

  .zp-avatar-button img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
  }

  .zp-avatar-tip {
    opacity: 0;
    transform: translateX(8px);
    padding: 10px 16px;
    border-radius: 16px;
    color: white;
    background: #11161f;
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-menu {
    display: grid;
    gap: 8px;
    min-width: 166px;
    opacity: 0;
    transform: translateY(-6px);
    padding: 12px;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 42px rgba(30, 48, 92, 0.16);
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .zp-avatar-wrap:hover .zp-avatar-tip,
  .zp-avatar-wrap:hover .zp-avatar-menu {
    opacity: 1;
    transform: translateY(0);
  }

  .zp-avatar-action {
    border: 0;
    border-radius: 16px;
    padding: 12px 14px;
    color: #182132;
    text-align: left;
    background: rgba(239, 244, 255, 0.96);
  }

  .zp-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 1px solid rgba(114, 128, 154, 0.16);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 18px 38px rgba(28, 43, 78, 0.18);
    backdrop-filter: blur(18px);
  }

  .zp-toolbar.is-minimal {
    gap: 6px;
  }

  .zp-toolbar-button,
  .zp-toolbar-avatar,
  .zp-card-close,
  .zp-chat-send,
  .zp-toast,
  .zp-card-select {
    border: 0;
  }

  .zp-toolbar-avatar {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 16px;
    background: rgba(219, 231, 255, 0.75);
  }

  .zp-toolbar-avatar img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .zp-toolbar-button {
    min-height: 42px;
    border-radius: 16px;
    padding: 0 14px;
    color: #182132;
    background: transparent;
  }

  .zp-toolbar.is-minimal .zp-toolbar-button {
    padding: 0 12px;
    font-size: 13px;
  }

  .zp-toolbar-button:hover,
  .zp-avatar-action:hover,
  .zp-card-close:hover,
  .zp-chat-send:hover {
    background: rgba(47, 106, 247, 0.09);
  }

  .zp-toolbar-separator {
    width: 1px;
    height: 24px;
    background: rgba(114, 128, 154, 0.22);
  }

  .zp-chat-mode {
    gap: 12px;
    padding: 12px;
  }

  .zp-chat-input {
    width: 320px;
    border: 0;
    outline: none;
    border-radius: 18px;
    padding: 12px 14px;
    color: #182132;
    background: rgba(242, 246, 255, 0.92);
  }

  .zp-chat-send {
    min-width: 88px;
    border-radius: 16px;
    padding: 12px 16px;
    color: white;
    background: linear-gradient(135deg, #2f6af7, #4d8dff);
  }

  .zp-card-stack {
    position: fixed;
    top: 106px;
    right: 24px;
    display: grid;
    gap: 14px;
    width: min(400px, calc(100vw - 32px));
  }

  .zp-card {
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid rgba(114, 128, 154, 0.18);
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 48px rgba(30, 48, 92, 0.18);
    backdrop-filter: blur(20px);
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
    white-space: pre-wrap;
    line-height: 1.78;
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
