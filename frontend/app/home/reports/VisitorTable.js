"use client";
/* ============================================================================
   VISITOR TABLE — Reports & Analytics
   Every visitor in the report's date range, 25 to a page, with its own
   filters and sorting. A row opens the details panel, where a visitor still
   inside can be checked out and their pass re-sent.

   Live refresh only touches page 1 with no panel open: rows moving under
   someone reading page 4, or behind an open panel, would lose their place.
   ID numbers never reach this table (the API leaves them out).
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, LogOut, Send, ExternalLink } from "lucide-react";
import styles from "./visitorTable.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;
const PAGE_SIZE = 25;

const STATUS = {
  pending:          { label: "Pending",          color: "#b45309", bg: "#fef3c7" },
  accepted:         { label: "Accepted",         color: "#047857", bg: "#d1fae5" },
  declined:         { label: "Declined",         color: "#b91c1c", bg: "#fee2e2" },
  checked_in:       { label: "Checked In",       color: "#4338ca", bg: "#e0e7ff" },
  checked_out:      { label: "Checked Out",      color: "#232327", bg: "#ededf0" },
  auto_checked_out: { label: "Auto Checked Out", color: "#4b5563", bg: "#f3f4f6" },
};
const FEEDBACK = {
  excellent:         "👍 Excellent",
  good:              "😊 Good",
  needs_improvement: "😐 Needs improvement",
};
const EMPTY_FILTERS = { q: "", status: "", host: "", category: "", inout: "", feedback: "" };

const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
};
const fmtDuration = (m) => {
  if (m == null || m < 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return h < 24 ? `${h}h ${r}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};
const purposeOf = (v) => [v.purpose_category, v.purpose_subcategory].filter(Boolean).join(" · ") || v.purpose || "—";

/* Page numbers around the current one, with the first and last always in. */
const pageList = (page, pages) => {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const list = [...set].sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => { if (i && p - list[i - 1] > 1) out.push("…"); out.push(p); });
  return out;
};

function StatusPill({ status }) {
  const s = STATUS[status] || { label: status || "—", color: "#4b5563", bg: "#f3f4f6" };
  return <span className={styles.pill} style={{ color: s.color, background: s.bg }}>{s.label}</span>;
}

