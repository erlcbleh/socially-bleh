import { createApi, ApiError, type ErrorBody } from "@socially/shared/api";

let unauthenticatedHandler: (() => void) | null = null;

export function setUnauthenticatedHandler(handler: (() => void) | null) {
  unauthenticatedHandler = handler;
}

function onErrorResponse(status: number, _body: ErrorBody) {
  if (status === 401) unauthenticatedHandler?.();
}

export { ApiError };

export const api = createApi({ basePath: "/api/staff", onErrorResponse });

export const rootApi = createApi({ basePath: "/api", onErrorResponse });

export const staffLoginUrl = "/api/auth/staff/discord";
