"use client";
/* ============================================================================
   SUPERADMIN · QR CARDS
   Blank visiting cards printed in batches and handed out. Whoever scans one
   first claims it; when they later pay for a plan with the same email or
   phone, the card moves into their company.

   Lead details are never shown here, only counts: they belong to the card
   owner. Full superadmin only; the API refuses the read-only role too.
   ========================================================================== */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Printer, Download, RefreshCw, X, ExternalLink } from "lucide-react";
import styles from "../dashboard/style.module.css";
import SuperAdminNav from "../dashboard/NavHeader";
import { THEMES } from "../../home/cards/cardArt";
import ConfirmModal from "../../components/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;
const MAX_BATCH = 100;

const SECTIONS = [
  { key: "unclaimed", label: "Unclaimed" },
  { key: "claimed",   label: "Claimed" },
  { key: "converted", label: "Converted" },
  { key: "disabled",  label: "Disabled" },
];

const STATUS_STYLE = {
  unclaimed: { background: "#ededf0", color: "#4b4b52" },
  claimed:   { background: "rgba(0,98,214,0.1)", color: "#0062d6" },
  converted: { background: "rgba(0,184,148,0.12)", color: "#00875a" },
  disabled:  { background: "rgba(204,17,0,0.08)", color: "#cc1100" },
};

const EDIT_FIELDS = [
  ["name", "Name *"], ["phone", "Phone *"], ["email", "Email *"],
  ["job_title", "Job title"], ["company_name", "Company"], ["linkedin", "LinkedIn"],
  ["custom1_label", "Extra field 1 — label"], ["custom1_value", "Extra field 1 — value"],
  ["custom2_label", "Extra field 2 — label"], ["custom2_value", "Extra field 2 — value"],
];

const fmtDate = (d) => (!d ? "—" : new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
}));

