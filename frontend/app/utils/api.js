const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ===============================================
   HELPERS
=============================================== */

const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

/**
 * Build headers for PROTECTED routes (attaches JWT)
 */
const authHeaders = (extra = {}) => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

/**
 * Build headers for PUBLIC routes (NO JWT attached)
 */
const publicHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  ...extra,
});

/* ===============================================
   CORE FETCH — PROTECTED (sends JWT)
=============================================== */
export const apiFetch = async (url, options = {}) => {
  const res = await fetch(`${API}${url}`, {
    method: options.method || "GET",
    headers: authHeaders(options.headers || {}),
    body: options.body,
    credentials: "include",
  });

  if (res.status === 401) {
    // Clear stale token so next page load redirects to login cleanly
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("company");
    }
    const error = new Error("UNAUTHORIZED");
    error.code = 401;
    throw error;
  }

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

  if (res.status === 204) return null;
  return res.json();
};

/* ===============================================
   PUBLIC FETCH — NO AUTH (never sends JWT)
   Use this for all /api/public/* endpoints
=============================================== */
export const publicFetch = async (url, options = {}) => {
  const res = await fetch(`${API}${url}`, {
    method: options.method || "GET",
    headers: publicHeaders(options.headers || {}),
    body: options.body,
    credentials: "omit", // ← never send cookies/tokens on public routes
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const err = await res.json();
      message = err.message || message;
    } catch (_) {}
    const error = new Error(message);
    error.code = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
};

/* ===============================================
   FILE DOWNLOAD HELPER (PROTECTED)
=============================================== */
const downloadFile = async (endpoint, filename, errorMessage = "Failed to download file") => {
  const token = getToken();
  if (!token) throw new Error("Authentication required");

  const res = await fetch(`${API}${endpoint}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("company");
    }
    const error = new Error("UNAUTHORIZED");
    error.code = 401;
    throw error;
  }

  if (!res.ok) {
    let message = errorMessage;
    try {
      const err = await res.json();
      message = err.message || message;
    } catch (_) {}
    const error = new Error(message);
    error.code = res.status;
    throw error;
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return true;
};

/* ===============================================
   VISITOR PUBLIC FUNCTIONS
   All use publicFetch — no JWT ever attached
=============================================== */

/** Get company info + QR code by slug */
export const getVisitorCompanyInfo = async (slug) =>
  publicFetch(`/api/public/visitor/${slug}/info`);

/** Send OTP to visitor email */
export const sendVisitorOtp = async (slug, email) =>
  publicFetch(`/api/public/visitor/${slug}/otp/send`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });

/** Verify visitor OTP */
export const verifyVisitorOtp = async (slug, email, otp) =>
  publicFetch(`/api/public/visitor/${slug}/otp/verify`, {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });

/** Register visitor (multipart — no JSON content-type) */
export const registerVisitor = async (slug, formData, otpToken) => {
  const res = await fetch(`${API}/api/public/visitor/${slug}/register`, {
    method: "POST",
    headers: {
      "otp-token": otpToken,   // ✅ correctly sent, no JWT
      // ❌ do NOT set Content-Type here — browser sets it with boundary for FormData
    },
    body: formData,
    credentials: "omit",
  });

  if (!res.ok) {
    let message = "Registration failed";
    try {
      const err = await res.json();
      message = err.message || message;
    } catch (_) {}
    const error = new Error(message);
    error.code = res.status;
    throw error;
  }

  return res.json();
};

/* ===============================================
   QR CODE FUNCTIONS (PROTECTED)
=============================================== */
export const fetchPublicBookingInfo = async () =>
  apiFetch("/api/conference/public-booking-info");

export const downloadQRCode = async (companyName = "company") => {
  const safeFilename = `${companyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-conference-qr-${Date.now()}.png`;
  return downloadFile("/api/conference/qr-code/download", safeFilename, "Failed to download QR code");
};

/* ===============================================
   EXCEL EXPORT FUNCTIONS (PROTECTED)
=============================================== */
export const downloadVisitorsExcel = async () =>
  downloadFile("/api/exports/visitors", `visitors-${Date.now()}.xlsx`, "Failed to download visitors data");

export const downloadBookingsExcel = async () =>
  downloadFile("/api/exports/conference-bookings", `bookings-${Date.now()}.xlsx`, "Failed to download bookings data");

export const downloadCompleteReport = async () =>
  downloadFile("/api/exports/all", `complete-report-${Date.now()}.xlsx`, "Failed to download complete report");

export const getExportStats = async () =>
  apiFetch("/api/exports/stats");

/* ===============================================
   SHARE / CLIPBOARD FUNCTIONS
=============================================== */
export const shareURL = async (url, title = "Conference Room Booking") => {
  if (!url) throw new Error("URL is required");

  if (typeof window !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text: "Book a conference room", url });
      return { success: true, method: "share" };
    } catch (err) {
      if (err.name === "AbortError") return { success: false, method: "share", cancelled: true };
    }
  }

  if (typeof window !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return { success: true, method: "clipboard" };
    } catch (_) {}
  }

  if (typeof window !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) return { success: true, method: "fallback" };
    } catch (_) {}
  }

  throw new Error("Unable to share or copy URL");
};

export const copyToClipboard = async (text) => {
  if (!text) throw new Error("Text is required");

  if (typeof window !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: "clipboard" };
    } catch (_) {}
  }

  if (typeof window !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) return { success: true, method: "fallback" };
    } catch (_) {}
  }

  throw new Error("Unable to copy to clipboard");
};

/* ===============================================
   AUTH UTILITIES
=============================================== */
export const isAuthenticated = () => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
};

export const getStoredCompany = () => {
  if (typeof window === "undefined") return null;
  try {
    const c = localStorage.getItem("company");
    return c ? JSON.parse(c) : null;
  } catch {
    return null;
  }
};

export const clearAuthData = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("company");
};

/* ===============================================
   VISITOR MANAGEMENT (PROTECTED)
=============================================== */
export const getVisitors = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return apiFetch(params ? `/api/visitors?${params}` : "/api/visitors");
};

export const createVisitor = async (visitorData) =>
  apiFetch("/api/visitors", { method: "POST", body: JSON.stringify(visitorData) });

export const updateVisitor = async (id, visitorData) =>
  apiFetch(`/api/visitors/${id}`, { method: "PATCH", body: JSON.stringify(visitorData) });

export const checkoutVisitor = async (id) =>
  apiFetch(`/api/visitors/${id}/checkout`, { method: "PATCH" });

/* ===============================================
   CONFERENCE MANAGEMENT (PROTECTED)
=============================================== */
export const getConferenceRooms = async () => apiFetch("/api/conference/rooms");
export const getAllConferenceRooms = async () => apiFetch("/api/conference/rooms/all");

export const createConferenceRoom = async (roomData) =>
  apiFetch("/api/conference/rooms", { method: "POST", body: JSON.stringify(roomData) });

export const updateConferenceRoom = async (id, roomData) =>
  apiFetch(`/api/conference/rooms/${id}`, { method: "PATCH", body: JSON.stringify(roomData) });

export const deleteConferenceRoom = async (id) =>
  apiFetch(`/api/conference/rooms/${id}`, { method: "DELETE" });

export const getConferenceBookings = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return apiFetch(params ? `/api/conference/bookings?${params}` : "/api/conference/bookings");
};

export const createConferenceBooking = async (bookingData) =>
  apiFetch("/api/conference/bookings", { method: "POST", body: JSON.stringify(bookingData) });

export const updateConferenceBooking = async (id, bookingData) =>
  apiFetch(`/api/conference/bookings/${id}`, { method: "PATCH", body: JSON.stringify(bookingData) });

export const cancelConferenceBooking = async (id) =>
  apiFetch(`/api/conference/bookings/${id}/cancel`, { method: "PATCH" });

export const getDashboardStats = async () => apiFetch("/api/conference/dashboard");
export const getPlanUsage = async () => apiFetch("/api/conference/plan-usage");
export const syncRooms = async () => apiFetch("/api/conference/sync-rooms", { method: "POST" });
