import { marked } from "marked";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeUrl(href: string) {
  return /^(https?:|mailto:)/i.test(href) ? escapeHtml(href) : "";
}

export function markdownToHtml(input: string): string {
  const walk = (tokens: any[]): string =>
    tokens
      .map((t) => {
        switch (t.type) {
          case "heading": {
            const level = Math.min(Math.max(Number(t.depth) || 1, 1), 3);
            return `<h${level}>${walk(t.tokens ?? [])}</h${level}>`;
          }
          case "paragraph":
            return `<p>${walk(t.tokens ?? [])}</p>`;
          case "list": {
            const tag = t.ordered ? "ol" : "ul";
            const items = t.items
              .map((item: { tokens?: any[] }) => `<li>${walk(item.tokens ?? [])}</li>`)
              .join("");
            return `<${tag}>${items}</${tag}>`;
          }
          case "list_item":
            return walk(t.tokens ?? []);
          case "blockquote":
            return `<blockquote>${walk(t.tokens ?? [])}</blockquote>`;
          case "code":
            return `<pre><code>${escapeHtml(t.text ?? "")}</code></pre>`;
          case "codespan":
            return `<code>${escapeHtml(t.text ?? "")}</code>`;
          case "strong":
            return `<strong>${walk(t.tokens ?? [])}</strong>`;
          case "em":
            return `<em>${walk(t.tokens ?? [])}</em>`;
          case "del":
            return `<del>${walk(t.tokens ?? [])}</del>`;
          case "link": {
            const href = safeUrl(String(t.href ?? ""));
            const label = walk(t.tokens ?? []);
            return href ? `<a href="${href}">${label}</a>` : label;
          }
          case "image": {
            const href = safeUrl(String(t.href ?? ""));
            return href ? `<img src="${href}" alt="${escapeHtml(String(t.text ?? ""))}">` : "";
          }
          case "html":
            return "";
          case "br":
            return "<br>";
          case "hr":
            return "<hr>";
          case "space":
            return "";
          default:
            return t.tokens ? walk(t.tokens) : escapeHtml(String(t.text ?? t.raw ?? ""));
        }
      })
      .join("");
  return walk(marked.lexer(input)).trim();
}

export function markdownToText(input: string): string {
  const walk = (tokens: any[]): string =>
    tokens
      .map((t) => {
        switch (t.type) {
          case "heading":
          case "paragraph":
            return walk(t.tokens ?? []) + "\n\n";
          case "list":
            return (
              t.items
                .map(
                  (item: any, i: number) => (t.ordered ? `${i + 1}. ` : "• ") + walk(item.tokens),
                )
                .join("\n") + "\n"
            );
          case "list_item":
            return walk(t.tokens ?? []);
          case "link":
            return walk(t.tokens ?? []) + ` (${t.href})`;
          case "image":
            return t.text || "";
          case "blockquote":
            return walk(t.tokens ?? []) + "\n";
          case "code":
            return t.text + "\n";
          case "html":
            return "";
          case "space":
          case "br":
          case "hr":
            return "\n";
          default:
            return t.tokens ? walk(t.tokens) : (t.text ?? t.raw ?? "");
        }
      })
      .join("");
  return walk(marked.lexer(input))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
