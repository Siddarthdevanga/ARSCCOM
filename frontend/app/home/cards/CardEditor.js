"use client";
/* ============================================================================
   CARD EDITOR — its own screen, not a pop-up
   Used by /home/cards/new and /home/cards/[id]. A full page leaves room for
   the form and a live preview of both printed faces side by side, which a
   modal on a laptop screen never did.

   After a card is created the editor moves onto that card's own screen, so
   the print-ready PNGs (which need the real QR) can be downloaded at once.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Download, Trash2 } from "lucide-react";
import { restoreSession, SESSION } from "../../utils/session";
import LockedModule from "../../components/LockedModule";
import ConfirmModal from "../../components/ConfirmModal";
import CardPreview from "./CardPreview";
import CardsGuide, { GuideButton } from "./CardsGuide";
import { downloadCard } from "./cardDownload";
import { THEMES as CARD_THEMES, resolveColors, contrastVerdict } from "./cardArt";
import { validateCard } from "./validate";
import styles from "./style.module.css";
import ed from "./editor.module.css";

const API  = process.env.NEXT_PUBLIC_API_BASE_URL;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const THEME_GROUPS = ["dark", "light"].map((tone) => ({
  tone,
  label: tone === "dark" ? "Dark" : "Light",
  themes: Object.entries(CARD_THEMES)
    .filter(([, t]) => t.tone === tone)
    .map(([key, t]) => ({ key, label: t.label, swatch: t.bg, accent: t.accent })),
}));

const EMPTY = {
  name: "", job_title: "", company_name: "", phone: "", whatsapp: "", email: "",
  linkedin: "", brief: "", photo_url: "", photo_on_print: 0,
  custom1_label: "", custom1_value: "", custom1_type: "text",
  custom2_label: "", custom2_value: "", custom2_type: "text",
  theme: "ink", bg_color: "", text_color: "", accent_color: "",
};
const FIELDS = Object.keys(EMPTY);

const cardUrl = (slug) => `${SITE}/card/${slug}`;

/* The brief sits under the name on a phone screen; past a few sentences it
   pushes the contact actions out of reach. Same limit as the API. */
const BRIEF_WORDS = 30;
const FIX_FIELDS = "Please fix the highlighted fields.";
const countWords = (s) => (String(s || "").trim().match(/\S+/g) || []).length;

/* A one-shot message carried across a navigation (e.g. "Card created"). */
export const FLASH_KEY = "hv-cards-flash";
const setFlash = (msg) => { try { sessionStorage.setItem(FLASH_KEY, msg); } catch { /* optional */ } };
export const takeFlash = () => {
  try {
    const m = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return m;
  } catch { return null; }
};

