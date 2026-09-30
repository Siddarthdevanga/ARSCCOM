"use client";
/* ============================================================================
   PUBLIC DIGITAL VISITING CARD
   Opened by a stranger who has just scanned a QR, almost always on a phone,
   often on a stand with poor signal and while still talking to the person
   whose card it is.

   That shapes the whole page: the name and the three actions are above the
   fold, the share-back form sits underneath rather than in front of the
   content, and nothing here requires an account.
   ========================================================================== */
import { useEffect, useRef, useState, use } from "react";
import { THEMES, resolveColors, onColor } from "../../home/cards/cardArt";
import { phoneError, emailError } from "../../home/cards/validate";
import ClaimCard from "./ClaimCard";
import BrandFooter from "./BrandFooter";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Digits only for wa.me. Indian numbers are stored either bare or with a
   country code; ten digits means the code is missing. */
const waNumber = (phone = "") => {
  const s = String(phone).trim();
  const d = s.replace(/\D/g, "");
  if (s.startsWith("+")) return d;              // already has its country code
  const local = d.replace(/^0/, "");            // 0-prefixed trunk form, e.g. 074062 08011
  return local.length === 10 ? `91${local}` : d;
};

/* a → b by t (0..1), for #rrggbb. */
const mixHex = (a, b, t) => {
  const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const c = [1, 3, 5].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const withProtocol = (url = "") =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

function Icon({ d, ...p }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {d}
    </svg>
  );
}

