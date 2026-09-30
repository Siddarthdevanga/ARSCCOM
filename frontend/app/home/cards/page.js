"use client";
/* ============================================================================
   DIGITAL VISITING CARDS — ADMIN
   The company admin creates and maintains a card per employee. Deactivating
   keeps a card's printed QR resolving; deleting removes the card, its
   scans for good, keeping its contacts and its filled-in details on
   record, and frees the slot.

   Plan allowance is shown at all times rather than surfaced as an error on
   save — being told you are out of cards after filling in a form is the
   wrong moment to find out.

   Empty QR cards: the admin generates numbered cards up to the free slots,
   prints the sheet and hands them out; each employee scans theirs and fills
   it in. A filled one can be reset to empty for the next person.
   ========================================================================== */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft, Plus, Search, QrCode, Power, Lock, Unlock, Pencil, X,
  Download, Users, Eye, MessageSquare, Trash2, RotateCcw, Printer,
} from "lucide-react";
import { restoreSession, SESSION } from "../../utils/session";
import LockedModule from "../../components/LockedModule";
import { takeFlash } from "./CardEditor";
import { THEMES } from "./cardArt";
import BlankCardPreview from "./BlankCardPreview";
import CardsGuide, { GuideButton } from "./CardsGuide";
import styles from "./style.module.css";

const API  = process.env.NEXT_PUBLIC_API_BASE_URL;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

const cardUrl = (slug) => `${SITE}/card/${slug}`;

const THEME_LIST = Object.entries(THEMES).map(([key, t]) => ({ key, ...t }));
const NEW_BATCH = { quantity: 1, theme: "ink", bg_color: "", text_color: "", accent_color: "" };

/* A card's display name: an empty QR card has no one's name yet. */
const titleOf = (card) => card.name || `Card ${card.number || ""}`.trim();

