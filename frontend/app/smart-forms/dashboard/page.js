"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ListChecks, QrCode as QrCodeIcon, Smartphone, BarChart3, Copy, Check, ChevronDown } from "lucide-react";
import styles from "../../visitor/primary_details/style.module.css";
import ConfirmModal from "../../components/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const MAX_ACTIVE_FORMS = 2;

// Kept in sync with BuilderForm.js's THEMES — a company picks one of these
// per form, and both the public scan page and this QR card use it.
const THEMES = {
  purple: { label: "Classic Purple", accent: "#6200d6", bg: "#f6f1fd" },
  blue:   { label: "Ocean Blue",     accent: "#0369a1", bg: "#f0f9ff" },
  green:  { label: "Emerald Green",  accent: "#047857", bg: "#f0fdf6" },
  slate:  { label: "Slate Neutral",  accent: "#334155", bg: "#f8fafc" },
  amber:  { label: "Warm Amber",     accent: "#b45309", bg: "#fffbeb" },
};

const HOW_IT_WORKS = [
  { icon: ListChecks,  title: "Create a form",       desc: "Pick up to 5 fields and a theme" },
  { icon: QrCodeIcon,  title: "Download the QR code", desc: "Print it or display it anywhere" },
  { icon: Smartphone,  title: "People scan & submit", desc: "No login needed — takes seconds" },
  { icon: BarChart3,   title: "View & export",        desc: "See every response in one place" },
];

/* ── Color helpers — shade the chosen theme's accent instead of a
   hardcoded purple, so the generated card actually reflects the form's
   own theme. ── */
const shadeHex = (hex, percent) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/* ── The card — light top (logo + highlighted company name), dark
   theme-colored bottom (form name — big and highlighted — optional
   subtext, QR code, caption, small Hai Visitor footer). Used for both
   the inline preview and the downloaded PNG, so they always match. ── */
const generateQrCard = async (form, company) => {
  const theme = THEMES[form.theme] || THEMES.purple;
  const dark = shadeHex(theme.accent, -35);
  const publicUrl = `${window.location.origin}/smart-forms/${form.slug}`;
  const companyName = company?.name || "";

  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 940;
  const ctx = canvas.getContext("2d");

  // Top — light section: logo + highlighted company name below it
  const topHeight = 220;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 640, topHeight);
  ctx.textAlign = "center";

  const logoUrl = form.hasLogoOverride
    ? `${API}/api/public/smart-forms/${form.slug}/logo`
    : (company?.id ? `${API}/api/logo/${company.id}` : null);

  const logoBoxSize = 96;
  const logoCenterY = 88;
  let logoDrawn = false;
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      // Guard against a broken/zero-dimension image (e.g. a malformed
      // SVG with no intrinsic size) drawing as huge or not at all —
      // "contain" sizing here, never cropped, so the whole logo shows.
      if (logoImg.width > 0 && logoImg.height > 0) {
        const ratio = Math.min(logoBoxSize / logoImg.width, logoBoxSize / logoImg.height);
        const w = logoImg.width * ratio, h = logoImg.height * ratio;
        ctx.drawImage(logoImg, 320 - w / 2, logoCenterY - h / 2, w, h);
        logoDrawn = true;
      }
    } catch { /* no logo available — falls through to the placeholder below */ }
  }
  if (!logoDrawn) {
    const initial = (form.displayNameOverride || companyName || form.name || "?").trim().charAt(0).toUpperCase();
    roundRect(ctx, 320 - 40, logoCenterY - 40, 80, 80, 18);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = "bold 36px Arial";
    ctx.fillText(initial, 320, logoCenterY + 13);
  }

  // Highlighted company name, below the logo — shrink-to-fit like the
  // title/subtext so a long company name never overflows the card.
  if (companyName) {
    ctx.fillStyle = theme.accent;
    const maxNameWidth = 560;
    let nameSize = 16;
    ctx.font = `bold ${nameSize}px Arial`;
    while (nameSize > 11 && ctx.measureText(companyName).width > maxNameWidth) {
      nameSize -= 1;
      ctx.font = `bold ${nameSize}px Arial`;
    }
    ctx.fillText(companyName, 320, 188, maxNameWidth);
  }

  // Bottom — dark, theme-colored section
  const gradient = ctx.createLinearGradient(0, topHeight, 640, 940);
  gradient.addColorStop(0, theme.accent);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, topHeight, 640, 940 - topHeight);

  // Form name — the big, highlighted title. Shrink the font until it
  // fits the card width so a long name never silently overflows/clips
  // off the edges.
  ctx.fillStyle = "#ffffff";
  const titleText = form.displayNameOverride || form.name;
  const maxTitleWidth = 560;
  let titleSize = 34;
  ctx.font = `bold ${titleSize}px Arial`;
  while (titleSize > 18 && ctx.measureText(titleText).width > maxTitleWidth) {
    titleSize -= 1;
    ctx.font = `bold ${titleSize}px Arial`;
  }
  const titleY = topHeight + 60;
  ctx.fillText(titleText, 320, titleY, maxTitleWidth);

  // Subtext — only drawn when the form actually has one set, directly
  // below the title (matches the public page's optional-subtext rule).
  let qrTop = topHeight + 105;
  if (form.subtext) {
    ctx.font = "15px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const maxSubtextWidth = 520;
    let subtextSize = 15;
    ctx.font = `${subtextSize}px Arial`;
    while (subtextSize > 11 && ctx.measureText(form.subtext).width > maxSubtextWidth) {
      subtextSize -= 1;
      ctx.font = `${subtextSize}px Arial`;
    }
    ctx.fillText(form.subtext, 320, titleY + 34, maxSubtextWidth);
    qrTop += 24;
  }

  const qrDataUrl = await QRCode.toDataURL(publicUrl, { width: 420, margin: 1, color: { dark: "#1a0038", light: "#ffffff" } });
  const qrImg = await loadImage(qrDataUrl);
  roundRect(ctx, 120, qrTop, 400, 400, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.drawImage(qrImg, 140, qrTop + 20, 360, 360);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.fillText("Scan to fill in your details", 320, qrTop + 455);
  ctx.font = "13px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("No login required — takes less than a minute", 320, qrTop + 478);

  // Small, subtle Hai Visitor footer
  ctx.font = "11px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("Powered by Hai Visitor", 320, 905);

  return canvas.toDataURL("image/png");
};