const pill = (status) => (
  <span style={{ ...STATUS_STYLE[status], padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
    {status}
  </span>
);

const box = { background: "#fff", borderRadius: 16, border: "1px solid #ededf0", padding: "1.25rem 1.5rem", margin: "0 1.5rem 1.5rem" };
const h3 = { fontSize: 15, fontWeight: 800, color: "#08080c", margin: "0 0 4px" };
const sub = { fontSize: 12, color: "#9ca3af", margin: "0 0 14px" };
const smallBtn = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
  fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid #e5e7eb", background: "#fff", color: "#1d1d21",
};

/* Downloads a file the API only serves with the bearer token. */
async function downloadWithAuth(url, token, fallbackName) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Download failed");
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/* ─────────────── CARD MODAL ─────────────── */

function CardModal({ id, token, onClose, onChanged }) {
  const [card, setCard]   = useState(null);
  const [form, setForm]   = useState({});
  const [photo, setPhoto] = useState(null);
  const [logo, setLogo]   = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [removeLogo, setRemoveLogo]   = useState(false);
  const [company, setCompany] = useState("");
  const [busy, setBusy]   = useState("");
  const [msg, setMsg]     = useState(null);   // { ok, text }
  const [askReset, setAskReset] = useState(false);
  const [qr, setQr]       = useState(null);   // data URL of the card's QR

  const auth = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const res = await fetch(`${API}/api/superadmin/qr-cards/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: data?.message || "Could not load the card" }); return; }
    const c = data.card;
    setCard(c);
    setForm({
      ...Object.fromEntries(EDIT_FIELDS.map(([f]) => [f, c[f] || ""])),
      brief: c.brief || "", theme: c.theme || "ink",
      custom1_type: c.custom1_type || "text", custom2_type: c.custom2_type || "text",
    });
    setPhoto(null); setLogo(null); setRemovePhoto(false); setRemoveLogo(false);
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  // Same URL the printed card encodes, so this QR matches the physical one.
  // Black on white, as on the print: tinted codes fail on some scanners.
  const cardLink = card?.card_url;
  useEffect(() => {
    if (!cardLink) return;
    let live = true;
    QRCode.toDataURL(cardLink, {
      width: 1004, margin: 2, errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then((d) => { if (live) setQr(d); }).catch(() => { if (live) setQr(null); });
    return () => { live = false; };
  }, [cardLink]);

  const run = async (label, fn) => {
    setBusy(label); setMsg(null);
    try {
      const text = await fn();
      setMsg({ ok: true, text });
      onChanged();
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message || "Something went wrong" });
    } finally {
      setBusy("");
    }
  };

  const call = async (path, opts = {}) => {
    const res = await fetch(`${API}/api/superadmin/qr-cards/${id}${path}`, { ...opts, headers: { ...auth, ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Something went wrong");
    return data;
  };
  const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const save = () => run("save", async () => {
    const body = new FormData();
    for (const [k, v] of Object.entries(form)) body.append(k, v);
    if (photo) { body.append("photo", photo); body.append("photo_on_print", "1"); }
    else if (removePhoto) body.append("remove_photo", "1");
    if (logo) body.append("logo", logo);
    else if (removeLogo) body.append("remove_logo", "1");
    await call("", { method: "PATCH", body });
    return "Saved.";
  });

  const toggleActive = () => run("active", async () => {
    await call("/active", json("PATCH", { active: !card.is_active }));
    return card.is_active ? "Card disabled. Its QR now shows “no longer active”." : "Card enabled.";
  });

  const reset = () => setAskReset(true);
  const confirmReset = () => {
    setAskReset(false);
    run("reset", async () => { await call("/reset", { method: "POST" }); return "Card reset to blank."; });
  };

  const resend = () => run("resend", async () => (await call("/resend-welcome", { method: "POST" })).message);

  const link = () => run("link", async () => {
    const data = await call("/link-company", json("POST", { company }));
    setCompany("");
    return data.message;
  });

  const status = card?.status;
  const claimed = status && status !== "unclaimed" && !!card.claimed_at;

  return (
    <>
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle} id="qr-modal-title">{card?.name || (card ? "Blank card" : "Loading…")}</h2>
            <p className={styles.modalSub}>{card ? `${card.serial || "—"} · ${card.slug} · ${card.batch_name || "No batch"}` : ""}</p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {msg && <div className={`${styles.modalMsg} ${msg.ok ? styles.modalMsgSuccess : styles.modalMsgError}`} role="status">{msg.text}</div>}

        {card && (
          <div className={styles.modalBody}>
            <div className={styles.overviewGrid} style={{ marginBottom: 18 }}>
              <div className={styles.overviewItem}><span className={styles.overviewLabel}>Status</span><span className={styles.overviewVal}>{pill(status)}{card.is_locked ? " · locked" : ""}</span></div>
              <div className={styles.overviewItem}><span className={styles.overviewLabel}>Claimed</span><span className={styles.overviewVal}>{fmtDate(card.claimed_at)}</span></div>
              <div className={styles.overviewItem}><span className={styles.overviewLabel}>Views · Contacts</span><span className={styles.overviewVal}>{card.views} · {card.leads}</span></div>
              <div className={styles.overviewItem}><span className={styles.overviewLabel}>Converted to</span><span className={styles.overviewVal}>{card.converted_company ? `${card.converted_company} (#${card.company_id}) · ${fmtDate(card.converted_at)}` : "—"}</span></div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR code for ${card.serial || card.slug}`}
                     style={{ width: 132, height: 132, borderRadius: 10, border: "1px solid #ededf0", background: "#fff" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <a href={card.card_url} target="_blank" rel="noopener noreferrer" style={{ ...smallBtn, textDecoration: "none" }}>
                  <ExternalLink size={14} /> Open card page
                </a>
                {qr && (
                  <a href={qr} download={`${card.serial || card.slug}-qr.png`} style={{ ...smallBtn, textDecoration: "none" }}>
                    <Download size={14} /> Download QR
                  </a>
                )}
                <span style={{ fontSize: 11, color: "#9ca3af", wordBreak: "break-all" }}>{card.card_url}</span>
              </div>
            </div>

            {claimed ? (
              <div className={styles.formSection}>
                <h3 style={h3}>Details</h3>
                {EDIT_FIELDS.map(([f, label]) => (
                  <label key={f} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className={styles.label}>{label}</span>
                    <input className={styles.input} value={form[f] ?? ""} disabled={!!busy}
                           onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
                  </label>
                ))}
                {[1, 2].map((n) => (
                  <label key={n} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
                    <input type="checkbox" checked={form[`custom${n}_type`] === "link"} disabled={!!busy}
                           onChange={(e) => setForm({ ...form, [`custom${n}_type`]: e.target.checked ? "link" : "text" })} />
                    Extra field {n} is a web link
                  </label>
                ))}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className={styles.label}>Brief (30 words)</span>
                  <textarea className={styles.input} rows={3} value={form.brief ?? ""} disabled={!!busy}
                            onChange={(e) => setForm({ ...form, brief: e.target.value })} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className={styles.label}>Colour</span>
                  <select className={styles.select} value={form.theme} disabled={!!busy}
                          onChange={(e) => setForm({ ...form, theme: e.target.value })}>
                    {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                  </select>
                </label>

                {[["photo", "Photo", card.photo_preview, photo, setPhoto, removePhoto, setRemovePhoto],
                  ["logo", "Logo", card.logo_preview, logo, setLogo, removeLogo, setRemoveLogo]].map(
                  ([key, label, preview, file, setFile, remove, setRemove]) => (
                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span className={styles.label}>{label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        {preview && !remove && !file && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={preview} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "1px solid #ededf0", background: "#f7f7fa" }} />
                        )}
                        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy}
                               onChange={(e) => { setFile(e.target.files?.[0] || null); setRemove(false); }} />
                        {preview && !file && (
                          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 700, color: "#cc1100" }}>
                            <input type="checkbox" checked={remove} disabled={!!busy} onChange={(e) => setRemove(e.target.checked)} />
                            Remove
                          </label>
                        )}
                      </div>
                    </div>
                  )
                )}

                <button className={styles.btnPrimary} onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save changes"}</button>

                <div className={styles.divider} />
                <button className={styles.btnWarning} onClick={resend} disabled={!!busy}>
                  {busy === "resend" ? "Sending…" : `Resend welcome email to ${card.email || "owner"}`}
                </button>

                {!card.company_id && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className={styles.label}>Link to a company</span>
                    <p style={{ ...sub, margin: 0 }}>
                      Normally automatic when the owner pays with the same email or phone. Use this when they signed up
                      with different ones. Enter a company ID or the email of one of its users.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className={styles.input} value={company} disabled={!!busy} placeholder="Company ID or user email"
                             onChange={(e) => setCompany(e.target.value)} />
                      <button className={styles.btnPrimary} onClick={link} disabled={!!busy || !company.trim()}>
                        {busy === "link" ? "Linking…" : "Link"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ ...sub, fontSize: 13 }}>Not claimed yet. The next person to scan this card can claim it.</p>
            )}

            <div className={styles.dangerZone} style={{ marginTop: 18 }}>
              <button className={styles.btnDanger} onClick={toggleActive} disabled={!!busy}>
                {busy === "active" ? "Saving…" : card.is_active ? "Disable card" : "Enable card"}
              </button>
              {claimed && !card.company_id && (
                <>
                  <p className={styles.dangerText}>Reset wipes the owner&apos;s details, views and contacts so the printed card can be handed to someone else.</p>
                  <button className={styles.btnDanger} onClick={reset} disabled={!!busy}>{busy === "reset" ? "Resetting…" : "Reset to blank"}</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    <ConfirmModal
      open={askReset}
      title="Reset this card to blank?"
      message="The owner's details, photo, logo, views and contacts are deleted, and the next person to scan it can claim it."
      confirmLabel="Reset to blank"
      variant="danger"
      onConfirm={confirmReset}
      onCancel={() => setAskReset(false)}
    />
    </>
  );
}

/* ─────────────── PAGE ─────────────── */

export default function QrCardsPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [admin, setAdmin] = useState(null);

  const [overall, setOverall] = useState(null);
  const [batches, setBatches] = useState([]);
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [capped, setCapped]   = useState(0);    // the row limit, when the list was cut off

  const [section, setSection] = useState("claimed");
  const [batchId, setBatchId] = useState("");
  const [search, setSearch]   = useState("");
  const [query, setQuery]     = useState("");

  const [batchForm, setBatchForm] = useState({ name: "", header: "", quantity: "" });
  const [batchBusy, setBatchBusy] = useState(false);
  const [notice, setNotice]       = useState(null);   // { ok, text }
  const [downloading, setDownloading] = useState("");
  const [openId, setOpenId]       = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("sa_token");
    const a = localStorage.getItem("sa_admin");
    if (!t || !a) { router.replace("/login"); return; }
    try {
      const parsed = JSON.parse(a);
      if (parsed?.role !== "superadmin") { router.replace("/superadmin/dashboard"); return; }
      setToken(t); setAdmin(parsed);
    } catch {
      localStorage.removeItem("sa_token"); localStorage.removeItem("sa_admin");
      router.replace("/login");
    }
  }, [router]);

  const get = useCallback(async (path) => {
    const res = await fetch(`${API}/api/superadmin/qr-cards${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { router.replace("/login"); return null; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Could not load QR cards");
    return data;
  }, [token, router]);

  const loadStats = useCallback(async () => {
    const data = await get("/stats").catch(() => null);
    if (data) { setOverall(data.overall); setBatches(data.batches || []); }
  }, [get]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: section });
    if (batchId) qs.set("batch", batchId);
    if (query) qs.set("q", query);
    try {
      const data = await get(`?${qs}`);
      if (data) { setCards(data.cards || []); setCapped(data.truncated ? data.limit : 0); }
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  }, [get, section, batchId, query]);

  useEffect(() => { if (token) loadStats(); }, [token, loadStats]);
  useEffect(() => { if (token) loadCards(); }, [token, loadCards]);

  // Search as they type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = () => { loadStats(); loadCards(); };

  const logout = () => {
    localStorage.removeItem("sa_token"); localStorage.removeItem("sa_admin");
    router.replace("/login");
  };

  const createBatch = async (e) => {
    e.preventDefault();
    setNotice(null);
    const q = Number(batchForm.quantity);
    if (!batchForm.name.trim()) return setNotice({ ok: false, text: "Give the batch a name." });
    if (!Number.isInteger(q) || q < 1 || q > MAX_BATCH) return setNotice({ ok: false, text: `Quantity must be between 1 and ${MAX_BATCH}.` });
    setBatchBusy(true);
    try {
      const res = await fetch(`${API}/api/superadmin/qr-cards/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: batchForm.name, header: batchForm.header, quantity: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not create the batch");
      setBatchForm({ name: "", header: "", quantity: "" });
      setNotice({ ok: true, text: `Batch created with ${q} cards. Download its print sheet below.` });
      refresh();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setBatchBusy(false);
    }
  };

  const download = async (key, path, fallback) => {
    setDownloading(key); setNotice(null);
    try { await downloadWithAuth(`${API}/api/superadmin/qr-cards${path}`, token, fallback); }
    catch (err) { setNotice({ ok: false, text: err.message }); }
    finally { setDownloading(""); }
  };

  if (!token) return null;

  const stat = (label, value, color) => (
    <div className={styles.heroStatCard}>
      <div className={styles.heroStatLabel}>{label}</div>
      <div className={styles.heroStatValue} style={color ? { color } : undefined}>{value ?? "—"}</div>
    </div>
  );

  return (
    <div className={styles.container}>
      <SuperAdminNav admin={admin} isFullAdmin activeView="qr-cards" onLogout={logout} />

      <div className={styles.scrollBody}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>QR <span>Cards</span></h1>
          <p className={styles.heroSub}>Blank visiting cards handed out, claimed by whoever scans them first</p>
          <div className={styles.heroStats}>
            {stat("Printed", overall?.printed)}
            {stat("Claimed", overall?.claimed, "#0062d6")}
            {stat("Converted", overall?.converted, "#00875a")}
            {stat("Conversion", overall ? `${overall.conversion_rate}%` : null)}
          </div>
        </section>

        {notice && (
          <div style={{ margin: "0 1.5rem 1rem", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                        background: notice.ok ? "rgba(0,184,148,0.1)" : "rgba(204,17,0,0.08)", color: notice.ok ? "#00875a" : "#cc1100" }}
               role="status">
            {notice.text}
          </div>
        )}

        {/* ── Batches ── */}
        <div style={box}>
          <h3 style={h3}>New batch</h3>
          <p style={sub}>Up to {MAX_BATCH} cards. The header prints at the top of each A4 sheet, not on the cards.</p>
          <form onSubmit={createBatch} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={styles.label}>Batch name *</span>
              <input className={styles.input} value={batchForm.name} maxLength={120} disabled={batchBusy}
                     onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} placeholder="Expo Mumbai Oct" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={styles.label}>Sheet header</span>
              <input className={styles.input} value={batchForm.header} maxLength={160} disabled={batchBusy}
                     onChange={(e) => setBatchForm({ ...batchForm, header: e.target.value })} placeholder="Optional" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={styles.label}>Quantity *</span>
              <input className={styles.input} type="number" min={1} max={MAX_BATCH} value={batchForm.quantity} disabled={batchBusy}
                     onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} />
            </label>
            <button type="submit" className={styles.btnPrimary} disabled={batchBusy}>{batchBusy ? "Creating…" : "Create batch"}</button>
          </form>

          {batches.length > 0 && (
            <div className={styles.tableWrapper} style={{ margin: "18px 0 0" }}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Batch</th><th>Header</th><th>Created</th><th>Printed</th><th>Claimed</th><th>Converted</th><th>Conversion</th><th>Print</th></tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className={styles.headCell}>B{b.id} · {b.name}</td>
                      <td data-label="Header">{b.header || "—"}</td>
                      <td data-label="Created" className={styles.dateCell}>{fmtDate(b.created_at)}</td>
                      <td data-label="Printed">{b.printed}</td>
                      <td data-label="Claimed">{b.claimed}</td>
                      <td data-label="Converted">{b.converted}</td>
                      <td data-label="Conversion">{b.conversion_rate}%</td>
                      <td data-label="Print">
                        <button style={smallBtn} disabled={downloading === `b${b.id}`}
                                onClick={() => download(`b${b.id}`, `/batches/${b.id}/print`, `qr-cards-B${b.id}.pdf`)}>
                          <Printer size={14} /> {downloading === `b${b.id}` ? "Preparing…" : "Print sheet"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Cards ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 1.5rem" }} role="tablist">
          {SECTIONS.map((s) => (
            <button key={s.key} role="tab" aria-selected={section === s.key} onClick={() => setSection(s.key)}
                    style={{ ...smallBtn, fontSize: 13, padding: "8px 16px",
                             border: section === s.key ? "2px solid #1d1d21" : smallBtn.border,
                             background: section === s.key ? "rgba(29,29,33,0.08)" : "#fff" }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className={styles.filterBar}>
          <input className={styles.searchInput} type="search" placeholder="Search name, email, phone, company or code…"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={styles.filterSelect} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>B{b.id} · {b.name}</option>)}
          </select>
          <button style={smallBtn} onClick={refresh}><RefreshCw size={14} /> Refresh</button>
          <button style={smallBtn} disabled={downloading === "xlsx"}
                  title="Exports the cards in this tab, batch and search"
                  onClick={() => {
                    const qs = new URLSearchParams({ status: section });
                    if (batchId) qs.set("batch", batchId);
                    if (query) qs.set("q", query);
                    download("xlsx", `/export?${qs}`, `qr-cards-${section}.xlsx`);
                  }}>
            <Download size={14} /> {downloading === "xlsx" ? "Preparing…" : "Export Excel"}
          </button>
        </div>

        {!loading && capped > 0 && (
          <div style={{ margin: "0 1.5rem 10px", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                        background: "rgba(245,165,36,0.12)", color: "#8a5a00" }} role="status">
            Showing the latest {capped.toLocaleString("en-IN")} cards. Pick a batch or search to see the rest.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280", fontSize: 16 }}>Loading cards…</div>
        ) : cards.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280", fontSize: 16 }}>No cards here.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Phone</th><th>Email</th><th>Company</th><th>Batch</th>
                  <th>Claimed</th><th>Views</th><th>Contacts</th><th>Converted</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} style={{ cursor: "pointer" }}
                      tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(c.id); }}>
                    <td className={styles.headCell} style={{ fontFamily: "monospace" }}>
                      {c.serial || "—"}<div style={{ fontSize: 11, color: "#9ca3af" }}>{c.slug}</div>
                    </td>
                    <td data-label="Name">{c.name || "—"}</td>
                    <td data-label="Phone" style={{ fontFamily: "monospace" }}>{c.phone || "—"}</td>
                    <td data-label="Email">{c.email || "—"}</td>
                    <td data-label="Company">{c.company_name || "—"}</td>
                    <td data-label="Batch">{c.batch_name || "—"}</td>
                    <td data-label="Claimed" className={styles.dateCell}>{fmtDate(c.claimed_at)}</td>
                    <td data-label="Views">{c.views}</td>
                    <td data-label="Contacts">{c.leads}</td>
                    <td data-label="Converted">
                      {c.converted_company ? <>{c.converted_company}<div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(c.converted_at)}</div></> : pill(c.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && (
        <CardModal id={openId} token={token} onClose={() => setOpenId(null)} onChanged={refresh} />
      )}
    </div>
  );
}
