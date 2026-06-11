"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function VideoBroadcast() {
  const router  = useRouter();
  const [token,     setToken]     = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [videoUrl,  setVideoUrl]  = useState("");
  const [phones,    setPhones]    = useState("");
  const [message,   setMessage]   = useState("");
  const [sending,     setSending]     = useState(false);
  const [loadingLeads,setLoadingLeads] = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState("");

  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    if (!t) { router.replace("/auth/login"); return; }
    setToken(t);
  }, [router]);

  const loadLeads = async () => {
    setLoadingLeads(true);
    setError("");
    try {
      const res  = await fetch(`${API}/api/superadmin/whatsapp-leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const nums = data.leads.map(l => l.phone).join("\n");
      setPhones(nums);
    } catch (e) {
      setError(e.message || "Failed to load leads");
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleSend = async () => {
    setError("");
    setResult(null);

    if (!videoUrl.trim()) return setError("Video URL is required");
    if (!phones.trim())   return setError("At least one phone number is required");
    if (!message.trim())  return setError("Message body is required");

    setSending(true);
    try {
      const res  = await fetch(`${API}/api/superadmin/send-video-message`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ phones, videoUrl: videoUrl.trim(), message: message.trim(), mediaType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResult(data);
      if (data.results?.skipped?.length > 0)
        setError(`${data.results.skipped.length} number(s) skipped — not opted-in yet (must message the bot first)`);
    } catch (e) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#7c3aed" }}>Promeet</span>
          <span className={styles.superBadge}>SUPERADMIN</span>
        </div>
        <div className={styles.headerRight}>
          <a href="/superadmin/dashboard"     className={styles.logoutBtn} style={{ textDecoration: "none", marginRight: 8 }}>← Dashboard</a>
          <a href="/superadmin/whatsapp-leads" className={styles.logoutBtn} style={{ textDecoration: "none", marginRight: 8 }}>WhatsApp Leads</a>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: "2rem auto", padding: "0 1rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a0038", marginBottom: 4 }}>Media Broadcast</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
          Send a WhatsApp image or video message to one or multiple phone numbers.
        </p>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Media Type Toggle */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
              Media Type
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["image", "video"].map(type => (
                <button
                  key={type}
                  onClick={() => { setMediaType(type); setVideoUrl(""); }}
                  style={{
                    padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: mediaType === type ? "2px solid #7c3aed" : "1.5px solid #e5e7eb",
                    background: mediaType === type ? "rgba(124,58,237,0.08)" : "#fff",
                    color: mediaType === type ? "#7c3aed" : "#6b7280",
                  }}
                >
                  {type === "image" ? "🖼 Image" : "🎥 Video"}
                </button>
              ))}
            </div>
          </div>

          {/* Media URL */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              {mediaType === "image" ? "Image URL" : "Video URL"} <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="url"
              placeholder={mediaType === "image" ? "https://example.com/image.jpg" : "https://example.com/video.mp4"}
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              {mediaType === "image"
                ? "Must be a publicly accessible image URL (JPEG or PNG)"
                : "Must be a publicly accessible video URL (MP4)"}
            </p>
          </div>

          {/* Phone Numbers */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                Phone Numbers <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <button
                onClick={loadLeads}
                disabled={loadingLeads}
                style={{
                  fontSize: 12, fontWeight: 600, color: "#7c3aed",
                  background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.3)",
                  borderRadius: 6, padding: "4px 10px", cursor: loadingLeads ? "not-allowed" : "pointer",
                }}
              >
                {loadingLeads ? "Loading…" : "Load WhatsApp Leads"}
              </button>
            </div>
            <textarea
              placeholder={"917406208011\n919481560185\nor comma separated: 917406208011, 919481560185"}
              value={phones}
              onChange={e => setPhones(e.target.value)}
              rows={4}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none",
                resize: "vertical", boxSizing: "border-box", fontFamily: "monospace",
              }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              One per line or comma separated. Include country code (e.g. 91XXXXXXXXXX)
            </p>
          </div>

          {/* Message */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Message Body <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              placeholder="Type your custom message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
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
              {result.results?.sent?.length > 0 && (
                <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>Sent:</span> {result.results.sent.join(", ")}
                </div>
              )}
              {result.results?.failed?.length > 0 && (
                <div style={{ fontSize: 12, color: "#dc2626" }}>
                  <span style={{ fontWeight: 700 }}>Failed:</span>{" "}
                  {result.results.failed.map(f => `${f.phone}`).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: sending ? "#a78bfa" : "#7c3aed",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 24px", fontSize: 14, fontWeight: 700,
              cursor: sending ? "not-allowed" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {sending ? "Sending..." : `Send ${mediaType === "video" ? "Video" : "Image"} Message`}
          </button>
        </div>
      </div>
    </div>
  );
}
