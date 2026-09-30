"use client";
/* ============================================================================
   CLAIM A BLANK QR CARD
   A printed card handed out by the team. Whoever scans it first fills in
   their details, checks the preview and claims it; from then on the same QR
   opens their digital visiting card. There is no login and no edit after
   the claim, so the preview step is the last chance to get it right.

   A company's numbered QR card (`company` is set) works the same way, but
   the company name, logo and colours are the company's and fixed, and the
   card goes live inside the company: afterwards only its admin can edit it.

   The API applies the same rules (services/cardPool.service.js and
   services/companyCardBlanks.service.js).
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import CardPreview from "../../home/cards/CardPreview";
import { THEMES } from "../../home/cards/cardArt";
import { validateCard, emailError } from "../../home/cards/validate";
import BrandFooter from "./BrandFooter";
import styles from "./style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const BRIEF_LIMIT = 30;
const MAX_IMAGE = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EMPTY = {
  name: "", phone: "", email: "", job_title: "", company_name: "", brief: "", linkedin: "",
  custom1_label: "", custom1_value: "", custom1_type: "text",
  custom2_label: "", custom2_value: "", custom2_type: "text",
  theme: "ink",
};

const words = (s = "") => s.trim().split(/\s+/).filter(Boolean).length;

/* Form order, so focus lands on the first field with a problem. */
const ORDER = ["name", "phone", "email", "job_title", "company_name", "brief", "linkedin",
               "custom1_label", "custom1_value", "custom2_label", "custom2_value"];

function ImageField({ id, label, hint, file, onPick, disabled }) {
  const [err, setErr] = useState("");
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.fileRow}>
        <input id={id} type="file" accept={IMAGE_TYPES.join(",")} disabled={disabled}
               onChange={(e) => {
                 const f = e.target.files?.[0] || null;
                 e.target.value = "";
                 setErr("");
                 if (!f) return;
                 if (!IMAGE_TYPES.includes(f.type)) return setErr("Use a JPG, PNG or WebP image");
                 if (f.size > MAX_IMAGE) return setErr("Images must be 2 MB or smaller");
                 onPick(f);
               }} />
        {file && (
          <button type="button" className={styles.linkBtn} disabled={disabled} onClick={() => onPick(null)}>
            Remove {file.name.length > 24 ? `${file.name.slice(0, 22)}…` : file.name}
          </button>
        )}
      </div>
      <p className={err ? styles.fieldError : styles.hint}>{err || hint}</p>
    </div>
  );
}

const STEPS = [["form", "Details"], ["preview", "Preview"], ["done", "Claimed"]];
const COMPANY_STEPS = [["form", "Details"], ["preview", "Preview"], ["done", "Live"]];

/* Dark band with the Haivisitor wordmark, or the company's logo and name on
   a company card, matching the front of the printed card the person has
   just scanned, and where they are in the three steps. */