/* ── Details panel ── */
function DetailsPanel({ id, onClose, onChanged, showToast }) {
  const [v, setV] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`${API}/api/exports/visitor/${id}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not load this visitor");
      setV(data.visitor);
    } catch (err) { setError(err.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const act = async (kind) => {
    setBusy(kind);
    try {
      const res = await fetch(`${API}/api/visitors/${encodeURIComponent(v.visitor_code)}/${kind}`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Something went wrong");
      showToast(kind === "checkout" ? `${v.name} checked out.` : `Pass re-sent to ${v.email}.`);
      await load();
      onChanged();
    } catch (err) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setBusy("");
    }
  };

  const rows = v ? [
    ["Visitor code", v.visitor_code],
    ["Phone", v.phone],
    ["Email", v.email],
    ["Company", v.from_company],
    ["Department", v.department],
    ["Designation", v.designation],
    ["Address", [v.address, v.city, v.state, v.postal_code, v.country].filter(Boolean).join(", ")],
    ["Person to meet", v.person_to_meet],
    ["Purpose", purposeOf(v)],
    ["Belongings", v.belongings],
    ["ID", v.id_type ? `${v.id_type}${v.id_number_masked ? ` ${v.id_number_masked}` : ""}` : null],
    ["Check-in", fmtWhen(v.check_in)],
    ["Check-out", v.check_out ? fmtWhen(v.check_out) : (v.status === "IN" ? "Still inside" : "—")],
    ["Time spent", fmtDuration(v.duration_minutes)],
    ["Feedback", FEEDBACK[v.feedback_rating] || "—"],
    ["Pass", v.pass_issued ? "Sent" : "Not sent"],
    ...(v.custom || []).map((c) => [c.label, c.value]),
  ].filter(([, val]) => val !== null && val !== undefined && val !== "") : [];

  return (
    <div className={styles.overlay} onClick={() => { if (!busy) onClose(); }} role="presentation">
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vt-panel-title">
        <div className={styles.panelHead}>
          <div className={styles.panelWho}>
            {v?.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={v.photo} alt="" className={styles.photo} />
              : <span className={styles.initial} aria-hidden="true">{(v?.name || "?").trim().charAt(0).toUpperCase()}</span>}
            <div>
              <h2 id="vt-panel-title" className={styles.panelTitle}>{v?.name || (error ? "Visitor" : "Loading…")}</h2>
              {v && <StatusPill status={v.visit_status} />}
            </div>
          </div>
          <button className={styles.close} onClick={onClose} disabled={!!busy} aria-label="Close"><X size={16} /></button>
        </div>

        {error && <p className={styles.panelError} role="alert">{error}</p>}

        {v && (
          <>
            <div className={styles.actions}>
              {v.status === "IN" && (
                <button className={styles.actionPrimary} onClick={() => act("checkout")} disabled={!!busy}>
                  <LogOut size={14} /> {busy === "checkout" ? "Checking out…" : "Check out"}
                </button>
              )}
              {v.email && (
                <button className={styles.action} onClick={() => act("resend")} disabled={!!busy}>
                  <Send size={14} /> {busy === "resend" ? "Sending…" : "Resend pass"}
                </button>
              )}
              <a className={styles.action} href={`/visitor/pass?code=${encodeURIComponent(v.visitor_code)}`}
                 target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> View pass
              </a>
            </div>
            <dl className={styles.details}>
              {rows.map(([k, val]) => (
                <div key={k} className={styles.detailRow}><dt>{k}</dt><dd>{val}</dd></div>
              ))}
            </dl>
          </>
        )}
      </aside>
    </div>
  );
}

/* ── Table ── */
export default function VisitorTable({ rangeQuery, liveTick, showToast, onChanged }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch]   = useState("");
  const [sort, setSort]       = useState({ col: "check_in", dir: "desc" });
  const [page, setPage]       = useState(1);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [openId, setOpenId]   = useState(null);
  const reqId = useRef(0);

  // A new filter or sort starts again from page 1, in the same update, so
  // the table is fetched once rather than for the old page and then page 1.
  const changeFilters = (fn) => { setFilters(fn); setPage(1); };
  const changeSort = (fn) => { setSort(fn); setPage(1); };

  // Search as they type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.q !== search.trim()) changeFilters((f) => ({ ...f, q: search.trim() }));
    }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new range also starts from page 1.
  const lastRange = useRef(rangeQuery);
  if (lastRange.current !== rangeQuery) { lastRange.current = rangeQuery; if (page !== 1) setPage(1); }

  const load = useCallback(async (quiet = false) => {
    const mine = ++reqId.current;
    if (!quiet) setLoading(true);
    setError("");
    const qs = new URLSearchParams(rangeQuery);
    qs.set("page", String(page));
    qs.set("pageSize", String(PAGE_SIZE));
    qs.set("sort", sort.col);
    qs.set("dir", sort.dir);
    Object.entries(filters).forEach(([k, val]) => { if (val) qs.set(k, val); });
    try {
      const res = await fetch(`${API}/api/exports/visitor-table?${qs}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Could not load visitors");
      // Only the latest request may land: a slow older one must not
      // overwrite the rows for the filters now on screen.
      if (mine === reqId.current) setData(body);
    } catch (err) {
      if (mine === reqId.current) setError(err.message);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, [rangeQuery, page, sort, filters]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: page 1 only, and never behind an open panel.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (page === 1 && !openId) load(true);
  }, [liveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (k) => (e) => changeFilters((f) => ({ ...f, [k]: e.target.value }));
  const anyFilter = search || Object.entries(filters).some(([k, val]) => k !== "q" && val);
  const clearFilters = () => { setSearch(""); changeFilters(() => EMPTY_FILTERS); };

  /* The choices come from the current range. A host or category picked
     earlier stays listed after the range changes, so the select still
     shows the filter that is applied (and it can be undone). */
  const withPicked = (list = [], picked) => (picked && !list.includes(picked) ? [picked, ...list] : list);
  const hostOptions = withPicked(data?.options?.hosts, filters.host);
  const categoryOptions = withPicked(data?.options?.categories, filters.category);

  const sortBy = (col) => changeSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "name" ? "asc" : "desc" }));
  const SortHead = ({ col, children }) => (
    <th aria-sort={sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={styles.sortBtn} onClick={() => sortBy(col)}>
        {children}
        {sort.col === col && (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </button>
    </th>
  );

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const at = data?.page || page;
  const fromN = total ? (at - 1) * PAGE_SIZE + 1 : 0;
  const toN = Math.min(at * PAGE_SIZE, total);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Visitors</h3>
          <p className={styles.sub}>{loading && !data ? "Loading…" : `${total} visitor${total === 1 ? "" : "s"} in this range`}</p>
        </div>
      </div>

      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={14} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search name, phone, company or code" aria-label="Search visitors" maxLength={100} />
        </label>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Visit status">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select value={filters.host} onChange={setFilter("host")} aria-label="Person to meet">
          <option value="">Everyone visited</option>
          {hostOptions.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        {categoryOptions.length > 0 && (
          <select value={filters.category} onChange={setFilter("category")} aria-label="Purpose category">
            <option value="">All categories</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={filters.inout} onChange={setFilter("inout")} aria-label="Inside or left">
          <option value="">Inside or left</option>
          <option value="in">Still inside</option>
          <option value="out">Checked out</option>
        </select>
        <select value={filters.feedback} onChange={setFilter("feedback")} aria-label="Feedback">
          <option value="">Any feedback</option>
          {Object.entries(FEEDBACK).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          <option value="none">No feedback</option>
        </select>
        {anyFilter && <button type="button" className={styles.clear} onClick={clearFilters}>Clear filters</button>}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={`${styles.scroller} ${loading && data ? styles.dim : ""}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <SortHead col="name">Visitor</SortHead>
              <th>Phone</th>
              <th>Company</th>
              <th>Person to meet</th>
              <th>Purpose</th>
              <SortHead col="check_in">Check-in</SortHead>
              <SortHead col="check_out">Check-out</SortHead>
              <SortHead col="duration">Time spent</SortHead>
              <SortHead col="visit_status">Status</SortHead>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} onClick={() => setOpenId(v.id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(v.id); } }}>
                <td className={styles.mono}>{v.visitor_code || "—"}</td>
                <td className={styles.strong}>{v.name || "—"}</td>
                <td>{v.phone || "—"}</td>
                <td>{v.from_company || "—"}</td>
                <td>{v.person_to_meet || "—"}</td>
                <td className={styles.wrap}>{purposeOf(v)}</td>
                <td>{fmtWhen(v.check_in)}</td>
                <td>{v.check_out ? fmtWhen(v.check_out) : (v.status === "IN" ? <span className={styles.inside}>Inside</span> : "—")}</td>
                <td>{fmtDuration(v.duration_minutes)}</td>
                <td><StatusPill status={v.visit_status} /></td>
                <td>{FEEDBACK[v.feedback_rating] || "—"}</td>
              </tr>
            ))}
            {!loading && !rows.length && !error && (
              <tr className={styles.emptyRow}><td colSpan={11}>{anyFilter ? "No visitors match these filters." : "No visitors in this range."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className={styles.pager}>
          <span className={styles.count}>Showing {fromN}–{toN} of {total}</span>
          <div className={styles.pages}>
            <button type="button" className={styles.pageBtn} onClick={() => setPage(at - 1)} disabled={at <= 1 || loading}>
              <ChevronLeft size={14} /> Back
            </button>
            {pageList(at, pages).map((p, i) => (p === "…"
              ? <span key={`gap${i}`} className={styles.gap}>…</span>
              : <button key={p} type="button" className={`${styles.pageNum} ${p === at ? styles.pageOn : ""}`}
                        onClick={() => setPage(p)} disabled={loading} aria-current={p === at ? "page" : undefined}>{p}</button>))}
            <button type="button" className={styles.pageBtn} onClick={() => setPage(at + 1)} disabled={at >= pages || loading}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {openId && (
        <DetailsPanel id={openId} showToast={showToast} onClose={() => setOpenId(null)}
                      onChanged={() => { load(true); onChanged?.(); }} />
      )}
    </div>
  );
}
