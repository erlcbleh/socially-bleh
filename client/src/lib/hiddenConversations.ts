const STORAGE_KEY = "socially:hiddenConversations";

type HiddenMap = Record<string, string>;

function read(): HiddenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as HiddenMap) : {};
  } catch {
    return {};
  }
}

function write(map: HiddenMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    
  }
}

export function readHiddenConversations(): HiddenMap {
  return read();
}

export function hideConversation(key: string): HiddenMap {
  const map = read();
  map[key] = new Date().toISOString();
  write(map);
  return { ...map };
}

export function isConversationHidden(map: HiddenMap, key: string, lastMessageAt: string | null): boolean {
  const clearedAt = map[key];
  if (!clearedAt) return false;
  if (!lastMessageAt) return true;
  return new Date(lastMessageAt) <= new Date(clearedAt);
}
