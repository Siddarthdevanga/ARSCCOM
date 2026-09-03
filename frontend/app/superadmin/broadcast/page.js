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

const normalizePhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? `91${digits}` : digits;
};

export default function Broadcast() {
  const router = useRouter();
  const [token, setToken] = useState("");

  const [plans, setPlans] = useState(PLAN_OPTIONS.map(p => p.value)); // all checked by default = "send to all"

  // Plan-derived recipients (fetched fresh whenever `plans` changes) and
  // which of them the admin has removed from this send.
  const [planRecipients, setPlanRecipients] = useState([]);
  const [removedPhones,  setRemovedPhones]  = useState(new Set());
  const [loadingList,    setLoadingList]    = useState(false);

  // Manually-added numbers, independent of the plan filter — persist
  // across plan changes since they're not derived from it.
  const [customRecipients, setCustomRecipients] = useState([]); // [{name, phone}]
  const [customName,  setCustomName]  = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customError, setCustomError] = useState("");

  const [message,  setMessage]  = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending,     setSending]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState("");

  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  // Refetch the plan-derived list whenever the plan selection changes.
  // This resets any per-row removals for THIS list — changing which
  // plans you're targeting is a big enough change that starting the
  // review list fresh is the least surprising behavior. Custom numbers
  // are untouched, since they don't come from this fetch at all.
  useEffect(() => {
    if (!token) return;
    if (plans.length === 0) { setPlanRecipients([]); setRemovedPhones(new Set()); return; }
    let cancelled = false;
    setLoadingList(true);
    fetch(`${API}/api/superadmin/broadcast-recipients?plans=${plans.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setPlanRecipients(data.success ? data.recipients : []);
        setRemovedPhones(new Set());
      })
      .catch(() => { if (!cancelled) setPlanRecipients([]); })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [token, plans]);

  const togglePlan = (value) => {
    setPlans(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]);
  };
  const selectAllPlans = () => setPlans(PLAN_OPTIONS.map(p => p.value));
  const clearAllPlans  = () => setPlans([]);

  const removePlanRecipient = (phone) => {
    setRemovedPhones(prev => new Set(prev).add(phone));
  };

  const addCustomRecipient = () => {
    setCustomError("");
    const phone = normalizePhone(customPhone);
    if (!phone) { setCustomError("Enter a valid phone number (at least 10 digits)"); return; }
    if (customRecipients.some(r => r.phone === phone) || activePlanRecipients.some(r => r.phone === phone)) {
      setCustomError("This number is already in the list");
      return;
    }
    setCustomRecipients(prev => [...prev, { name: customName.trim() || "there", phone }]);
    setCustomName("");
    setCustomPhone("");
  };

  const removeCustomRecipient = (phone) => {
    setCustomRecipients(prev => prev.filter(r => r.phone !== phone));
  };

  const activePlanRecipients = planRecipients.filter(r => !removedPhones.has(r.phone));
  const finalRecipients = [...activePlanRecipients, ...customRecipients];

  const handleSend = async () => {
    setError("");
    setResult(null);
    setShowConfirm(false);

    setSending(true);
    try {
      const res  = await fetch(`${API}/api/superadmin/send-broadcast`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ recipients: finalRecipients, message: message.trim() }),
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

  const canSend = finalRecipients.length > 0 && message.trim().length > 0 && !sending;

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
          Send a WhatsApp announcement to your real customers, targeted by plan or by specific number — via an
          approved template, so it reaches everyone regardless of whether they've messaged the bot recently.
        </p>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Plan targeting */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                Send To (by plan)
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={selectAllPlans} style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "none", border: "none", cursor: "pointer" }}>Select All</button>
                <button onClick={clearAllPlans}  style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
            </div>
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
          </div>

          {/* Add a custom number */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Add a Custom Number <span style={{ color: "#9ca3af", fontWeight: 500 }}>(optional, in addition to the plans above)</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Name (optional)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none" }}
              />
              <input
                type="text"
                placeholder="917406208011"
                value={customPhone}
                onChange={e => setCustomPhone(e.target.value)}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", fontFamily: "monospace" }}
              />
              <button
                onClick={addCustomRecipient}
                style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                + Add
              </button>
            </div>
            {customError && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{customError}</p>}
          </div>

          {/* Recipient list — editable, shows exactly who gets this */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Recipients ({finalRecipients.length}) {loadingList && "— loading…"}
            </label>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1.5px solid #e5e7eb", borderRadius: 8 }}>
              {finalRecipients.length === 0 && !loadingList && (
                <p style={{ fontSize: 12, color: "#9ca3af", padding: "14px", margin: 0, textAlign: "center" }}>
                  No recipients yet — select a plan above or add a custom number.
                </p>
              )}
              {activePlanRecipients.map(r => (
                <div key={r.phone} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a0038" }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8, fontFamily: "monospace" }}>{r.phone}</span>
                  </div>
                  <button
                    onClick={() => removePlanRecipient(r.phone)}
                    title="Remove from this send"
                    style={{ background: "none", border: "none", color: "#dc2626", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {customRecipients.map(r => (
                <div key={r.phone} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f3f4f6", background: "rgba(124,58,237,0.04)" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a0038" }}>{r.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginLeft: 8 }}>CUSTOM</span>
                    <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8, fontFamily: "monospace" }}>{r.phone}</span>
                  </div>
                  <button
                    onClick={() => removeCustomRecipient(r.phone)}
                    title="Remove from this send"
                    style={{ background: "none", border: "none", color: "#dc2626", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
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
              Each recipient automatically gets "Hi [Name], 👋" before this, and a Hai Visitor thank-you footer after — just write the middle part.
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
              Send to {finalRecipients.length} recipient{finalRecipients.length === 1 ? "" : "s"}?
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.5 }}>
              This sends a real WhatsApp message to everyone currently in the recipient list. This can't be undone once sent.
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