export default function DigitalCardPage({ params }) {
  const { slug } = use(params);

  const [card, setCard]       = useState(null);
  const [state, setState]     = useState("loading");  // loading | ready | missing | unavailable | unclaimed
  const [form, setForm]       = useState({ name: "", phone: "", email: "", company_name: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const nameRef = useRef(null);

  // Focus the first field once the form is on screen, not before.
  useEffect(() => { if (shareOpen) nameRef.current?.focus(); }, [shareOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/public/cards/${slug}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data?.card)        return setState("missing");
        if (data.card.unavailable)         { setCard(data.card); return setState("unavailable"); }
        if (data.card.unclaimed)           return setState("unclaimed");
        setCard(data.card);
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Please add your name and phone number.");
      return;
    }
    // A lead the card owner cannot call or email back is no lead at all.
    const bad = phoneError(form.phone) ? { f: "lp", msg: phoneError(form.phone) }
      : emailError(form.email) ? { f: "le", msg: emailError(form.email) } : null;
    if (bad) {
      setError(`${bad.msg}.`);
      document.getElementById(bad.f)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/api/public/cards/${slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not share your details.");
      setSent(true);
    } catch (err) {
      setError(err.message || "Could not share your details. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (state === "loading") {
    return <div className={styles.centre}><div className={styles.spinner} /></div>;
  }

  // A blank QR card from the printed pool: its page is the claim form.
  if (state === "unclaimed") return <ClaimCard slug={slug} />;

  if (state === "missing" || state === "unavailable") {
    return (
      <div className={styles.centre}>
        <div className={styles.notice}>
          <h1>{card?.expired ? "This card has expired" : "Digital card not available"}</h1>
          <p>
            {state === "missing"
              ? "This card could not be found. The link may be incorrect."
              : card?.expired
              ? "The plan behind this card has ended, so its details are no longer shown."
              : card?.company_name
              ? `This card is not active right now. You can still reach ${card.company_name} directly.`
              : "This card is no longer active."}
          </p>
          <BrandFooter className={styles.noticeFooter} />
        </div>
      </div>
    );
  }

  /* Same resolver as the printed card, so web and print always agree —
     preset first, then any admin override on top. */
  const colors = resolveColors(card);
  const preset = THEMES[card.theme] || THEMES.ink;
  const themeVars = {
    "--card-bg": colors.bg,
    "--card-fg": colors.fg,
    "--card-accent": colors.accent,
    "--card-on-accent": onColor(colors.accent),
    // A custom background gets a backdrop in the same family, dark or light.
    // Mixed here rather than with CSS color-mix, which older phones ignore.
    background: card.bg_color ? mixHex(colors.bg, onColor(colors.bg) === "#ffffff" ? "#000000" : "#888888", 0.18) : preset.page,
  };

  const first = card.name?.trim().split(/\s+/)[0] || "They";

  return (
    <div className={styles.page} style={themeVars}>
      <div className={styles.card}>

        <div className={styles.head}>
          {card.company_logo_url && (
            <img src={`${API}${card.company_logo_url}`} alt="" className={styles.companyLogo}
                 onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}

          {card.photo_url
            ? <img src={card.photo_url.startsWith("/") ? `${API}${card.photo_url}` : card.photo_url}
                   alt="" className={styles.photo}
                   onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            : <div className={styles.initials} aria-hidden="true">
                {(card.name || "?").trim().charAt(0).toUpperCase()}
              </div>}

          <h1 className={styles.name}>{card.name}</h1>
          {card.job_title && <p className={styles.role}>{card.job_title}</p>}
          {card.company_name && <p className={styles.org}>{card.company_name}</p>}
        </div>

        {/* The three things someone actually came here to do. */}
        <div className={styles.actions}>
          <a className={styles.primaryAction} href={`${API}/api/public/cards/${slug}/vcard`}>
            <Icon className={styles.actionIcon} d={<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
            Save Contact
          </a>

          <a className={styles.action} href={`https://wa.me/${waNumber(card.whatsapp)}`}
             target="_blank" rel="noopener noreferrer">
            <Icon className={styles.actionIcon} d={<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l2-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />} />
            WhatsApp
          </a>

          <a className={styles.action} href={`tel:${card.phone}`}>
            <Icon className={styles.actionIcon} d={<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />} />
            Call
          </a>
        </div>

        {card.brief && <p className={styles.brief}>{card.brief}</p>}

        <dl className={styles.details}>
          {card.email && (
            <div className={styles.detailRow}>
              <dt>Email</dt>
              <dd><a href={`mailto:${card.email}`}>{card.email}</a></dd>
            </div>
          )}
          <div className={styles.detailRow}>
            <dt>Phone</dt>
            <dd><a href={`tel:${card.phone}`}>{card.phone}</a></dd>
          </div>
          {card.linkedin && (
            <div className={styles.detailRow}>
              <dt>LinkedIn</dt>
              <dd>
                <a href={withProtocol(card.linkedin)} target="_blank" rel="noopener noreferrer">
                  View profile
                </a>
              </dd>
            </div>
          )}
          {card.custom.map((c, i) => (
            <div className={styles.detailRow} key={i}>
              <dt>{c.label}</dt>
              <dd>
                {c.type === "link"
                  ? <a href={withProtocol(c.value)} target="_blank" rel="noopener noreferrer">{c.value}</a>
                  : c.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Below the card, never in front of it: a form between someone and
          the content they scanned for is the fastest way to lose them. It
          stays folded behind one button until they ask for it. */}
      <div className={styles.share}>
        {sent ? (
          <div className={styles.sent} role="status">
            <Icon className={styles.sentIcon} d={<path d="M20 6 9 17l-5-5" />} />
            <div>
              <p className={styles.sentTitle}>Thank you!</p>
              <p>{first} has your details and will be in touch.</p>
            </div>
          </div>
        ) : !shareOpen ? (
          <div className={styles.shareIntro}>
            <p className={styles.shareTitle}>Want {first} to reach you?</p>
            <p className={styles.shareSub}>Share your name and number — it takes a few seconds.</p>
            <button type="button" className={styles.shareBtn} onClick={() => setShareOpen(true)}>
              Share my details
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 className={styles.shareTitle}>Share your details</h2>
            <p className={styles.shareSub}>So {first} can reach you.</p>

            <div className={styles.field}>
              <label htmlFor="ln">Your name *</label>
              <input id="ln" ref={nameRef} value={form.name} disabled={sending} autoComplete="name" maxLength={120}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lp">Phone *</label>
              <input id="lp" type="tel" inputMode="tel" value={form.phone} disabled={sending} maxLength={20}
                     placeholder="98765 43210" aria-invalid={!!error && !!phoneError(form.phone)}
                     autoComplete="tel"
                     onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="le">Email</label>
              <input id="le" type="email" value={form.email} disabled={sending} autoComplete="email" maxLength={190}
                     aria-invalid={!!error && !!emailError(form.email)}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lc">Company</label>
              <input id="lc" value={form.company_name} disabled={sending} autoComplete="organization" maxLength={160}
                     onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lm">What would you like to discuss?</label>
              <textarea id="lm" rows={3} value={form.message} disabled={sending} maxLength={2000}
                        onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button type="submit" className={styles.shareBtn} disabled={sending}>
              {sending ? "Sharing…" : "Share my details"}
            </button>
            <button type="button" className={styles.cancelBtn} disabled={sending}
                    onClick={() => { setShareOpen(false); setError(""); }}>
              Not now
            </button>
          </form>
        )}
      </div>

      <BrandFooter className={styles.footer} />
    </div>
  );
}
