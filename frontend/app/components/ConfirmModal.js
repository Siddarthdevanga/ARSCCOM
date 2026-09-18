"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

// A single in-app confirmation modal used everywhere the app needs "are you
// sure?" — deliberately not window.confirm(), which renders as a plain
// browser-native dialog prefixed with the page's hostname rather than
// something styled as part of the app. Mirrors the visual spec already
// established on the Account Settings page's code-prefix confirm.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  variant = "default", // "default" (purple) | "danger" (red, with warning icon)
}) {
  if (!open) return null;
  const danger = variant === "danger";
  const accent = danger ? "#dc2626" : "#6200d6";

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(26,0,56,0.55)",
        backdropFilter: "blur(2px)", display: "flex", alignItems: "center",
        // Above the highest z-index used anywhere else in the app (10000,
        // toast notifications) — this can be nested inside an existing
        // modal (e.g. SuperAdmin's CompanyModal, itself z-index 1000), so
        // it must never risk tying/losing a stacking-order contest.
        justifyContent: "center", zIndex: 20000, padding: 16,
      }}
      onClick={loading ? undefined : onCancel}
      role="presentation"
    >
      <style>{"@keyframes confirmModalSpin{to{transform:rotate(360deg)}}"}</style>
      <div
        style={{
          background: "#fff", borderRadius: 18, padding: 24, maxWidth: 400,
          width: "100%", boxShadow: "0 20px 60px rgba(26,0,56,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {danger && (
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: "rgba(220,38,38,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <AlertTriangle size={20} color="#dc2626" />
          </div>
        )}
        <h3 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 17, fontWeight: 800, color: "#1a0038", margin: "0 0 10px" }}>
          {title}
        </h3>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13.5, lineHeight: 1.6, color: "#5a4a70", margin: "0 0 20px" }}>
          {message}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, borderRadius: 10,
              padding: "10px 18px", cursor: loading ? "not-allowed" : "pointer", border: "none",
              background: danger ? "rgba(220,38,38,0.08)" : "rgba(98,0,214,0.08)",
              color: accent, opacity: loading ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, borderRadius: 10,
              padding: "10px 18px", cursor: loading ? "not-allowed" : "pointer", border: "none",
              background: accent, color: "#fff",
              boxShadow: `0 3px 12px ${danger ? "rgba(220,38,38,0.3)" : "rgba(98,0,214,0.3)"}`,
              display: "inline-flex", alignItems: "center", gap: 6, opacity: loading ? 0.5 : 1,
            }}
          >
            {loading && <Loader2 size={13} style={{ animation: "confirmModalSpin 0.8s linear infinite" }} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
