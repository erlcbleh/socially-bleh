const MAX_CONTENT = 1000;

function trim(value, max = MAX_CONTENT) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max) : text;
}

function describeAuthor(author) {
  if (!author || typeof author !== "object") return {};

  const authorId = author.id ? String(author.id) : "";
  if (!author.username) return authorId ? { authorId } : {};

  return {
    authorId,
    authorUsername: author.username,
    authorDisplayName: author.displayName || author.username,
    authorAvatarUrl: author.avatarUrl || "",
  };
}

export function buildPostSnapshot(post, author = null) {
  if (!post) return undefined;

  const resolvedAuthor = author || (post.author && post.author.username ? post.author : null);

  return {
    kind: post.parentPostId || post.parentPost ? "reply" : "post",
    content: trim(post.content),
    mediaUrl: post.mediaUrl || null,
    mediaType: post.mediaType || null,
    gifUrl: post.gifUrl || null,
    pollOptions: Array.isArray(post.poll?.options) ? post.poll.options.map((o) => trim(o.text, 100)) : [],
    postedAt: post.createdAt || null,
    ...describeAuthor(resolvedAuthor),
  };
}

export function buildMessageSnapshot(message, sender = null) {
  if (!message) return undefined;

  const resolvedSender = sender || (message.sender && message.sender.username ? message.sender : null);

  return {
    kind: "message",
    content: trim(message.content),
    mediaUrl: message.mediaUrl || null,
    mediaType: message.mediaUrl ? "image" : null,
    gifUrl: message.gifUrl || null,
    pollOptions: [],
    postedAt: message.createdAt || null,
    ...describeAuthor(resolvedSender),
  };
}

export function buildTextSnapshot(text, { kind = "text", author = null } = {}) {
  return {
    kind,
    content: trim(text),
    mediaUrl: null,
    mediaType: null,
    gifUrl: null,
    pollOptions: [],
    postedAt: new Date(),
    ...describeAuthor(author),
  };
}

export function describeSnapshot(snapshot) {
  if (!snapshot) return "";
  if (snapshot.content) return snapshot.content;
  if (snapshot.gifUrl) return "(GIF only, no text)";
  if (snapshot.mediaType === "video") return "(Video only, no text)";
  if (snapshot.mediaUrl) return "(Image only, no text)";
  if (snapshot.pollOptions?.length) return `(Poll only: ${snapshot.pollOptions.join(" / ")})`;
  return "(No text content)";
}
