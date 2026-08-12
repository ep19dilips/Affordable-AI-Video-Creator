// Thin client for the idea2video Cloudflare Worker API.
// Set NEXT_PUBLIC_API_URL to your deployed Worker URL (e.g. https://idea2video-api.yourname.workers.dev)

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  signup: (email: string, password: string, fullName: string) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, fullName }) }),
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  createVideo: (payload: any) => request("/videos", { method: "POST", body: JSON.stringify(payload) }),
  estimateMinutes: (durationMinutes: number, productionMode: string) =>
    request("/videos/estimate", { method: "POST", body: JSON.stringify({ durationMinutes, productionMode }) }),
  listVideos: () => request("/videos"),
  getVideo: (id: string) => request(`/videos/${id}`),
  approveVideo: (id: string) => request(`/videos/${id}/approve`, { method: "POST" }),
};

export function saveSession(token: string, user: any) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function getUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
