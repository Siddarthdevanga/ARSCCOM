const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ===============================================
   CORE API FETCH HELPER
=============================================== */

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

/* ===============================================
   FILE DOWNLOAD HELPER
=============================================== */

/**
 * Generic file download helper
 * Handles binary file downloads (Excel, PDF, PNG, etc.)
 */
const downloadFile = async (endpoint, filename, errorMessage = "Failed to download file") => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  if (!token) {
    throw new Error("Authentication required");
  }

  try {
    const res = await fetch(`${API}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include"
    });

    if (res.status === 401) {
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

    // Get the blob from response
    const blob = await res.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Download error:", error);
    throw error;
  }
};

/* ===============================================
   QR CODE FUNCTIONS
=============================================== */

/**
 * Fetch public booking info with QR code
 * Returns { publicUrl, slug, qrCode, companyName }
 */
export const fetchPublicBookingInfo = async () => {
  return apiFetch("/api/conference/public-booking-info");
};

/**
 * Download QR code as PNG file (Branded)
 * Special handler for branded QR code downloads
 */
export const downloadQRCode = async (companyName = "company") => {
  const safeFilename = `${companyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-conference-qr-${Date.now()}.png`;
  return downloadFile(
    "/api/conference/qr-code/download",
    safeFilename,
    "Failed to download QR code"
  );
};

/* ===============================================
   EXCEL EXPORT FUNCTIONS
=============================================== */

/**
 * Download visitors Excel file
 * Returns Excel file with visitor records
 */
export const downloadVisitorsExcel = async () => {
  const filename = `visitors-${Date.now()}.xlsx`;
  return downloadFile(
    "/api/exports/visitors",
    filename,
    "Failed to download visitors data"
  );
};

/**
 * Download conference bookings Excel file
 * Returns Excel file with booking records
 */
export const downloadBookingsExcel = async () => {
  const filename = `bookings-${Date.now()}.xlsx`;
  return downloadFile(
    "/api/exports/conference-bookings",
    filename,
    "Failed to download bookings data"
  );
};

/**
 * Download complete report (visitors + bookings in one Excel file)
 * Returns Excel file with two sheets
 */
export const downloadCompleteReport = async () => {
  const filename = `complete-report-${Date.now()}.xlsx`;
  return downloadFile(
    "/api/exports/all",
    filename,
    "Failed to download complete report"
  );
};

/**
 * Get export statistics
 * Returns { visitors: { total, active }, bookings: { total, upcoming } }
 */
export const getExportStats = async () => {
  return apiFetch("/api/exports/stats");
};

/* ===============================================
   SHARE FUNCTIONS
=============================================== */

/**
 * Share URL helper
 * Uses Web Share API if available, falls back to clipboard
 */
export const shareURL = async (url, title = "Conference Room Booking") => {
  if (!url) {
    throw new Error("URL is required");
  }

  // Check if Web Share API is available
  if (typeof window !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: "Book a conference room",
        url: url,
      });
      return { success: true, method: "share" };
    } catch (err) {
      // User cancelled or share failed
      if (err.name === "AbortError") {
        return { success: false, method: "share", cancelled: true };
      }
      // Fall through to clipboard
    }
  }

  // Fallback to clipboard
  if (typeof window !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return { success: true, method: "clipboard" };
    } catch (err) {
      // Clipboard API failed, use fallback
    }
  }

  // Final fallback: manual text selection
  if (typeof window !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      
      if (successful) {
        return { success: true, method: "fallback" };
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }
  }

  throw new Error("Unable to share or copy URL");
};

/**
 * Copy text to clipboard
 * Simplified clipboard copy function
 */
export const copyToClipboard = async (text) => {
  if (!text) {
    throw new Error("Text is required");
  }

  // Try modern clipboard API first
  if (typeof window !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: "clipboard" };
    } catch (err) {
      // Fall through to fallback
    }
  }

  // Fallback method
  if (typeof window !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      
      if (successful) {
        return { success: true, method: "fallback" };
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }
  }

  throw new Error("Unable to copy to clipboard");
};

/* ===============================================
   UTILITY FUNCTIONS
=============================================== */

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("token");
  return !!token;
};

/**
 * Get stored company info
 */
export const getStoredCompany = () => {
  if (typeof window === "undefined") return null;
  try {
    const company = localStorage.getItem("company");
    return company ? JSON.parse(company) : null;
  } catch (err) {
    console.error("Failed to parse stored company:", err);
    return null;
  }
};

/**
 * Clear authentication data
 */
export const clearAuthData = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("company");
};

/* ===============================================
   VISITOR FUNCTIONS
=============================================== */

/**
 * Get all visitors
 */
export const getVisitors = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/api/visitors?${params}` : "/api/visitors";
  return apiFetch(url);
};

/**
 * Create visitor
 */
export const createVisitor = async (visitorData) => {
  return apiFetch("/api/visitors", {
    method: "POST",
    body: JSON.stringify(visitorData),
  });
};

/**
 * Update visitor
 */
export const updateVisitor = async (id, visitorData) => {
  return apiFetch(`/api/visitors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(visitorData),
  });
};

/**
 * Check out visitor
 */
export const checkoutVisitor = async (id) => {
  return apiFetch(`/api/visitors/${id}/checkout`, {
    method: "PATCH",
  });
};

/* ===============================================
   CONFERENCE FUNCTIONS
=============================================== */

/**
 * Get all conference rooms
 */
export const getConferenceRooms = async () => {
  return apiFetch("/api/conference/rooms");
};

/**
 * Get all conference rooms (including inactive)
 */
export const getAllConferenceRooms = async () => {
  return apiFetch("/api/conference/rooms/all");
};

/**
 * Create conference room
 */
export const createConferenceRoom = async (roomData) => {
  return apiFetch("/api/conference/rooms", {
    method: "POST",
    body: JSON.stringify(roomData),
  });
};

/**
 * Update conference room
 */
export const updateConferenceRoom = async (id, roomData) => {
  return apiFetch(`/api/conference/rooms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(roomData),
  });
};

/**
 * Delete conference room
 */
export const deleteConferenceRoom = async (id) => {
  return apiFetch(`/api/conference/rooms/${id}`, {
    method: "DELETE",
  });
};

/**
 * Get conference bookings
 */
export const getConferenceBookings = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `/api/conference/bookings?${params}` : "/api/conference/bookings";
  return apiFetch(url);
};

