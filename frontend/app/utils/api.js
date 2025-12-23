const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Centralized API fetch helper (SAFE VERSION)
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body,
    credentials: "include"
  });

  /* ===============================
     AUTH ERROR (DO NOT REDIRECT HERE)
  =============================== */
  if (res.status === 401) {
    const error = new Error("UNAUTHORIZED");
    error.code = 401;
    throw error;
  }

  /* ===============================
     OTHER API ERRORS
  =============================== */
  if (!res.ok) {
    let message = "API request failed";

    try {
      const err = await res.json();
      message = err.message || message;
    } catch (_) {}

    const error = new Error(message);
    error.code = res.status;
    throw error;
  }

  /* ===============================
     NO CONTENT
  =============================== */
  if (res.status === 204) return null;

  return res.json();
};
