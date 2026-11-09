import { RICH_TEXT_PATTERN, classifyToken } from "./richText";

export function findMention(text: string, cursor: number): { query: string; start: number } | null {
  const upToCursor = text.slice(0, cursor);
  const match = upToCursor.match(/(?:^|\s)@([a-zA-Z0-9_]{0,20})$/);
  if (!match) return null;
  const query = match[1];
  return { query, start: upToCursor.length - query.length - 1 };
}

export function renderMentionHighlight(text: string) {
  return text.split(RICH_TEXT_PATTERN).map((part, i) => {
    const token = classifyToken(part);
    switch (token.kind) {
      case "mention":
      case "hashtag":
      case "link":
        return (
          <span key={i} className="text-brand">
            {token.raw}
          </span>
        );
      case "underline":
        return (
          <span key={i} className="underline">
            {token.raw}
          </span>
        );
      case "code":
        return (
          <span key={i} className="bg-neutral-200/50 dark:bg-neutral-700/50">
            {token.raw}
          </span>
        );
      default:
        return part;
    }
  });
}
