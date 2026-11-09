import { createApi, ApiError, type ErrorBody } from "@socially/shared/api";

const API_ORIGIN = import.meta.env.VITE_API_URL || "";

const ACCOUNT_BLOCK_CODES = ["account_suspended", "account_banned", "account_deactivated"];
const ACCOUNT_BLOCK_THROTTLE_MS = 5000;

let accountBlockedHandler: (() => void) | null = null;
let lastAccountBlockSignal = 0;

export function setAccountBlockedHandler(handler: (() => void) | null) {
  accountBlockedHandler = handler;
}

function onErrorResponse(status: number, body: ErrorBody) {
  if (status === 403 && body.code === "ip_banned" && !window.location.pathname.startsWith("/error/")) {
    window.location.replace("/error/blocked");
  }

  if (status === 403 && ACCOUNT_BLOCK_CODES.includes(body.code || "")) {
    const now = Date.now();
    if (now - lastAccountBlockSignal > ACCOUNT_BLOCK_THROTTLE_MS) {
      lastAccountBlockSignal = now;
      accountBlockedHandler?.();
    }
  }
}

export { ApiError };

export const apiOrigin = API_ORIGIN;

export const api = createApi({ origin: API_ORIGIN, onErrorResponse });
