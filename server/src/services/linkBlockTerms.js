const BLOCKED_LINK_DOMAINS = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com",
  "youporn.com",
  "chaturbate.com",
  "onlyfans.com",
  "livejasmin.com",
  "grabify.link",
  "iplogger.org",
  "iplogger.com",
  "iplogger.ru",
  "yip.su",
  "2no.co",
  "stake.com",
  "bet365.com",
  "1xbet.com",
];

const URL_PATTERN = /https:\/\/\S+/g;

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isBlockedHostname(hostname) {
  return BLOCKED_LINK_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function findBlockedLink(text) {
  const urls = String(text || "").match(URL_PATTERN) || [];
  for (const url of urls) {
    const hostname = extractHostname(url);
    if (hostname && isBlockedHostname(hostname)) return url;
  }
  return null;
}

export function isLinkBlocked(text) {
  return findBlockedLink(text) !== null;
}
