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

/**
 * Download QR code as file
 * Special handler for binary file downloads
 */
export const downloadQRCode = async (companyName = "company") => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  if (!token) {
    throw new Error("Authentication required");
  }

  try {
    const res = await fetch(`${API}/api/conference/qr-code/download`, {
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
      let message = "Failed to download QR code";
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
    a.download = `${companyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-booking-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("QR Code download error:", error);
    throw error;
  }
};

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
 * Fetch public booking info with QR code
 * Returns { publicUrl, slug, qrCode }
 */
export const fetchPublicBookingInfo = async () => {
  return apiFetch("/api/conference/public-booking-info");
};
