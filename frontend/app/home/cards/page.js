"use client";
/* ============================================================================
   DIGITAL VISITING CARDS — ADMIN
   The company admin creates and maintains a card per employee. Cards are
   never deleted, only deactivated: their QR may already be printed on
   physical cards, and breaking that URL punishes whoever is holding one.

   Plan allowance is shown at all times rather than surfaced as an error on
   save — being told you are out of cards after filling in a form is the
   wrong moment to find out.
   ========================================================================== */
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft, Plus, Search, QrCode, Power, Lock, Unlock, Pencil, X,
  Download, Users, Eye, MessageSquare,
} from "lucide-react";
import { restoreSession, SESSION } from "../../utils/session";
import styles from "./style.module.css";

const API  = process.env.NEXT_PUBLIC_API_BASE_URL;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

const THEMES = [
  { key: "ink",    label: "Ink",    swatch: "#0c0c0f" },
  { key: "paper",  label: "Paper",  swatch: "#ffffff" },
  { key: "amber",  label: "Amber",  swatch: "#1a1408" },
  { key: "sky",    label: "Sky",    swatch: "#071722" },
  { key: "mint",   label: "Mint",   swatch: "#04150e" },
  { key: "violet", label: "Violet", swatch: "#120c22" },
];

const EMPTY = {
  name: "", job_title: "", company_name: "", phone: "", whatsapp: "", email: "",
  linkedin: "", brief: "", photo_url: "",
  custom1_label: "", custom1_value: "", custom1_type: "text",
  custom2_label: "", custom2_value: "", custom2_type: "text",
  theme: "ink",
};

const cardUrl = (slug) => `${SITE}/card/${slug}`;

