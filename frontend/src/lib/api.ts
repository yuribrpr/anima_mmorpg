type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const safeParseJson = async <T>(response: Response): Promise<T | undefined> => {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
};

export const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  const isFormData = init.body instanceof FormData;

  if (!headers.has("Content-Type") && init.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await safeParseJson<ApiErrorBody | T>(response);

  if (!response.ok) {
    const apiPayload = payload as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      apiPayload?.error?.code ?? "REQUEST_FAILED",
      apiPayload?.error?.message ?? `Request failed (HTTP ${response.status})`,
      apiPayload?.error?.details,
    );
  }

  return payload as T;
};