export default function CardsPage() {
  const router = useRouter();

  const [cards, setCards]   = useState([]);
  const [usage, setUsage]   = useState({ used: 0, limit: 0, remaining: 0 });
  const [company, setCompany] = useState({ name: "", logo_url: null });
  const [guideOpen, setGuideOpen] = useState(false);
  const [loading, setLoad]  = useState(true);
  const [query, setQuery]   = useState("");
  const [toast, setToast]   = useState(null);

  const [expired, setExpired] = useState(false);
  const [qrFor, setQrFor]   = useState(null);
  const [qrData, setQrData] = useState("");

  const [gen, setGen]         = useState(null);    // the Generate form, or null when closed
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenErr] = useState("");
  const [made, setMade]       = useState(null);    // { ids, from, to } after generating
  const [printing, setPrinting] = useState(false);

  const say = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cards`, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
      if (!res.ok) throw new Error(data?.message || "Could not load cards");
      setCards(data.cards || []);
      setUsage(data.usage || { used: 0, limit: 0, remaining: 0 });
      setCompany(data.company || { name: "", logo_url: null });
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
      if (status === SESSION.OFFLINE) { setLoad(false); say("You appear to be offline. Try again shortly.", "error"); return; }
      load();
      const flash = takeFlash();
      if (flash) say(flash);
    })();
  }, [load, router]);

  const openNew = () => {
    if (usage.remaining <= 0) {
      say(`Your plan allows ${usage.limit} active card${usage.limit === 1 ? "" : "s"}. Deactivate one first.`, "error");
      return;
    }
    router.push("/home/cards/new");
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
      if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
      if (!res.ok) throw new Error(data?.message || "Could not update the card");
      say(okMsg);
      load();
    } catch (err) {
      say(err.message, "error");
    }
  };

  /* ── Empty QR cards ── */
  const openGenerate = () => {
    if (usage.remaining <= 0) {
      say(`All ${usage.limit} card slot${usage.limit === 1 ? "" : "s"} on your plan are in use. Deactivate or delete one first.`, "error");
      return;
    }
    setGen({ ...NEW_BATCH });
    setGenErr("");
    setMade(null);
  };
  const closeGenerate = () => { if (!genBusy && !printing) { setGen(null); setMade(null); } };

  const generate = async (e) => {
    e.preventDefault();
    const q = Number(gen.quantity);
    if (!Number.isInteger(q) || q < 1 || q > usage.remaining) {
      setGenErr(`Choose between 1 and ${usage.remaining}.`);
      return;
    }
    setGenBusy(true);
    setGenErr("");
    try {
      const res = await fetch(`${API}/api/cards/blank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...gen, quantity: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
      if (!res.ok) throw new Error(data?.message || "Could not generate the cards");
      setMade({ ids: data.ids || [], from: data.from, to: data.to });
      load();
    } catch (err) {
      setGenErr(err.message);
    } finally {
      setGenBusy(false);
    }
  };

  /* The A4 print sheet, as a download. `ids` narrows it to some cards. */
  const printSheet = async (ids = null) => {
    if (printing) return;
    setPrinting(true);
    try {
      const qs = ids?.length ? `?ids=${ids.join(",")}` : "";
      const res = await fetch(`${API}/api/cards/blank/print${qs}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
        throw new Error(data?.message || "Could not create the print sheet");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-cards.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      say(err.message, "error");
    } finally {
      setPrinting(false);
    }
  };

  const removeCard = async (card) => {
    const question = card.blank
      ? `Delete empty card ${card.number}? Its printed QR will stop working, and the slot is freed.`
      : `Delete ${titleOf(card)}'s card for good?

` +
        "Its link and QR stop working and its scans are deleted. Its contacts stay in Card Contacts, " +
        "marked as from a deleted card, and the details filled in on the card are kept on record. " +
        "One slot on your plan is freed. This cannot be undone.";
    if (!window.confirm(question)) return;
    try {
      const res = await fetch(`${API}/api/cards/${card.id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
      if (!res.ok) throw new Error(data?.message || "Could not delete the card");
      say(`${card.blank ? `Card ${card.number}` : `${titleOf(card)}'s card`} deleted.`);
      load();
    } catch (err) {
      say(err.message, "error");
    }
  };

  const resetCard = async (card) => {
    if (!window.confirm(
      `Reset card ${card.number} for someone new?\n\n${card.name}'s details come off it and the same printed QR ` +
      "can be filled in again. Their contacts and scans are kept, on an inactive copy of the card."
    )) return;
    try {
      const res = await fetch(`${API}/api/cards/${card.id}/reset`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
      if (!res.ok) throw new Error(data?.message || "Could not reset the card");
      say(`Card ${card.number} is empty again.`);
      load();
    } catch (err) {
      say(err.message, "error");
    }
  };

  const showQr = async (card) => {
    setQrData("");   // never show or download the previous card's QR
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
    return [c.name, c.job_title, c.email, c.phone, c.company_name, c.number]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  const blanks = cards.filter((c) => c.blank && c.is_active && !c.is_locked).length;
  const genColours = THEMES[gen?.theme] || THEMES.ink;
  const companyLogo = company.logo_url ? `${API}${company.logo_url}` : "";
  // Only the colours: typing a quantity must not redraw the preview.
  const genCard = useMemo(
    () => ({ theme: gen?.theme, bg_color: gen?.bg_color, text_color: gen?.text_color, accent_color: gen?.accent_color }),
    [gen?.theme, gen?.bg_color, gen?.text_color, gen?.accent_color]
  );
  const genOverride = !!(gen?.bg_color || gen?.text_color || gen?.accent_color);

  if (expired) return <LockedModule moduleName="Digital Cards" />;
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
          <GuideButton open={guideOpen} onClick={() => setGuideOpen((o) => !o)} />
          <button className={styles.ghostBtn} onClick={() => router.push("/home/cards/leads")}>
            <MessageSquare size={15} /><span>Card Contacts</span>
          </button>
          <button className={styles.ghostBtn} onClick={() => router.push("/home")}>
            <ArrowLeft size={15} /><span>Back</span>
          </button>
        </div>
      </header>

      <CardsGuide page="list" open={guideOpen} onClose={() => setGuideOpen(false)} />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input className={styles.search} type="search" value={query}
                   placeholder="Search by name, title, email or phone…"
                   onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className={styles.toolbarBtns}>
            {blanks > 0 && (
              <button className={styles.ghostBtn} onClick={() => printSheet()} disabled={printing}
                      title="Download the A4 print sheet of every empty card">
                <Printer size={15} /> {printing ? "Preparing…" : `Print empty (${blanks})`}
              </button>
            )}
            <button className={styles.ghostBtn} onClick={openGenerate}
                    title="Numbered QR cards to hand out; each employee fills in their own">
              <QrCode size={15} /> Generate QR cards
            </button>
            <button className={styles.primaryBtn} onClick={openNew}>
              <Plus size={16} /> New Card
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Users size={26} />
            <p>{query.trim() ? "No cards match that search."
              : "No cards yet. Create one for a member of your team, or generate QR cards for your team to fill in themselves."}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((card) => (
              <article key={card.id}
                       className={`${styles.cardTile} ${!card.is_active || card.is_locked ? styles.tileOff : ""}`}>
                <div className={styles.tileHead}>
                  {card.photo_preview
                    ? <img src={card.photo_preview} alt="" className={`${styles.avatar} ${styles.avatarImg}`} />
                    : <span className={`${styles.avatar} ${card.blank ? styles.avatarBlank : ""}`} aria-hidden="true">
                        {card.blank ? card.number : (card.name || "?").trim().charAt(0).toUpperCase()}
                      </span>}
                  <div className={styles.tileWho}>
                    <h2>{titleOf(card)}</h2>
                    {card.blank
                      ? <p>Waiting for an employee to scan and fill in</p>
                      : (card.number || card.job_title) && (
                          <p>{[card.number, card.job_title].filter(Boolean).join(" · ")}</p>
                        )}
                  </div>
                  {card.is_locked
                    ? <span className={`${styles.tag} ${styles.tagLocked}`}>Locked</span>
                    : !card.is_active
                      ? <span className={styles.tag}>Inactive</span>
                      : card.blank
                        ? <span className={`${styles.tag} ${styles.tagBlank}`}>Empty</span>
                        : null}
                </div>

                <div className={styles.tileStats}>
                  <span><Eye size={13} /> {card.scan_count} scan{card.scan_count === 1 ? "" : "s"}</span>
                  <span><MessageSquare size={13} /> {card.lead_count} contact{card.lead_count === 1 ? "" : "s"}</span>
                </div>

                <div className={styles.tileActions}>
                  <button onClick={() => showQr(card)} title="QR code"><QrCode size={15} /></button>
                  <button onClick={() => router.push(`/home/cards/${card.id}`)} disabled={!!card.is_locked}
                          title={card.blank ? "Fill in yourself" : "Edit"}>
                    <Pencil size={15} />
                  </button>
                  {card.number && !card.blank && (
                    <button onClick={() => resetCard(card)} disabled={!!card.is_locked} title="Reset to empty for someone new">
                      <RotateCcw size={15} />
                    </button>
                  )}
                  <button onClick={() => removeCard(card)} title="Delete (frees the slot)">
                    <Trash2 size={15} />
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

      {/* ── QR ── */}
      {qrFor && (
        <div className={styles.overlay} onClick={() => setQrFor(null)} role="presentation">
          <div className={`${styles.modal} ${styles.qrModal}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <h2>{titleOf(qrFor)}</h2>
              <button onClick={() => setQrFor(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className={styles.qrBody}>
              {qrFor.blank && (
                <div className={styles.blankPreview}>
                  <BlankCardPreview companyName={company.name} logoSrc={companyLogo} card={qrFor}
                                    cardUrl={cardUrl(qrFor.slug)} side />
                </div>
              )}
              {qrData
                ? <img src={qrData} alt={`QR code for ${titleOf(qrFor)}`} className={styles.qrImg} />
                : <div className={styles.spinner} />}
              <p className={styles.qrUrl}>{cardUrl(qrFor.slug)}</p>
              <div className={styles.qrActions}>
                <a className={styles.primaryBtn} href={qrData || undefined} download={`${qrFor.slug}-qr.png`}
                   aria-disabled={!qrData} onClick={(e) => { if (!qrData) e.preventDefault(); }}>
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

      {/* ── Generate empty QR cards ── */}
      {gen && (
        <div className={styles.overlay} onClick={closeGenerate} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
               aria-labelledby="gen-title">
            <div className={styles.modalHead}>
              <h2 id="gen-title">{made ? "QR cards ready" : "Generate QR cards"}</h2>
              <button onClick={closeGenerate} aria-label="Close" disabled={genBusy || printing}><X size={16} /></button>
            </div>

            {made ? (
              <div className={styles.form}>
                <p className={styles.genNote}>
                  {made.from === made.to ? `Card #${made.from} is` : `Cards #${made.from} to #${made.to} are`} ready.
                  Download the print sheet, print it on card stock (front and back side by side) and hand the
                  cards out. Whoever scans a card first fills in their details, and the card goes live straight away.
                </p>
                <div className={styles.formActions}>
                  <button type="button" className={styles.ghostBtn} onClick={closeGenerate} disabled={printing}>Done</button>
                  <button type="button" className={styles.primaryBtn} onClick={() => printSheet(made.ids)} disabled={printing}>
                    <Printer size={15} /> {printing ? "Preparing…" : "Download print sheet"}
                  </button>
                </div>
              </div>
            ) : (
              <form className={styles.form} onSubmit={generate} noValidate>
                <p className={styles.genNote}>
                  Each card gets its own number and QR. Hand them out, and each employee scans theirs and fills in
                  their own details. Your company name and logo are on every card. Each card uses one slot on your
                  plan from now, filled in or not.
                </p>

                <div className={styles.field}>
                  <label htmlFor="gen-q">How many <span className={styles.opt}>{usage.remaining} free slot{usage.remaining === 1 ? "" : "s"}</span></label>
                  <input id="gen-q" type="number" inputMode="numeric" min={1} max={usage.remaining}
                         value={gen.quantity} disabled={genBusy}
                         onChange={(e) => setGen({ ...gen, quantity: e.target.value })} />
                </div>

                <div className={styles.field}>
                  <label>Card colours</label>
                  <div className={styles.themes}>
                    {THEME_LIST.map((t) => (
                      <button type="button" key={t.key} disabled={genBusy}
                              className={`${styles.theme} ${gen.theme === t.key && !genOverride ? styles.themeOn : ""}`}
                              onClick={() => setGen({ ...gen, theme: t.key, bg_color: "", text_color: "", accent_color: "" })}>
                        <span style={{ background: `linear-gradient(135deg, ${t.bg} 62%, ${t.accent} 62%)` }} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <div className={styles.colourHead}>
                    <label htmlFor="g-bg">Your own colours <span className={styles.opt}>optional</span></label>
                    {genOverride && (
                      <button type="button" className={styles.clearColours}
                              onClick={() => setGen({ ...gen, bg_color: "", text_color: "", accent_color: "" })}>
                        Reset to theme
                      </button>
                    )}
                  </div>
                  <div className={styles.colours}>
                    {[
                      ["bg_color",     "Background", "g-bg", "bg"],
                      ["text_color",   "Text",       "g-fg", "fg"],
                      ["accent_color", "Accent",     "g-ac", "accent"],
                    ].map(([key, label, id, preset]) => (
                      <label key={key} className={styles.colour} htmlFor={id}>
                        <input id={id} type="color" disabled={genBusy}
                               value={gen[key] || genColours[preset]}
                               onChange={(e) => setGen({ ...gen, [key]: e.target.value })} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Preview <span className={styles.opt}>as printed; each card gets its own QR</span></label>
                  <BlankCardPreview companyName={company.name} logoSrc={companyLogo} card={genCard}
                                    cardUrl={`${SITE}/card/preview`} side />
                </div>

                {genError && <p className={styles.formError} role="alert">{genError}</p>}

                <div className={styles.formActions}>
                  <button type="button" className={styles.ghostBtn} onClick={closeGenerate} disabled={genBusy}>Cancel</button>
                  <button type="submit" className={styles.primaryBtn} disabled={genBusy}>
                    <QrCode size={15} /> {genBusy ? "Generating…" : "Generate"}
                  </button>
                </div>
              </form>
            )}
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
