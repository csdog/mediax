import { marked } from "marked";
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