export default function SmartFormsDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retiringId, setRetiringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: "retire"|"delete", id, name }
  const [qrOpenId, setQrOpenId] = useState(null);
  const [qrLoadingIds, setQrLoadingIds] = useState({}); // formId -> true while generating
  const [qrImages, setQrImages] = useState({}); // formId -> data URL
  const [copiedId, setCopiedId] = useState(null);

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

  const requestRetire = (id, name) => setConfirmAction({ type: "retire", id, name });
  const requestDelete = (id, name) => setConfirmAction({ type: "delete", id, name });
  const cancelConfirmAction = () => setConfirmAction(null);

  const handleRetire = async () => {
    const { id } = confirmAction;
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
      setConfirmAction(null);
    }
  };

  const handleDelete = async () => {
    // Only ever offered on an already-retired form — this just removes it
    // from this list. Every response it ever collected stays intact and
    // still shows up in the Reports & Analytics export, tagged "(Retired)".
    const { id } = confirmAction;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/api/smart-forms/${id}/permanent`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete form");
      fetchForms();
    } catch (err) {
      setError(err.message || "Failed to delete form");
    } finally {
      setDeletingId(null);
      setConfirmAction(null);
    }
  };

  const handleToggleQr = async (form) => {
    if (qrOpenId === form.id) { setQrOpenId(null); return; }
    setQrOpenId(form.id);
    // Already generated, or already generating (rapid re-toggle/switching
    // between forms before the first request finished) — never start a
    // second overlapping generation for the same form, since whichever
    // one's `finally` ran first would otherwise clear the loading flag
    // while the other was still in flight.
    if (qrImages[form.id] || qrLoadingIds[form.id]) return;
    setQrLoadingIds((prev) => ({ ...prev, [form.id]: true }));
    try {
      const dataUrl = await generateQrCard(form, company);
      setQrImages((prev) => ({ ...prev, [form.id]: dataUrl }));
    } catch {
      setError("Failed to generate QR code");
      setQrOpenId(null);
    } finally {
      setQrLoadingIds((prev) => { const next = { ...prev }; delete next[form.id]; return next; });
    }
  };

  const handleDownload = (form) => {
    const dataUrl = qrImages[form.id];
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${form.name.replace(/[^a-z0-9]/gi, "-")}-qr.png`;
    a.click();
  };

  const handleCopyLink = async (form) => {
    const url = `${window.location.origin}/smart-forms/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard unavailable — silently ignore */ }
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
                boxShadow: activeCount >= MAX_ACTIVE_FORMS ? "none" : "0 6px 16px rgba(98,0,214,0.28)",
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
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {forms.map((f) => {
                const theme = THEMES[f.theme] || THEMES.purple;
                return (
                <div key={f.id} style={{
                  border: "1px solid #ece4fb", borderRadius: 16, overflow: "hidden",
                  background: f.status === "active" ? "#fff" : "#fafafa",
                  boxShadow: "0 4px 16px rgba(98,0,214,0.06)",
                }}>
                  <div style={{ padding: "1.1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 180 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                        background: `linear-gradient(135deg, ${theme.accent}, ${shadeHex(theme.accent, 25)})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontWeight: 800, fontSize: 15,
                        boxShadow: `0 4px 12px ${theme.accent}33`,
                      }}>
                        {f.name.trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
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
                        <p style={{ fontSize: 12.5, color: "#6b7280", margin: "2px 0 0" }}>
                          {f.response_count} response{f.response_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {f.status === "active" && (
                        <button onClick={() => handleToggleQr(f)} style={pillBtnStyle()}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            QR Code
                            <ChevronDown size={13} style={{ transform: qrOpenId === f.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                          </span>
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
                          <button onClick={() => requestRetire(f.id, f.name)} disabled={retiringId === f.id}
                            style={pillBtnStyle("#fef2f2", "#b91c1c")}>
                            {retiringId === f.id ? "Retiring…" : "Retire"}
                          </button>
                        </>
                      )}
                      {f.status === "retired" && (
                        <button onClick={() => requestDelete(f.id, f.name)} disabled={deletingId === f.id}
                          style={pillBtnStyle("#fef2f2", "#b91c1c")}>
                          {deletingId === f.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>

                  {qrOpenId === f.id && (
                    <div style={{ borderTop: "1px solid #ece4fb", padding: "1.5rem", background: theme.bg, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {qrLoadingIds[f.id] ? (
                        <p style={{ color: "#9ca3af", fontSize: 13, padding: "2rem 0" }}>Generating…</p>
                      ) : qrImages[f.id] ? (
                        <>
                          <img src={qrImages[f.id]} alt={`${f.name} QR code`} style={{ width: "100%", maxWidth: 320, borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} />
                          <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.1rem" }}>
                            <button onClick={() => handleDownload(f)} style={actionBtnStyle(theme.accent)}>
                              ⬇ Download PNG
                            </button>
                            <button onClick={() => handleCopyLink(f)} style={actionBtnStyle(theme.accent, true)}>
                              {copiedId === f.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Link</>}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmAction}
        variant={confirmAction?.type === "delete" ? "danger" : "default"}
        title={confirmAction?.type === "delete" ? `Delete "${confirmAction?.name}"?` : `Retire "${confirmAction?.name}"?`}
        message={
          confirmAction?.type === "delete"
            ? "It will disappear from this list, but its collected responses are kept and still appear in Reports & Analytics."
            : "Its collected responses stay available, but the QR code stops accepting new submissions."
        }
        confirmLabel={confirmAction?.type === "delete" ? "Delete" : "Retire"}
        loading={confirmAction?.type === "delete" ? deletingId === confirmAction?.id : retiringId === confirmAction?.id}
        onConfirm={confirmAction?.type === "delete" ? handleDelete : handleRetire}
        onCancel={cancelConfirmAction}
      />
    </div>
  );
}

const pillBtnStyle = (bg = "#f4eeff", color = "#6200d6") => ({
  background: bg, color, border: "none", padding: "7px 14px", borderRadius: 20,
  fontWeight: 700, fontSize: 12.5, cursor: "pointer",
});

const actionBtnStyle = (accent, outline = false) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  background: outline ? "#fff" : accent,
  color: outline ? accent : "#fff",
  border: outline ? `1.5px solid ${accent}` : "none",
  padding: "9px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
});