export default function CardsPage() {
  const router = useRouter();

  const [cards, setCards]   = useState([]);
  const [usage, setUsage]   = useState({ used: 0, limit: 0, remaining: 0 });
  const [loading, setLoad]  = useState(true);
  const [query, setQuery]   = useState("");
  const [toast, setToast]   = useState(null);

  const [editing, setEditing]   = useState(null);  // card being edited, or {} for new
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormErr] = useState("");

  const [qrFor, setQrFor]   = useState(null);
  const [qrData, setQrData] = useState("");

  // Employee picker
  const [empQuery, setEmpQuery] = useState("");
  const [employees, setEmployees] = useState([]);
  const empTimer = useRef(null);

  const say = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cards`, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Could not load cards");
      setCards(data.cards || []);
      setUsage(data.usage || { used: 0, limit: 0, remaining: 0 });
    } catch (e) {
      say(e.message || "Could not load cards", "error");
    } finally {
      setLoad(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const { status } = await restoreSession();
      if (status === SESSION.UNAUTHENTICATED) { router.replace("/login"); return; }
      if (status === SESSION.OFFLINE) return;
      load();
    })();
  }, [load, router]);

  /* Employee search, debounced — this fires on every keystroke otherwise. */
  useEffect(() => {
    if (!editing) return;
    if (empTimer.current) clearTimeout(empTimer.current);
    if (!empQuery.trim()) { setEmployees([]); return; }

    empTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/employees?search=${encodeURIComponent(empQuery)}&limit=6`,
          { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setEmployees(Array.isArray(data) ? data : data?.employees || []);
      } catch { setEmployees([]); }
    }, 280);

    return () => { if (empTimer.current) clearTimeout(empTimer.current); };
  }, [empQuery, editing]);

  /* Prefills from the employee record but leaves everything editable — the
     card often needs a different number or a title the HR record lacks. */
  const pickEmployee = (emp) => {
    setForm((f) => ({
      ...f,
      name:  emp.name  || f.name,
      email: emp.email || f.email,
      phone: emp.phone || f.phone,
      job_title: f.job_title || emp.department || "",
    }));
    setEmpQuery("");
    setEmployees([]);
  };

  const openNew = () => {
    if (usage.remaining <= 0) {
      say(`Your plan allows ${usage.limit} active card${usage.limit === 1 ? "" : "s"}. Deactivate one first.`, "error");
      return;
    }
    setForm(EMPTY); setFormErr(""); setEditing({});
  };

  const openEdit = (card) => {
    setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(card).filter(([, v]) => v !== null)) });
    setFormErr(""); setEditing(card);
  };

  const save = async (e) => {
    e.preventDefault();
    setFormErr("");
    if (!form.name.trim() || !form.phone.trim()) {
      setFormErr("Name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const isNew = !editing?.id;
      const res = await fetch(`${API}/api/cards${isNew ? "" : `/${editing.id}`}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not save the card");
      setEditing(null);
      say(isNew ? "Card created." : "Card updated.");
      load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const patchFlag = async (card, path, body, okMsg) => {
    try {
      const res = await fetch(`${API}/api/cards/${card.id}/${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not update the card");
      say(okMsg);
      load();
    } catch (err) {
      say(err.message, "error");
    }
  };

  const showQr = async (card) => {
    setQrFor(card);
    try {
      // Black modules on white: QR decoding depends on contrast, and a
      // tinted code fails on a meaningful share of scanners.
      setQrData(await QRCode.toDataURL(cardUrl(card.slug), {
        width: 1004, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#FFFFFF" },
      }));
    } catch {
      say("Could not generate the QR code", "error");
      setQrFor(null);
    }
  };

  const filtered = cards.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.job_title, c.email, c.phone, c.company_name]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>;

  return (
    <div className={styles.page}>

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Digital Cards</h1>
          <span className={styles.usage}>
            <strong>{usage.used}</strong> of {usage.limit} active
          </span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.ghostBtn} onClick={() => router.push("/home/cards/leads")}>
            <MessageSquare size={15} /><span>Card Leads</span>
          </button>
          <button className={styles.ghostBtn} onClick={() => router.push("/home")}>
            <ArrowLeft size={15} /><span>Back</span>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input className={styles.search} type="search" value={query}
                   placeholder="Search by name, title, email or phone…"
                   onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className={styles.primaryBtn} onClick={openNew}>
            <Plus size={16} /> New Card
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Users size={26} />
            <p>{query.trim() ? "No cards match that search." : "No cards yet. Create one for a member of your team."}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((card) => (
              <article key={card.id}
                       className={`${styles.cardTile} ${!card.is_active || card.is_locked ? styles.tileOff : ""}`}>
                <div className={styles.tileHead}>
                  <span className={styles.avatar} aria-hidden="true">
                    {(card.name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.tileWho}>
                    <h2>{card.name}</h2>
                    {card.job_title && <p>{card.job_title}</p>}
                  </div>
                  {card.is_locked
                    ? <span className={`${styles.tag} ${styles.tagLocked}`}>Locked</span>
                    : !card.is_active
                      ? <span className={styles.tag}>Inactive</span>
                      : null}
                </div>

                <div className={styles.tileStats}>
                  <span><Eye size={13} /> {card.scan_count} scan{card.scan_count === 1 ? "" : "s"}</span>
                  <span><MessageSquare size={13} /> {card.lead_count} lead{card.lead_count === 1 ? "" : "s"}</span>
                </div>

                <div className={styles.tileActions}>
                  <button onClick={() => showQr(card)} title="QR code"><QrCode size={15} /></button>
                  <button onClick={() => openEdit(card)} disabled={!!card.is_locked} title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => patchFlag(card, "active", { active: !card.is_active },
                      card.is_active ? "Card deactivated." : "Card activated.")}
                    title={card.is_active ? "Deactivate" : "Activate"}
                  >
                    <Power size={15} />
                  </button>
                  <button
                    onClick={() => patchFlag(card, "locked", { locked: !card.is_locked },
                      card.is_locked ? "Card released." : "Card locked.")}
                    title={card.is_locked ? "Release" : "Lock"}
                  >
                    {card.is_locked ? <Unlock size={15} /> : <Lock size={15} />}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ── Editor ── */}
      {editing && (
        <div className={styles.overlay} onClick={() => !saving && setEditing(null)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <h2>{editing.id ? "Edit card" : "New card"}</h2>
              <button onClick={() => setEditing(null)} disabled={saving} aria-label="Close"><X size={16} /></button>
            </div>

            <form className={styles.form} onSubmit={save} noValidate>

              {/* Prefill from an existing employee, or just type it in. */}
              {!editing.id && (
                <div className={styles.pickWrap}>
                  <label htmlFor="emp">Start from an employee <span>optional</span></label>
                  <input id="emp" value={empQuery} placeholder="Search your employee list…"
                         onChange={(e) => setEmpQuery(e.target.value)} autoComplete="off" />
                  {employees.length > 0 && (
                    <ul className={styles.pickList}>
                      {employees.map((emp) => (
                        <li key={emp.id}>
                          <button type="button" onClick={() => pickEmployee(emp)}>
                            <strong>{emp.name}</strong>
                            <span>{[emp.department, emp.phone].filter(Boolean).join(" · ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="f-name">Name *</label>
                  <input id="f-name" value={form.name} disabled={saving}
                         onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="f-title">Job title</label>
                  <input id="f-title" value={form.job_title} disabled={saving}
                         onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="f-phone">Phone *</label>
                  <input id="f-phone" type="tel" inputMode="numeric" value={form.phone} disabled={saving}
                         onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="f-email">Email</label>
                  <input id="f-email" type="email" value={form.email} disabled={saving}
                         onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              {/* Same number in the overwhelming majority of cases, so the
                  second field only appears when it genuinely differs. */}
              <label className={styles.checkRow}>
                <input type="checkbox" disabled={saving}
                       checked={!form.whatsapp || form.whatsapp === form.phone}
                       onChange={(e) => setForm({ ...form, whatsapp: e.target.checked ? "" : form.phone })} />
                WhatsApp is the same as this phone number
              </label>

              {form.whatsapp && form.whatsapp !== form.phone && (
                <div className={styles.field}>
                  <label htmlFor="f-wa">WhatsApp number</label>
                  <input id="f-wa" type="tel" inputMode="numeric" value={form.whatsapp} disabled={saving}
                         onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
              )}

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="f-org">Company</label>
                  <input id="f-org" value={form.company_name} disabled={saving} placeholder="Defaults to your company"
                         onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="f-li">LinkedIn</label>
                  <input id="f-li" value={form.linkedin} disabled={saving} placeholder="linkedin.com/in/…"
                         onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="f-photo">Photo URL <span className={styles.opt}>optional</span></label>
                <input id="f-photo" value={form.photo_url} disabled={saving} placeholder="https://…"
                       onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
              </div>

              <div className={styles.field}>
                <label htmlFor="f-brief">Brief</label>
                <textarea id="f-brief" rows={3} value={form.brief} disabled={saving}
                          placeholder="A line or two about what they do"
                          onChange={(e) => setForm({ ...form, brief: e.target.value })} />
              </div>

              {/* Two free slots. Display-only — a saved contact has nowhere
                  to put them. */}
              {[1, 2].map((n) => (
                <div className={styles.row} key={n}>
                  <div className={styles.field}>
                    <label htmlFor={`f-cl${n}`}>Custom field {n} <span className={styles.opt}>optional</span></label>
                    <input id={`f-cl${n}`} value={form[`custom${n}_label`]} disabled={saving} placeholder="Label"
                           onChange={(e) => setForm({ ...form, [`custom${n}_label`]: e.target.value })} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`f-cv${n}`}>Value</label>
                    <div className={styles.valueRow}>
                      <input id={`f-cv${n}`} value={form[`custom${n}_value`]} disabled={saving}
                             onChange={(e) => setForm({ ...form, [`custom${n}_value`]: e.target.value })} />
                      <select value={form[`custom${n}_type`]} disabled={saving}
                              onChange={(e) => setForm({ ...form, [`custom${n}_type`]: e.target.value })}>
                        <option value="text">Text</option>
                        <option value="link">Link</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <div className={styles.field}>
                <label>Theme</label>
                <div className={styles.themes}>
                  {THEMES.map((t) => (
                    <button type="button" key={t.key}
                            className={`${styles.theme} ${form.theme === t.key ? styles.themeOn : ""}`}
                            onClick={() => setForm({ ...form, theme: t.key })}>
                      <span style={{ background: t.swatch }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {formError && <p className={styles.formError} role="alert">{formError}</p>}

              <div className={styles.formActions}>
                <button type="button" className={styles.ghostBtn} onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? "Saving…" : editing.id ? "Save changes" : "Create card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QR ── */}
      {qrFor && (
        <div className={styles.overlay} onClick={() => setQrFor(null)} role="presentation">
          <div className={`${styles.modal} ${styles.qrModal}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <h2>{qrFor.name}</h2>
              <button onClick={() => setQrFor(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className={styles.qrBody}>
              {qrData
                ? <img src={qrData} alt={`QR code for ${qrFor.name}`} className={styles.qrImg} />
                : <div className={styles.spinner} />}
              <p className={styles.qrUrl}>{cardUrl(qrFor.slug)}</p>
              <div className={styles.qrActions}>
                <a className={styles.primaryBtn} href={qrData} download={`${qrFor.slug}-qr.png`}>
                  <Download size={15} /> Download QR
                </a>
                <a className={styles.ghostBtn} href={cardUrl(qrFor.slug)} target="_blank" rel="noopener noreferrer">
                  Open card
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`} role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
