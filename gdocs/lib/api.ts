const API_BASE =
  typeof window !== "undefined"
    ? ""
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string | null;
  devUser?: { id: string; email: string; name?: string };
}

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, devUser, headers = {}, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  if (!(rest.body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
    if (devUser?.email) requestHeaders["x-user-email"] = devUser.email;
    if (devUser?.name) requestHeaders["x-user-name"] = devUser.name;
  } else if (devUser) {
    requestHeaders["x-dev-user-id"] = devUser.id;
    requestHeaders["x-dev-user-email"] = devUser.email;
    if (devUser.name) requestHeaders["x-dev-user-name"] = devUser.name;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `HTTP error! status: ${res.status}`);
  }

  return data as T;
}
