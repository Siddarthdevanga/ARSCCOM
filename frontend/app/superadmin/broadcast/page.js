"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const PLAN_OPTIONS = [
  { value: "trial",      label: "Trial" },
  { value: "business",   label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

export default function Broadcast() {
  const router = useRouter();
  const [token, setToken] = useState("");

  const [plans, setPlans] = useState(PLAN_OPTIONS.map(p => p.value)); // all checked by default
  const [message,  setMessage]  = useState("");

  const [recipientCount, setRecipientCount] = useState(null);
  const [countLoading,   setCountLoading]   = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [sending,     setSending]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState("");

  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  // Recipient count preview — refetches whenever the plan selection changes,
  // so the admin knows how many real people they're about to message before
  // committing to Send.
  useEffect(() => {
    if (!token || plans.length === 0) { setRecipientCount(0); return; }
    let cancelled = false;
    setCountLoading(true);
    fetch(`${API}/api/superadmin/broadcast-recipient-count?plans=${plans.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => { if (!cancelled) setRecipientCount(data.success ? data.count : null); })
      .catch(() => { if (!cancelled) setRecipientCount(null); })
      .finally(() => { if (!cancelled) setCountLoading(false); });
    return () => { cancelled = true; };
  }, [token, plans]);

  const togglePlan = (value) => {
    setPlans(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]);
  };

  const handleSend = async () => {
    setError("");
    setResult(null);
    setShowConfirm(false);

    setSending(true);
    try {
      const res  = await fetch(`${API}/api/superadmin/send-broadcast`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plans, message: message.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResult(data);
    } catch (e) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const canSend = plans.length > 0 && message.trim().length > 0 && !sending;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#7c3aed" }}>Hai Visitor</span>
          <span className={styles.superBadge}>SUPERADMIN</span>
        </div>
        <div className={styles.headerRight}>
          <a href="/superadmin/dashboard"     className={styles.logoutBtn} style={{ textDecoration: "none", marginRight: 8 }}>← Dashboard</a>
          <a href="/superadmin/whatsapp-leads" className={styles.logoutBtn} style={{ textDecoration: "none", marginRight: 8 }}>WhatsApp Leads</a>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: "2rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a0038", marginBottom: 4 }}>WhatsApp Broadcast</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
          Send a WhatsApp announcement to your real customers, targeted by plan — via an approved template, so it
          reaches everyone regardless of whether they've messaged the bot recently.
        </p>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Plan targeting */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
              Send To <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PLAN_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => togglePlan(value)}
                  style={{
                    padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: plans.includes(value) ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
                    background: plans.includes(value) ? "rgba(124,58,237,0.08)" : "#fff",
                    color: plans.includes(value) ? "#7c3aed" : "#6b7280",
                  }}
                >
                  {label} Plan
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, marginTop: 8 }}>
              {countLoading ? "Counting recipients…" : recipientCount === null ? "" : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"} will receive this`}
            </p>
          </div>

          {/* Message */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Message <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              placeholder="Type your announcement here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Each company automatically gets "Hi [Company Name], 👋" before this, and a Hai Visitor thank-you footer after — just write the middle part.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#00a875", marginBottom: 8 }}>
                {result.message}
              </div>
              {result.results?.failed?.length > 0 && (
                <div style={{ fontSize: 12, color: "#dc2626" }}>
                  <span style={{ fontWeight: 700 }}>Failed:</span>{" "}
                  {result.results.failed.map(f => `${f.company} (${f.phone})`).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canSend}
            style={{
              background: canSend ? "#7c3aed" : "#c4b5fd",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 24px", fontSize: 14, fontWeight: 700,
              cursor: canSend ? "pointer" : "not-allowed",
              alignSelf: "flex-start",
            }}
          >
            {sending ? "Sending..." : "Send Broadcast"}
          </button>
        </div>
      </div>

      {/* Confirm modal — this messages real customers, not a test list */}
      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(23,12,43,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: "28px", maxWidth: 420, width: "100%" }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1a0038", margin: "0 0 10px" }}>
              Send to {recipientCount ?? "…"} recipient{recipientCount === 1 ? "" : "s"}?
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.5 }}>
              This sends a real WhatsApp message to every active user on the {plans.map(p => PLAN_OPTIONS.find(o => o.value === p)?.label).join(", ")} plan{plans.length > 1 ? "s" : ""}. This can't be undone once sent.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Yes, Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
