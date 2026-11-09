export const RICH_TEXT_PATTERN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|@[a-zA-Z0-9_]{3,20}|#[a-zA-Z0-9_]+|https:\/\/\S+)/g;

export type RichTextTokenKind =
  | "bold"
  | "underline"
  | "code"
  | "italic"
  | "mention"
  | "hashtag"
  | "link"
  | "text";

export interface RichTextToken {
  kind: RichTextTokenKind;
  raw: string;
  inner: string;
}

export function classifyToken(token: string): RichTextToken {
  if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
    return { kind: "bold", raw: token, inner: token.slice(2, -2) };
  }
  if (token.startsWith("__") && token.endsWith("__") && token.length >= 4) {
    return { kind: "underline", raw: token, inner: token.slice(2, -2) };
  }
  if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
    return { kind: "code", raw: token, inner: token.slice(1, -1) };
  }
  if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
    return { kind: "italic", raw: token, inner: token.slice(1, -1) };
  }
  if (token.startsWith("@")) return { kind: "mention", raw: token, inner: token };
  if (token.startsWith("#")) return { kind: "hashtag", raw: token, inner: token };
  if (token.startsWith("https://")) return { kind: "link", raw: token, inner: token };
  return { kind: "text", raw: token, inner: token };
}
