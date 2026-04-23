# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Chrome Extension Manifest V3 project for “智页浏览器 AI 助手”.

- `src/background/`: service worker, runtime message routing, side panel opening, and model request orchestration.
- `src/content/`: content script, floating avatar, selection toolbar, explain/translate cards, and Shadow DOM styles.
- `src/sidepanel/`: React side panel UI for chat, model switching, and multi-session history.
- `src/options/`: React settings page for general, model, avatar, toolbar, and shortcut settings.
- `src/shared/`: shared types, storage wrapper, default state, constants, utilities, and model client.
- `public/`: extension manifest and static assets copied into `dist/`.
- `images/`: reference screenshots and original icon assets.
- `scripts/`: build helpers, including icon generation and script bundling.
- `dist/`: generated extension output; load this directory in Chrome.
- `release/`: packaged artifacts such as `.crx`, `.zip`, and `.pem` when generated.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run check`: run TypeScript type checking with `tsc --noEmit`.
- `npm run build`: build the extension into `dist/`, generate PNG icons, and bundle background/content scripts.
- `./node_modules/.bin/crx3 -p release/zhipage-browser-ai-assistant.pem -o release/zhipage-browser-ai-assistant.crx -z release/zhipage-browser-ai-assistant.zip dist`: optionally package `dist/` into CRX/ZIP.

For local use, open `chrome://extensions/`, enable Developer Mode, and load `dist/` as an unpacked extension.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep shared contracts in `src/shared/types.ts`. Prefer explicit names such as `ConversationMessage`, `SelectionToolbarSettings`, and `requestModelReply`. CSS classes use project prefixes (`sp-`, `op-`, `zp-`) to separate side panel, options, and content script styles. Content script UI must remain isolated through Shadow DOM.

## Testing Guidelines

There is no dedicated unit test framework yet. Before submitting changes, run:

```bash
npm run check
npm run build
```

Manually verify core flows in Chrome: side panel opens, settings persist, model calls fail gracefully without API keys, avatar appears, selection toolbar actions work, and page summary sends to the active conversation.

## Commit & Pull Request Guidelines

This workspace has no existing Git history. Use concise Conventional Commit-style messages, for example `feat: add model settings form` or `fix: handle missing model config`.

Pull requests should include a short description, validation commands, affected UI areas, and screenshots or screen recordings for visible changes.

## Security & Configuration Tips

Do not hardcode API keys. Model credentials are stored in `chrome.storage.local`. Reuse the same `.pem` when repackaging to preserve the extension ID, but avoid publishing private keys unintentionally.
