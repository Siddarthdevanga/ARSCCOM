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
import { useEffect, useState, use } from "react";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Digits only for wa.me. Indian numbers are stored either bare or with a
   country code; ten digits means the code is missing. */
const waNumber = (phone = "") => {
  const d = String(phone).replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
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
  const [state, setState]     = useState("loading");  // loading | ready | missing | unavailable
  const [form, setForm]       = useState({ name: "", phone: "", email: "", company_name: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/public/cards/${slug}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data?.card)        return setState("missing");
        if (data.card.unavailable)         { setCard(data.card); return setState("unavailable"); }
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

  if (state === "missing" || state === "unavailable") {
    return (
      <div className={styles.centre}>
        <div className={styles.notice}>
          <h1>Details not available</h1>
          <p>
            {state === "unavailable" && card?.company_name
              ? `This card is no longer active. You can still reach ${card.company_name} directly.`
              : "This card could not be found. The link may be incorrect."}
          </p>
        </div>
      </div>
    );
  }

  /* An admin override wins over the preset theme; the preset is a class. */
  const themeVars = {
    ...(card.bg_color     ? { "--card-bg": card.bg_color } : {}),
    ...(card.text_color   ? { "--card-fg": card.text_color } : {}),
    ...(card.accent_color ? { "--card-accent": card.accent_color } : {}),
  };

  return (
    <div className={`${styles.page} ${styles[`theme_${card.theme}`] || styles.theme_ink}`} style={themeVars}>
      <div className={styles.card}>

        <div className={styles.head}>
          {card.company_logo_url && (
            <img src={`${API}${card.company_logo_url}`} alt="" className={styles.companyLogo}
                 onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}

          {card.photo_url
            ? <img src={card.photo_url} alt="" className={styles.photo} />
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
          the content they scanned for is the fastest way to lose them. */}
      <div className={styles.share}>
        {sent ? (
          <div className={styles.sent}>
            <Icon className={styles.sentIcon} d={<path d="M20 6 9 17l-5-5" />} />
            <p><strong>Thanks.</strong> {card.name?.split(" ")[0] || "They"} has your details.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 className={styles.shareTitle}>Share your details back</h2>
            <p className={styles.shareSub}>Optional — so {card.name?.split(" ")[0] || "they"} can reach you.</p>

            <div className={styles.field}>
              <label htmlFor="ln">Your name *</label>
              <input id="ln" value={form.name} disabled={sending} autoComplete="name"
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lp">Phone *</label>
              <input id="lp" type="tel" inputMode="numeric" value={form.phone} disabled={sending}
                     autoComplete="tel"
                     onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="le">Email</label>
              <input id="le" type="email" value={form.email} disabled={sending} autoComplete="email"
                     onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lc">Company</label>
              <input id="lc" value={form.company_name} disabled={sending} autoComplete="organization"
                     onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lm">What would you like to discuss?</label>
              <textarea id="lm" rows={3} value={form.message} disabled={sending}
                        onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button type="submit" className={styles.shareBtn} disabled={sending}>
              {sending ? "Sharing…" : "Share my details"}
            </button>
          </form>
        )}
      </div>

      <p className={styles.footer}>Digital card by Hai Visitor</p>
    </div>
  );
}
