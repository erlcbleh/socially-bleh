const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ErrorBody {
  message?: string;
  code?: string;
  [key: string]: unknown;
}

export interface ApiConfig {
  origin?: string;
  basePath?: string;
  onErrorResponse?: (status: number, body: ErrorBody) => void;
}

export interface ApiClient {
  get: <T>(path: string, init?: RequestInit) => Promise<T>;
  post: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  put: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
  delete: <T>(path: string, body?: unknown, init?: RequestInit) => Promise<T>;
}

export function createApi(config: ApiConfig = {}): ApiClient {
  const base = `${config.origin || ""}${config.basePath || "/api"}`;

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      credentials: "include",
      ...options,
      signal: options.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const body: ErrorBody = await res.json().catch(() => ({ message: res.statusText }));
      config.onErrorResponse?.(res.status, body);
      throw new ApiError(body.message || "Request failed", res.status, body.code);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, { ...init, method: "POST", body: body ? JSON.stringify(body) : undefined }),
    put: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, { ...init, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, { ...init, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, { ...init, method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
  };
}
