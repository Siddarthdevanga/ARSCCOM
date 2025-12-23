const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Centralized API fetch helper
 */
export const apiFetch = async (url, options = {}) => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  const res = await fetch(`${API}${url}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {})
    },
    body: options.body,
    credentials: "include"
  });

  /* ===============================
     HANDLE AUTH ERRORS
  =============================== */
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("company");
      window.location.href = "/auth/login";
    }
    throw new Error("Unauthorized");
  }

  /* ===============================
     HANDLE API ERRORS
  =============================== */
  if (!res.ok) {
    let message = "API request failed";
    try {
      const err = await res.json();
      message = err.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  /* ===============================
     NO CONTENT
  =============================== */
  if (res.status === 204) return null;

  return res.json();
};

