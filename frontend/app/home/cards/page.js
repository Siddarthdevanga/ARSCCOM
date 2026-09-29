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
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft, Plus, Search, QrCode, Power, Lock, Unlock, Pencil, X,
  Download, Users, Eye, MessageSquare,
} from "lucide-react";
import { restoreSession, SESSION } from "../../utils/session";
import LockedModule from "../../components/LockedModule";
import { takeFlash } from "./CardEditor";
import styles from "./style.module.css";

const API  = process.env.NEXT_PUBLIC_API_BASE_URL;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

const cardUrl = (slug) => `${SITE}/card/${slug}`;

export default function CardsPage() {
  const router = useRouter();

  const [cards, setCards]   = useState([]);
  const [usage, setUsage]   = useState({ used: 0, limit: 0, remaining: 0 });
  const [loading, setLoad]  = useState(true);
  const [query, setQuery]   = useState("");
  const [toast, setToast]   = useState(null);

  const [expired, setExpired] = useState(false);
  const [qrFor, setQrFor]   = useState(null);
  const [qrData, setQrData] = useState("");

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
                  {card.photo_preview
                    ? <img src={card.photo_preview} alt="" className={`${styles.avatar} ${styles.avatarImg}`} />
                    : <span className={styles.avatar} aria-hidden="true">
                        {(card.name || "?").trim().charAt(0).toUpperCase()}
                      </span>}
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
                  <button onClick={() => router.push(`/home/cards/${card.id}`)} disabled={!!card.is_locked} title="Edit">
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
