export interface StatusCopy {
  code: string;
  title: string;
  message: string;
}

export const STATUS_COPY: Record<string, StatusCopy> = {
  "400": {
    code: "400",
    title: "Bad request",
    message: "Something about that request wasn't valid. Try again, or head back home.",
  },
  "401": {
    code: "401",
    title: "Not signed in",
    message: "You need to be signed in to view this page.",
  },
  "402": {
    code: "402",
    title: "Payment required",
    message: "This part of Socially isn't available on your account.",
  },
  "403": {
    code: "403",
    title: "No access",
    message: "You don't have permission to view this page.",
  },
  "404": {
    code: "404",
    title: "Page not found",
    message: "This page doesn't exist, or it may have been moved or deleted.",
  },
  "408": {
    code: "408",
    title: "Request timed out",
    message: "That took too long to complete. Check your connection and try again.",
  },
  "429": {
    code: "429",
    title: "Too many requests",
    message: "You're doing that a bit too fast. Wait a moment and try again.",
  },
  "500": {
    code: "500",
    title: "Something went wrong",
    message: "An error on our end stopped that from loading. We've logged it - try again shortly.",
  },
  "502": {
    code: "502",
    title: "Bad gateway",
    message: "Socially couldn't be reached right now. This is usually brief - try again in a moment.",
  },
  "503": {
    code: "503",
    title: "Temporarily unavailable",
    message: "Socially is down for maintenance or under heavy load. Please try again shortly.",
  },
  "504": {
    code: "504",
    title: "Gateway timeout",
    message: "The server took too long to respond. Try again in a moment.",
  },
  "505": {
    code: "505",
    title: "Unsupported browser",
    message: "Your browser is using an HTTP version Socially doesn't support. Try updating it.",
  },
  blocked: {
    code: "403",
    title: "Network blocked",
    message:
      "Access from your network has been blocked by Socially staff. If you think this is a mistake, contact support.",
  },
};

export function statusCopyFor(key: string | undefined): StatusCopy {
  if (key && STATUS_COPY[key]) return STATUS_COPY[key];
  return {
    code: key && /^\d{3}$/.test(key) ? key : "Error",
    title: "Something went wrong",
    message: "An unexpected error occurred. Try again, or head back home.",
  };
}
