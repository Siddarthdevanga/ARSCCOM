"use client";
/* ============================================================================
   CARD LEADS
   People who scanned a digital visiting card and chose to share their own
   details back. These are never deleted — the export is how a company gets
   them out, and deleting a card must not take its leads with it.

   The list is ordered newest first because the only question anyone opens
   this screen with is "who do I need to call back".
   ========================================================================== */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Download, MessageSquare, Phone } from "lucide-react";
import { restoreSession, SESSION } from "../../../utils/session";
import LockedModule from "../../../components/LockedModule";
import styles from "../style.module.css";
import own from "./leads.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

const waNumber = (phone = "") => {
  const d = String(phone).replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export default function CardLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [expired, setExpired] = useState(false);

  const say = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cards/leads/all`, { credentials: "include" });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.status === "expired") { setExpired(true); return; }
      if (!res.ok) throw new Error(data?.message || "Could not load leads");
      setLeads(data.leads || []);
    } catch (e) {
      say(e.message || "Could not load leads", "error");
    } finally {
      setLoading(false);
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

  const exportLeads = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API}/api/exports/card-leads`, { credentials: "include" });
      if (res.status === 403) { setExpired(true); return; }
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const match = cd?.match(/filename="(.+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] || `card-leads-${Date.now()}.xlsx`;
      a.click();
      // Revoking synchronously can cancel the download in Safari.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("Card leads exported.");
    } catch {
      say("Export failed. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const filtered = leads.filter((l) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [l.name, l.phone, l.email, l.company_name, l.card_owner_name, l.message]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  if (expired) return <LockedModule moduleName="Card Leads" />;
  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Card Leads</h1>
          <span className={styles.usage}><strong>{leads.length}</strong> total</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.ghostBtn} onClick={exportLeads} disabled={exporting || leads.length === 0}>
            <Download size={15} /><span>{exporting ? "Exporting…" : "Export"}</span>
          </button>
          <button className={styles.ghostBtn} onClick={() => router.push("/home/cards")}>
            <ArrowLeft size={15} /><span>Back</span>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input className={styles.search} type="search" value={query}
                   placeholder="Search name, phone, company or card owner…"
                   onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <MessageSquare size={26} />
            <p>
              {query.trim()
                ? "No leads match that search."
                : "No one has shared their details yet. They appear here when someone scans a card and fills in the form."}
            </p>
          </div>
        ) : (
          <div className={own.list}>
            {filtered.map((lead) => (
              <article key={lead.id} className={own.lead}>
                <div className={own.leadHead}>
                  <div className={own.who}>
                    <h2>{lead.name}</h2>
                    <p>{[lead.company_name, lead.email].filter(Boolean).join(" · ") || lead.phone}</p>
                  </div>
                  <time className={own.when} dateTime={lead.created_at}>{fmt(lead.created_at)}</time>
                </div>

                {lead.message && <p className={own.message}>{lead.message}</p>}

                <div className={own.leadFoot}>
                  <span className={own.via}>scanned {lead.card_owner_name}&rsquo;s card</span>
                  <div className={own.reply}>
                    <a href={`tel:${lead.phone}`} className={own.iconBtn} title="Call">
                      <Phone size={14} />
                    </a>
                    <a href={`https://wa.me/${waNumber(lead.phone)}`} target="_blank" rel="noopener noreferrer"
                       className={own.waBtn}>
                      WhatsApp
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`} role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