export default function CardEditor({ cardId = null }) {
  const router = useRouter();
  const isNew = !cardId;

  const [state, setState]     = useState("loading");   // loading | ready | locked | expired | missing | failed
  const [card, setCard]       = useState(null);        // the saved record, when editing
  const [form, setForm]       = useState(EMPTY);
  const [guideOpen, setGuideOpen] = useState(false);
  const briefWords = countWords(form.brief);
  const [waSame, setWaSame]   = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [notice, setNotice]   = useState("");
  const [dirty, setDirty]     = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [saved, setSaved]     = useState(false);

  /* Field problems are worked out on every render but only shown after
     the first save attempt: flagging a phone number as invalid while it is
     still being typed is noise. Once shown, they clear as each is fixed. */
  const [showErrs, setShowErrs] = useState(false);
  const errs = validateCard(form, { waSame, briefWords, briefLimit: BRIEF_WORDS });
  const err = (f) => (showErrs ? errs[f] || "" : "");
  const shownError = error === FIX_FIELDS && !Object.keys(errs).length ? "" : error;
  const fieldErr = (f) => (err(f) ? <span id={`e-${f}`} className={ed.fieldErr}>{err(f)}</span> : null);

  const [photoPreview, setPhotoPreview] = useState("");
  const [printPhoto, setPrintPhoto]     = useState("");   // same-origin blob for the canvas
  const [uploading, setUploading]       = useState(false);
  const fileRef = useRef(null);

  const [companyLogo, setCompanyLogo] = useState("");
  const [downloading, setDownloading] = useState(false);

  const [empQuery, setEmpQuery]   = useState("");
  const [employees, setEmployees] = useState([]);
  const empTimer = useRef(null);

  const update = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); setSaved(false); };

  /* ── Load ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await restoreSession();
      if (cancelled) return;
      if (status === SESSION.UNAUTHENTICATED) { router.replace("/login"); return; }

      try {
        const stored = JSON.parse(localStorage.getItem("company") || "{}");
        setCompanyLogo(stored?.id ? `${API}/api/logo/${stored.id}` : "");
      } catch { /* the card renders without a logo */ }

      try {
        // New: the list endpoint doubles as the plan/lapse check.
        const res = await fetch(`${API}/api/cards${isNew ? "" : `/${cardId}`}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403 && data?.status === "expired") { setState("expired"); return; }
        if (res.status === 404) { setState("missing"); return; }
        if (!res.ok) throw new Error(data?.message || "Could not load");

        if (isNew) {
          if ((data.usage?.remaining ?? 1) <= 0) {
            const n = data.usage?.limit ?? 0;
            setNotice(`Your plan allows ${n} active card${n === 1 ? "" : "s"}. Deactivate one to add another.`);
            setState("locked");
            return;
          }
          setState("ready");
          return;
        }

        const c = data.card;
        if (c.is_locked) {
          setNotice("This card is locked because it is over your plan's allowance. Release it from the card list to edit it.");
          setState("locked");
          return;
        }
        setCard(c);
        setForm(Object.fromEntries(FIELDS.map((k) => [k, c[k] ?? EMPTY[k]])));
        setWaSame(!c.whatsapp || c.whatsapp === c.phone);
        setPhotoPreview(c.photo_preview || "");
        setState("ready");

        const flash = takeFlash();
        if (flash) setNotice(flash);
      } catch (e) {
        if (cancelled) return;
        // Editing: never fall through to an empty form. Saving it would
        // overwrite the real card with blanks.
        if (!isNew) { setNotice("This card could not be loaded. Check your connection and try again."); setState("failed"); return; }
        setError(e.message || "Could not load");
        setState("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [cardId, isNew, router]);

  /* The photo drawn onto the printed card. Fetched through our API as a
     blob, because a presigned S3 URL would taint the canvas and break the
     PNG export. A pre-upload pasted URL is tried as it is. */
  useEffect(() => {
    const key = form.photo_url;
    if (!form.photo_on_print || !key) { setPrintPhoto(""); return; }
    if (!key.startsWith("digital-cards/")) { setPrintPhoto(key); return; }
    let url = "";
    let cancelled = false;
    fetch(`${API}/api/cards/photo?key=${encodeURIComponent(key)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || cancelled) return;
        url = URL.createObjectURL(b);
        setPrintPhoto(url);
      })
      .catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [form.photo_url, form.photo_on_print]);

  /* A QR card claimed before its owner signed up carries its own logo, and
     keeps it here so the printed card matches the one already out there.
     Fetched as a blob for the same canvas reason as the photo. */
  const ownLogo = card?.own_logo_url;
  useEffect(() => {
    if (!ownLogo) return;
    let url = "";
    let cancelled = false;
    fetch(`${API}/api/cards/photo?key=${encodeURIComponent(ownLogo)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || cancelled) return;
        url = URL.createObjectURL(b);
        setCompanyLogo(url);
      })
      .catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [ownLogo]);

  /* Closing the tab or reloading with unsaved edits asks first, the same
     as the Back button does. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ── Employee picker, debounced ── */
  useEffect(() => {
    if (!isNew) return;
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
  }, [empQuery, isNew]);

  /* Prefills but leaves everything editable — the card often needs a
     different number or a title the HR record lacks. */
  const pickEmployee = (emp) => {
    setForm((f) => ({
      ...f,
      name:  emp.name  || f.name,
      email: emp.email || f.email,
      phone: emp.phone || f.phone,
      job_title: f.job_title || emp.department || "",
    }));
    setDirty(true);
    setEmpQuery("");
    setEmployees([]);
  };

  /* ── Photo ── */
  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";   // choosing the same file again must still fire
    if (!file) return;
    setError("");
    if (!PHOTO_TYPES.includes(file.type)) { setError("Use a JPG, PNG or WebP photo."); return; }
    if (file.size > MAX_PHOTO) { setError("Photo must be 5 MB or smaller."); return; }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`${API}/api/cards/photo`, { method: "POST", credentials: "include", body });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setState("expired"); return; }
      if (!res.ok) throw new Error(data?.message || "Could not upload the photo");
      update({ photo_url: data.key });
      setPhotoPreview(data.preview || URL.createObjectURL(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => { update({ photo_url: "", photo_on_print: 0 }); setPhotoPreview(""); };

  /* ── Save ── */
  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (Object.keys(errs).length) {
      setShowErrs(true);
      setError(FIX_FIELDS);
      // Onto the first problem, after the render that marks it.
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/cards${isNew ? "" : `/${cardId}`}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Blank WhatsApp is stored as NULL, which means "same as phone".
        body: JSON.stringify({ ...form, whatsapp: waSame ? "" : form.whatsapp }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setState("expired"); return; }
      if (!res.ok) throw new Error(data?.message || "Could not save the card");

      setDirty(false);
      if (isNew) {
        // Onto the card's own screen: the real QR exists now, so the
        // print files can be downloaded straight away.
        setFlash("Card created. Use Download to get the print-ready front and back.");
        router.replace(`/home/cards/${data.id}`);
      } else {
        // Stay here: the next thing after an edit is usually downloading
        // the updated print files, which the save has just unblocked.
        setSaved(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* Both Download buttons (header and under the preview) land here. */
  const downloadBoth = async () => {
    if (downloading || dirty) return;
    setDownloading(true);
    setError("");
    try {
      await downloadCard(form, { cardUrl: cardUrl(card.slug), logoSrc: companyLogo, photoSrc: printPhoto });
    } catch {
      setError("Could not create the card images. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const goBack = () => {
    if (dirty) { setAskLeave(true); return; }
    router.push("/home/cards");
  };

  /* ── Derived ── */
  const live = resolveColors(form);
  const hasOverride = !!(form.bg_color || form.text_color || form.accent_color);
  const contrast = contrastVerdict(live.fg, live.bg);
  const busy = saving || uploading;

  if (state === "loading") return <div className={styles.loading}><div className={styles.spinner} /></div>;
  if (state === "expired") return <LockedModule moduleName="Digital Cards" />;

  const header = (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>
          {isNew ? "New card" : card?.blank ? `Fill in card ${card.number}` : "Edit card"}
        </h1>
        {card?.slug && <span className={styles.usage}>{cardUrl(card.slug).replace(/^https?:\/\//, "")}</span>}
      </div>
      <div className={styles.headerRight}>
        <GuideButton open={guideOpen} onClick={() => setGuideOpen((o) => !o)} />
        {state === "ready" && card?.slug && (
          <button className={styles.ghostBtn} onClick={downloadBoth} disabled={downloading || busy || dirty}
                  title={dirty ? "Save your changes first" : "Download the print-ready front and back PNGs"}>
            <Download size={15} /><span>{downloading ? "Preparing…" : "Download"}</span>
          </button>
        )}
        <button className={styles.ghostBtn} onClick={goBack} disabled={saving}>
          <ArrowLeft size={15} /><span>Back</span>
        </button>
      </div>
    </header>
  );

  if (state === "locked" || state === "missing" || state === "failed") {
    return (
      <div className={styles.page}>
        {header}
        <div className={ed.blocked}>
          <p>{state === "missing" ? "This card could not be found." : notice}</p>
          {state === "failed"
            ? <button className={styles.primaryBtn} onClick={() => window.location.reload()}>Try again</button>
            : <button className={styles.primaryBtn} onClick={() => router.push("/home/cards")}>Back to cards</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {header}

      <CardsGuide page="editor" open={guideOpen} onClose={() => setGuideOpen(false)} />

      <form className={ed.layout} onSubmit={save} noValidate>
        <div className={ed.formCol}>
          {notice && <p className={ed.notice} role="status">{notice}</p>}

          {isNew && (
            <section className={ed.section}>
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
            </section>
          )}

          <section className={ed.section}>
            <h2 className={ed.sectionTitle}>Details</h2>

            <div className={ed.photoRow}>
              {photoPreview
                ? <img src={photoPreview} alt="" className={ed.photoThumb} />
                : <span className={ed.photoEmpty} aria-hidden="true">
                    {(form.name || "?").trim().charAt(0).toUpperCase() || "?"}
                  </span>}
              <div className={ed.photoText}>
                <strong>Photo <span className={styles.opt}>optional</span></strong>
                <span>JPG, PNG or WebP, up to 5 MB. Always shown on the web card.</span>
                <div className={ed.photoBtns}>
                  <button type="button" className={styles.ghostBtn} disabled={busy}
                          onClick={() => fileRef.current?.click()}>
                    <Camera size={14} /> {uploading ? "Uploading…" : photoPreview ? "Change" : "Upload"}
                  </button>
                  {photoPreview && (
                    <button type="button" className={styles.ghostBtn} disabled={busy} onClick={removePhoto}>
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                       className={ed.hiddenFile} onChange={choosePhoto} />
                <label className={`${styles.checkRow} ${ed.printToggle}`}>
                  <input type="checkbox" disabled={busy || !form.photo_url}
                         checked={!!form.photo_on_print && !!form.photo_url}
                         onChange={(e) => update({ photo_on_print: e.target.checked ? 1 : 0 })} />
                  Show photo on the printed card
                </label>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="f-name">Name *</label>
                <input id="f-name" maxLength={120} value={form.name} disabled={busy}
                       aria-invalid={!!err("name")} aria-describedby={err("name") ? "e-name" : undefined}
                       onChange={(e) => update({ name: e.target.value })} />
                {fieldErr("name")}
              </div>
              <div className={styles.field}>
                <label htmlFor="f-title">Job title</label>
                <input id="f-title" maxLength={120} value={form.job_title} disabled={busy}
                       onChange={(e) => update({ job_title: e.target.value })} />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="f-org">Company</label>
              <input id="f-org" maxLength={160} value={form.company_name} disabled={busy}
                     placeholder="Defaults to your company"
                     onChange={(e) => update({ company_name: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="f-brief">Brief</label>
              <textarea id="f-brief" maxLength={2000} rows={3} value={form.brief} disabled={busy}
                        placeholder="A line or two about what they do"
                        aria-describedby="f-brief-count" aria-invalid={!!err("brief")}
                        onChange={(e) => update({ brief: e.target.value })} />
              {/* Announced only once over the limit; a live count would be
                  read out on every keystroke. */}
              <span id="f-brief-count" aria-live={briefWords > BRIEF_WORDS ? "polite" : "off"}
                    className={`${ed.wordCount} ${briefWords > BRIEF_WORDS ? ed.wordCountOver : ""}`}>
                {briefWords} / {BRIEF_WORDS} words
              </span>
            </div>
          </section>

          <section className={ed.section}>
            <h2 className={ed.sectionTitle}>Contact</h2>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="f-phone">Phone *</label>
                <input id="f-phone" maxLength={20} type="tel" inputMode="tel" value={form.phone} disabled={busy}
                       placeholder="98765 43210"
                       aria-invalid={!!err("phone")} aria-describedby={err("phone") ? "e-phone" : "h-phone"}
                       onChange={(e) => update({ phone: e.target.value })} />
                {err("phone")
                  ? fieldErr("phone")
                  : <span id="h-phone" className={ed.fieldHint}>+91 is assumed. For another country, start with + and its code.</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="f-email">Email</label>
                <input id="f-email" maxLength={190} type="email" value={form.email} disabled={busy}
                       aria-invalid={!!err("email")} aria-describedby={err("email") ? "e-email" : undefined}
                       onChange={(e) => update({ email: e.target.value })} />
                {fieldErr("email")}
              </div>
            </div>

            {/* Driven by its own flag, not by the value: deriving it from the
                value made the field vanish the moment it was needed. */}
            <label className={styles.checkRow}>
              <input type="checkbox" disabled={busy} checked={waSame}
                     onChange={(e) => { setWaSame(e.target.checked); setDirty(true); }} />
              WhatsApp is the same as this phone number
            </label>

            {!waSame && (
              <div className={styles.field}>
                <label htmlFor="f-wa">WhatsApp number</label>
                <input id="f-wa" maxLength={20} type="tel" inputMode="tel" value={form.whatsapp} disabled={busy}
                       placeholder="98765 43210"
                       aria-invalid={!!err("whatsapp")} aria-describedby={err("whatsapp") ? "e-whatsapp" : undefined}
                       onChange={(e) => update({ whatsapp: e.target.value })} />
                {fieldErr("whatsapp")}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="f-li">LinkedIn</label>
              <input id="f-li" maxLength={255} value={form.linkedin} disabled={busy} placeholder="linkedin.com/in/…"
                     aria-invalid={!!err("linkedin")} aria-describedby={err("linkedin") ? "e-linkedin" : undefined}
                     onChange={(e) => update({ linkedin: e.target.value })} />
              {fieldErr("linkedin")}
            </div>

            {/* Two free slots. Display-only — a saved contact has nowhere to put them. */}
            {[1, 2].map((n) => (
              <div className={styles.row} key={n}>
                <div className={styles.field}>
                  <label htmlFor={`f-cl${n}`}>Custom field {n} <span className={styles.opt}>optional</span></label>
                  <input id={`f-cl${n}`} maxLength={60} value={form[`custom${n}_label`]} disabled={busy} placeholder="Label"
                         aria-invalid={!!err(`custom${n}_label`)}
                         aria-describedby={err(`custom${n}_label`) ? `e-custom${n}_label` : undefined}
                         onChange={(e) => update({ [`custom${n}_label`]: e.target.value })} />
                  {fieldErr(`custom${n}_label`)}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`f-cv${n}`}>Value</label>
                  <div className={styles.valueRow}>
                    <input id={`f-cv${n}`} maxLength={255} value={form[`custom${n}_value`]} disabled={busy}
                           placeholder={form[`custom${n}_type`] === "link" ? "example.com/page" : ""}
                           aria-invalid={!!err(`custom${n}_value`)}
                           aria-describedby={err(`custom${n}_value`) ? `e-custom${n}_value` : undefined}
                           onChange={(e) => update({ [`custom${n}_value`]: e.target.value })} />
                    <select value={form[`custom${n}_type`]} disabled={busy} aria-label={`Custom field ${n} type`}
                            onChange={(e) => update({ [`custom${n}_type`]: e.target.value })}>
                      <option value="text">Text</option>
                      <option value="link">Link</option>
                    </select>
                  </div>
                  {fieldErr(`custom${n}_value`)}
                </div>
              </div>
            ))}
          </section>

          <section className={ed.section}>
            <h2 className={ed.sectionTitle}>Design</h2>

            {THEME_GROUPS.map((g) => (
              <div className={styles.field} key={g.tone}>
                <label>{g.label}</label>
                <div className={styles.themes}>
                  {g.themes.map((t) => (
                    <button type="button" key={t.key} disabled={busy}
                            className={`${styles.theme} ${form.theme === t.key && !hasOverride ? styles.themeOn : ""}`}
                            // A preset clears any override, or it would look
                            // selected and change nothing.
                            onClick={() => update({ theme: t.key, bg_color: "", text_color: "", accent_color: "" })}>
                      <span style={{ background: `linear-gradient(135deg, ${t.swatch} 62%, ${t.accent} 62%)` }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className={styles.field}>
              <div className={styles.colourHead}>
                <label htmlFor="c-bg">Your own colours <span className={styles.opt}>optional</span></label>
                {hasOverride && (
                  <button type="button" className={styles.clearColours}
                          onClick={() => update({ bg_color: "", text_color: "", accent_color: "" })}>
                    Reset to theme
                  </button>
                )}
              </div>
              <div className={styles.colours}>
                {[
                  ["bg_color",     "Background", "c-bg", "bg"],
                  ["text_color",   "Text",       "c-fg", "fg"],
                  ["accent_color", "Accent",     "c-ac", "accent"],
                ].map(([key, label, id, liveKey]) => (
                  <label key={key} className={styles.colour} htmlFor={id}>
                    <input id={id} type="color" disabled={busy}
                           value={form[key] || live[liveKey]}
                           onChange={(e) => update({ [key]: e.target.value })} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {!contrast.ok && (
                <p className={styles.contrastWarn} role="status">
                  Text contrast is {contrast.ratio.toFixed(1)}:1. {contrast.note}.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className={ed.previewCol}>
          <section className={ed.section}>
            <h2 className={ed.sectionTitle}>Printed card</h2>
            <CardPreview
              card={form}
              cardUrl={card?.slug ? cardUrl(card.slug) : `${SITE}/card/preview`}
              logoSrc={companyLogo}
              photoSrc={printPhoto}
              downloadable={!!card?.slug}
              onDownload={downloadBoth}
              downloading={downloading}
              // The QR opens the saved card; printing unsaved edits would put
              // details on paper that the web card does not show.
              blockedNote={dirty ? "Save your changes first, so the printed card matches the web card." : ""}
            />
            {!card?.slug && (
              <p className={styles.previewNote}>
                The QR becomes real once the card is created — download is available then.
              </p>
            )}
          </section>
        </aside>

        <div className={ed.actionBar}>
          {/* The "fix the fields" banner goes once the last one is fixed. */}
          {shownError && <p className={ed.actionError} role="alert">{shownError}</p>}
          {!shownError && saved && <p className={ed.actionOk} role="status">Changes saved.</p>}
          <div className={ed.actionBtns}>
            <button type="button" className={styles.ghostBtn} onClick={goBack} disabled={saving}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={busy}>
              {saving ? "Saving…" : isNew ? "Create card" : "Save changes"}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={askLeave}
        title="Leave without saving?"
        message="Your changes to this card will be lost."
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={() => { setAskLeave(false); router.push("/home/cards"); }}
        onCancel={() => setAskLeave(false)}
      />
    </div>
  );
}