function Shell({ step, pageRef, company, children }) {
  const steps = company ? COMPANY_STEPS : STEPS;
  const at = steps.findIndex(([key]) => key === step);
  return (
    <div className={styles.claimPage} ref={pageRef}>
      <header className={styles.claimHero}>
        {company ? (
          <div className={styles.brand}>
            {company.logo_url && (
              <img src={`${API}${company.logo_url}`} alt="" className={styles.claimLogo} />
            )}
            <span className={styles.wordmark}>{company.name}</span>
          </div>
        ) : (
          <div className={styles.brand}>
            <span className={styles.brandKicker}>ZODOPT’S</span>
            <span className={styles.wordmark}>H<b>ai</b> Visitor</span>
          </div>
        )}
        <ol className={styles.steps}>
          {steps.map(([key, label], i) => (
            <li key={key} aria-current={i === at ? "step" : undefined} data-done={i < at || undefined}>
              <span className={styles.stepNum}>{i < at ? "✓" : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </header>
      <div className={styles.claimBody}>
        {children}
        <BrandFooter className={styles.footerDark} label="Powered by" />
      </div>
    </div>
  );
}

export default function ClaimCard({ slug, company = null }) {
  const [form, setForm]       = useState(EMPTY);
  const [photo, setPhoto]     = useState(null);
  const [logo, setLogo]       = useState(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors]   = useState({});
  const [step, setStep]       = useState("form");     // form | preview | done
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const firstRender = useRef(true);
  const pageRef = useRef(null);

  // Object URLs for the preview, released when the file changes.
  const photoSrc = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  const ownLogo  = useMemo(() => (logo ? URL.createObjectURL(logo) : ""), [logo]);
  useEffect(() => () => { if (photoSrc) URL.revokeObjectURL(photoSrc); }, [photoSrc]);
  useEffect(() => () => { if (ownLogo) URL.revokeObjectURL(ownLogo); }, [ownLogo]);
  const logoSrc = company ? (company.logo_url ? `${API}${company.logo_url}` : "") : ownLogo;

  /* Each step starts at the top. The page is its own scroll container
     (see .claimPage), so that is what gets scrolled, not the window. */
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    pageRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const set = (f) => (e) => {
    setForm((prev) => ({ ...prev, [f]: e.target.value }));
    if (errors[f]) setErrors((prev) => { const n = { ...prev }; delete n[f]; return n; });
  };

  const briefWords = words(form.brief);
  const cardUrl = typeof window !== "undefined" ? `${window.location.origin}/card/${slug}` : "";
  const previewCard = useMemo(() => ({
    ...form,
    photo_on_print: photo ? 1 : 0,
    ...(company && {
      company_name: company.name,
      theme: company.theme || "ink",
      bg_color: company.bg_color || "",
      text_color: company.text_color || "",
      accent_color: company.accent_color || "",
    }),
  }), [form, photo, company]);

  const toPreview = (e) => {
    e.preventDefault();
    setError("");
    const e2 = validateCard(form, { briefWords, briefLimit: BRIEF_LIMIT });
    // The email is required here: it is how leads reach the owner.
    if (!form.email.trim()) e2.email = "Email is required";
    else if (emailError(form.email)) e2.email = emailError(form.email);
    setErrors(e2);
    const firstBad = ORDER.find((f) => e2[f]);
    if (firstBad) {
      setError("Please fix the highlighted fields.");
      document.getElementById(`c-${firstBad}`)?.focus();
      return;
    }
    setStep("preview");
  };

  const claim = async () => {
    setError("");
    if (!consent) { setError("Please tick the box to agree before claiming."); return; }
    setBusy(true);
    try {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, v);
      body.append("consent", "1");
      if (photo) { body.append("photo", photo); body.append("photo_on_print", "1"); }
      if (logo && !company) body.append("logo", logo);
      const res = await fetch(`${API}/api/public/cards/${slug}/claim`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && /already (have a card|a card in this company)/i.test(data?.message || "")) {
        setDuplicate(true);
        setError(data.message);
        return;
      }
      if (!res.ok) throw new Error(data?.message || "Could not claim this card.");
      setStep("done");
    } catch (err) {
      setError(err.message || "Could not claim this card. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const input = (f, label, props = {}) => (
    <div className={styles.field}>
      <label htmlFor={`c-${f}`}>{label}</label>
      <input id={`c-${f}`} value={form[f]} onChange={set(f)} disabled={busy}
             aria-invalid={!!errors[f]} aria-describedby={errors[f] ? `c-${f}-err` : undefined} {...props} />
      {errors[f] && <p id={`c-${f}-err`} className={styles.fieldError}>{errors[f]}</p>}
    </div>
  );

  if (step === "done") {
    return (
      <Shell step="done" pageRef={pageRef} company={company}>
        <div className={styles.share}>
          <div className={styles.sent} role="status">
            <svg className={styles.sentIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            <div>
              <p className={styles.sentTitle}>{company ? "Your card is live" : "This card is yours"}</p>
              <p>
                We have emailed your card, its QR and images of both sides to {form.email}.
                Anyone who scans this card now sees your details.
                {company && " To change anything later, ask your admin."}
              </p>
            </div>
          </div>
          <button type="button" className={styles.shareBtn} style={{ marginTop: 18 }}
                  onClick={() => window.location.reload()}>
            View my card
          </button>
        </div>
      </Shell>
    );
  }

  if (step === "preview") {
    return (
      <Shell step="preview" pageRef={pageRef} company={company}>
        <div className={styles.share}>
          <h1 className={styles.shareTitle}>Check your card</h1>
          <p className={styles.shareSub}>
            {company
              ? "This is how your card looks. Once it is live only your admin can change it, so check every detail."
              : "This is how your card looks. Once claimed it cannot be changed, so check every detail."}
          </p>
          {/* Full print resolution: at the editor's smaller scale the
              canvas is upscaled on a phone's dense screen and looks soft. */}
          <CardPreview card={previewCard} cardUrl={cardUrl} logoSrc={logoSrc} photoSrc={photoSrc} scale={1} />

          <label className={styles.consent}>
            <input type="checkbox" checked={consent} disabled={busy}
                   onChange={(e) => { setConsent(e.target.checked); setError(""); }} />
            {company ? (
              <span>
                I agree that these details are shown to anyone who scans this card, and that
                Haivisitor may email me about people who share their details with me.
              </span>
            ) : (
              <span>
                I agree that these details are shown to anyone who scans this card, and that
                Haivisitor may email me about people who share their details with me and about
                Haivisitor plans.
              </span>
            )}
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {duplicate && (
            <p className={styles.hint}>
              {company
                ? "Each person can have one card in the company. Pass this one on to a colleague, or ask your admin."
                : "Each person can claim one card. Pass this one on to someone else."}
            </p>
          )}

          <button type="button" className={styles.shareBtn} onClick={claim} disabled={busy || duplicate}>
            {busy ? (company ? "Saving…" : "Claiming…") : (company ? "Make my card live" : "Claim this card")}
          </button>
          <button type="button" className={styles.cancelBtn} disabled={busy}
                  onClick={() => { setStep("form"); setError(""); setDuplicate(false); }}>
            Back to edit
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell step="form" pageRef={pageRef} company={company}>
      <form className={styles.share} onSubmit={toPreview} noValidate>
        <h1 className={styles.shareTitle}>Make this card yours</h1>
        <p className={styles.shareSub}>
          {company
            ? `This is your ${company.name || "company"} QR card. Add your details and it becomes your digital
               visiting card straight away. Anyone who scans it can save your contact or share theirs with you.`
            : `This QR card has not been claimed yet. Add your details and it becomes your digital
               visiting card. Anyone who scans it can save your contact or share theirs with you.`}
        </p>

        <p className={styles.group}>Required</p>
        {input("name", "Your name *", { autoComplete: "name", maxLength: 120, placeholder: "Your full name" })}
        {input("phone", "Phone *", { type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 20, placeholder: "+91 XXXXX 34567" })}
        {input("email", "Email *", { type: "email", autoComplete: "email", maxLength: 190, placeholder: "yourname@company.com" })}

        <p className={styles.group}>Optional</p>
        {input("job_title", "Job title", { autoComplete: "organization-title", maxLength: 120, placeholder: "Your designation" })}
        {!company && input("company_name", "Company", { autoComplete: "organization", maxLength: 160, placeholder: "Your company name" })}

        <div className={styles.field}>
          <label htmlFor="c-brief">About you</label>
          <textarea id="c-brief" rows={3} value={form.brief} onChange={set("brief")} disabled={busy}
                    maxLength={400} aria-invalid={!!errors.brief}
                    placeholder="A line or two about what you do" />
          <p className={errors.brief || briefWords > BRIEF_LIMIT ? styles.fieldError : styles.hint}>
            {errors.brief || (briefWords > BRIEF_LIMIT
              ? `${briefWords} words — keep it to ${BRIEF_LIMIT} or fewer`
              : `Up to ${BRIEF_LIMIT} words`)}
          </p>
        </div>

        {input("linkedin", "LinkedIn", { inputMode: "url", maxLength: 255, placeholder: "linkedin.com/in/yourname" })}

        {[1, 2].map((n) => (
          <div className={styles.customRow} key={n}>
            {input(`custom${n}_label`, `Extra field ${n} — label`, { maxLength: 60, placeholder: n === 1 ? "Website" : "Office" })}
            {input(`custom${n}_value`, "Value", { maxLength: 255, placeholder: n === 1 ? "www.yourcompany.com" : "Your office address" })}
            <label className={styles.checkLine}>
              <input type="checkbox" checked={form[`custom${n}_type`] === "link"} disabled={busy}
                     onChange={(e) => setForm((p) => ({ ...p, [`custom${n}_type`]: e.target.checked ? "link" : "text" }))} />
              This is a web link
            </label>
          </div>
        ))}

        <ImageField id="c-photo" label="Your photo" hint="JPG, PNG or WebP, up to 2 MB. Printed on the card and shown on the web page."
                    file={photo} onPick={setPhoto} disabled={busy} />
        {!company && (
          <ImageField id="c-logo" label="Company logo" hint="JPG, PNG or WebP, up to 2 MB."
                      file={logo} onPick={setLogo} disabled={busy} />
        )}

        {!company && <div className={styles.field}>
          <span className={styles.groupLabel}>Colour</span>
          <div className={styles.themes} role="radiogroup" aria-label="Card colour">
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} type="button" role="radio" aria-checked={form.theme === key}
                      className={styles.themeChip} disabled={busy} title={t.label}
                      style={{ background: t.bg, color: t.fg, outlineColor: t.accent }}
                      onClick={() => setForm((p) => ({ ...p, theme: key }))}>
                <span style={{ background: t.accent }} aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
        </div>}

        {error && <p className={styles.error} role="alert">{error}</p>}

        <button type="submit" className={styles.shareBtn} disabled={busy}>Preview my card</button>
      </form>
    </Shell>
  );
}
