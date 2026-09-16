"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ListChecks, QrCode as QrCodeIcon, Smartphone, BarChart3 } from "lucide-react";
import styles from "../../visitor/primary_details/style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const MAX_ACTIVE_FORMS = 2;

const HOW_IT_WORKS = [
  { icon: ListChecks,  title: "Create a form",       desc: "Pick up to 5 fields and a theme" },
  { icon: QrCodeIcon,  title: "Download the QR code", desc: "Print it or display it anywhere" },
  { icon: Smartphone,  title: "People scan & submit", desc: "No login needed — takes seconds" },
  { icon: BarChart3,   title: "View & export",        desc: "See every response in one place" },
];

export default function SmartFormsDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retiringId, setRetiringId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/login"); return; }
  }, [router]);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/smart-forms`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load Smart Forms");
      setForms(data.forms || []);
    } catch (err) {
      setError(err.message || "Failed to load Smart Forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (company) fetchForms(); }, [company, fetchForms]);

  const activeCount = forms.filter((f) => f.status === "active").length;

  const handleRetire = async (id, name) => {
    if (!confirm(`Retire "${name}"? Its collected responses stay available, but the QR code stops accepting new submissions.`)) return;
    setRetiringId(id);
    try {
      const res = await fetch(`${API}/api/smart-forms/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to retire form");
      fetchForms();
    } catch (err) {
      setError(err.message || "Failed to retire form");
    } finally {
      setRetiringId(null);
    }
  };

  const handleDownloadQr = async (form) => {
    setDownloadingId(form.id);
    try {
      const url = `${window.location.origin}/smart-forms/${form.slug}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 500, margin: 2, color: { dark: "#1a0038", light: "#ffffff" } });

      const canvas = document.createElement("canvas");
      canvas.width = 720; canvas.height = 900;
      const ctx = canvas.getContext("2d");

      const gradient = ctx.createLinearGradient(0, 0, 720, 0);
      gradient.addColorStop(0, "#6200d6"); gradient.addColorStop(1, "#a855f7");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 720, 140);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
      ctx.fillText(company?.name || "Smart Form", 360, 60);
      ctx.font = "16px Arial";
      ctx.fillText(form.name, 360, 95);

      const qrImg = await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.src = qrDataUrl; });
      ctx.drawImage(qrImg, 110, 190, 500, 500);

      ctx.fillStyle = "#1a0038";
      ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
      ctx.fillText("Scan to fill in your details", 360, 740);
      ctx.font = "14px Arial"; ctx.fillStyle = "#6b7280";
      ctx.fillText("No login required — takes less than a minute", 360, 770);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${form.name.replace(/[^a-z0-9]/gi, "-")}-qr.png`;
      a.click();
    } catch {
      setError("Failed to generate QR code");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!company) return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Home</button>
        </div>
      </header>

      <div className={styles.scrollBody}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a0038", margin: 0 }}>Smart Forms</h1>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
                QR-code based information collectors — {activeCount}/{MAX_ACTIVE_FORMS} active
              </p>
            </div>
            <button
              onClick={() => router.push("/smart-forms/dashboard/new")}
              disabled={activeCount >= MAX_ACTIVE_FORMS}
              style={{
                background: activeCount >= MAX_ACTIVE_FORMS ? "#e5e7eb" : "linear-gradient(135deg,#6200d6,#a855f7)",
                color: activeCount >= MAX_ACTIVE_FORMS ? "#9ca3af" : "#fff",
                border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                cursor: activeCount >= MAX_ACTIVE_FORMS ? "not-allowed" : "pointer",
              }}
              title={activeCount >= MAX_ACTIVE_FORMS ? "Retire an existing form first to free up a slot" : undefined}
            >
              + New Smart Form
            </button>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 13, marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Loading…</p>
          ) : forms.length === 0 ? (
            <div style={{ padding: "1rem 0 2rem" }}>
              <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, margin: "0 0 1.75rem" }}>
                A Smart Form turns any QR code into a quick way to collect information — no app, no login, just a scan.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1.25rem" }}>
                {HOW_IT_WORKS.map((step, i) => (
                  <div key={step.title} style={{
                    display: "flex", alignItems: "flex-start", gap: 10, width: 220,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: "linear-gradient(135deg,#6200d6,#a855f7)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <step.icon size={14} color="#6200d6" />
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: "#1a0038" }}>{step.title}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#6b7280", lineHeight: 1.4 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {forms.map((f) => (
                <div key={f.id} style={{
                  border: "1px solid #e5e7eb", borderRadius: 14, padding: "1rem 1.25rem",
                  background: f.status === "active" ? "#fff" : "#fafafa",
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem",
                }}>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, color: "#1a0038", fontSize: 15 }}>{f.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase",
                        background: f.status === "active" ? "rgba(0,184,148,0.12)" : "rgba(107,114,128,0.12)",
                        color: f.status === "active" ? "#00875a" : "#6b7280",
                      }}>
                        {f.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>
                      {f.response_count} response{f.response_count !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {f.status === "active" && (
                      <button onClick={() => handleDownloadQr(f)} disabled={downloadingId === f.id} style={pillBtnStyle()}>
                        {downloadingId === f.id ? "Generating…" : "⬇ QR Code"}
                      </button>
                    )}
                    <button onClick={() => router.push(`/smart-forms/dashboard/${f.id}/responses`)} style={pillBtnStyle()}>
                      Responses
                    </button>
                    {f.status === "active" && (
                      <>
                        <button onClick={() => router.push(`/smart-forms/dashboard/${f.id}/edit`)} style={pillBtnStyle()}>
                          Edit
                        </button>
                        <button onClick={() => handleRetire(f.id, f.name)} disabled={retiringId === f.id}
                          style={pillBtnStyle("#fef2f2", "#b91c1c")}>
                          {retiringId === f.id ? "Retiring…" : "Retire"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pillBtnStyle = (bg = "#f4eeff", color = "#6200d6") => ({
  background: bg, color, border: "none", padding: "7px 14px", borderRadius: 20,
  fontWeight: 700, fontSize: 12.5, cursor: "pointer",
});
