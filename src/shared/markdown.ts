import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";

const renderer = new marked.Renderer();

const MARKED_OPTIONS = {
  async: false as const,
  breaks: true,
  gfm: true,
  renderer,
};

const LANGUAGE_ALIASES: Record<string, string> = {
  cjs: "javascript",
  cs: "csharp",
  csharp: "csharp",
  htm: "xml",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  shell: "bash",
  shellscript: "bash",
  sh: "bash",
  svg: "xml",
  ts: "typescript",
  tsx: "typescript",
  vue: "xml",
  yml: "yaml",
  zsh: "bash",
};

export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPlainTextToHtml(text: string) {
  return escapeHtml(text).replaceAll("\n", "<br />");
}

function normalizeLanguage(language: string | undefined) {
  if (!language) {
    return "";
  }

  const normalized = language.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

function highlightCodeBlock(text: string, language: string | undefined) {
  const normalizedLanguage = normalizeLanguage(language);

  try {
    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      return {
        html: hljs.highlight(text, {
          ignoreIllegals: true,
          language: normalizedLanguage,
        }).value,
        language: normalizedLanguage,
      };
    }

    const autoDetected = hljs.highlightAuto(text);
    return {
      html: autoDetected.value || escapeHtml(text),
      language: autoDetected.language || normalizedLanguage,
    };
  } catch {
    return {
      html: escapeHtml(text),
      language: normalizedLanguage,
    };
  }
}

renderer.code = ({ text, lang }) => {
  const highlighted = highlightCodeBlock(text, lang);
  const languageClass = highlighted.language ? ` language-${escapeHtml(highlighted.language)}` : "";
  return `<pre><code class="hljs${languageClass}">${highlighted.html}</code></pre>`;
};

function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["class", "rel", "target"],
  });
}

function withExternalLinkAttrs(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer nofollow");
  });
  return template.innerHTML;
}

export function renderMarkdownToHtml(text: string) {
  if (!text.trim()) {
    return "";
  }

  try {
    const html = marked.parse(text, MARKED_OPTIONS);
    return withExternalLinkAttrs(sanitizeHtml(typeof html === "string" ? html : ""));
  } catch {
    return renderPlainTextToHtml(text);
  }
}