/**
 * Create conference booking
 */
export const createConferenceBooking = async (bookingData) => {
  return apiFetch("/api/conference/bookings", {
    method: "POST",
    body: JSON.stringify(bookingData),
  });
};

/**
 * Update conference booking
 */
export const updateConferenceBooking = async (id, bookingData) => {
  return apiFetch(`/api/conference/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(bookingData),
  });
};

/**
 * Cancel conference booking
 */
export const cancelConferenceBooking = async (id) => {
  return apiFetch(`/api/conference/bookings/${id}/cancel`, {
    method: "PATCH",
  });
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async () => {
  return apiFetch("/api/conference/dashboard");
};

/**
 * Get plan usage information
 */
export const getPlanUsage = async () => {
  return apiFetch("/api/conference/plan-usage");
};

/**
 * Sync room activation
 */
export const syncRooms = async () => {
  return apiFetch("/api/conference/sync-rooms", {
    method: "POST",
  });
};

/* ===============================================
   EXPORTS (SUMMARY)
=============================================== */

// Core API functions
export {
  apiFetch,
  isAuthenticated,
  getStoredCompany,
  clearAuthData,
};

// QR Code functions
export {
  fetchPublicBookingInfo,
  downloadQRCode,
};

// Excel Export functions
export {
  downloadVisitorsExcel,
  downloadBookingsExcel,
  downloadCompleteReport,
  getExportStats,
};

// Share functions
export {
  shareURL,
  copyToClipboard,
};

// Visitor functions
export {
  getVisitors,
  createVisitor,
  updateVisitor,
  checkoutVisitor,
};

// Conference functions
export {
  getConferenceRooms,
  getAllConferenceRooms,
  createConferenceRoom,
  updateConferenceRoom,
  deleteConferenceRoom,
  getConferenceBookings,
  createConferenceBooking,
  updateConferenceBooking,
  cancelConferenceBooking,
  getDashboardStats,
  getPlanUsage,
  syncRooms,
};
