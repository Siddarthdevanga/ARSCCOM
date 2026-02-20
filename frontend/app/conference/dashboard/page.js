"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, QrCode, Home, X, Plus, RefreshCw,
  Pencil, Trash2, Check, AlertCircle, Info,
  Users, DoorOpen, CalendarClock, Download, Share2,
  CheckCircle, Clock, TrendingUp,
} from "lucide-react";
import { apiFetch, downloadQRCode, shareURL, fetchPublicBookingInfo } from "../../utils/api";
import styles from "./style.module.css";

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
let _tid = 0;

function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = "info", title, message, duration = 4500 }) => {
    const id = ++_tid;
    setToasts((p) => [...p, { id, type, title, message, duration, exiting: false }]);
    setTimeout(() => {
      setToasts((p) => p.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 300);
    }, duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((p) => p.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 300);
  }, []);

  const toast = {
    success: (title, msg, opts) => addToast({ type: "success", title, message: msg, ...opts }),
    error:   (title, msg, opts) => addToast({ type: "error",   title, message: msg, ...opts }),
    warning: (title, msg, opts) => addToast({ type: "warning", title, message: msg, ...opts }),
    info:    (title, msg, opts) => addToast({ type: "info",    title, message: msg, ...opts }),
  };

  return { toasts, toast, removeToast };
}

const TOAST_ICONS = { success: CheckCircle, error: AlertCircle, warning: AlertCircle, info: Info };
const TOAST_LABELS = { success: "Success", error: "Error", warning: "Warning", info: "Info" };

function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.toastContainer} role="region" aria-live="polite">
      {toasts.map((t) => {
        const Icon = TOAST_ICONS[t.type];
        return (
          <div key={t.id} className={`${styles.toast}${t.exiting ? " " + styles.exiting : ""}`} data-type={t.type} role="alert">
            <div className={styles.toastInner}>
              <div className={styles.toastIconWrap}><Icon size={17} /></div>
              <div className={styles.toastBody}>
                <p className={styles.toastTitle}>{t.title || TOAST_LABELS[t.type]}</p>
                {t.message && <p className={styles.toastMessage}>{t.message}</p>}
              </div>
              <button className={styles.toastClose} onClick={() => removeToast(t.id)} aria-label="Dismiss"><X size={13} /></button>
            </div>
            <div className={styles.toastProgress}>
              <div className={styles.toastProgressBar} style={{ animationDuration: `${t.duration}ms` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATE / TIME HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(v) {
  if (!v) return "—";
  try {
    const s = String(v).split("T")[0].split(" ")[0];
    const [y, m, d] = s.split("-");
    return `${MONTHS[+m - 1]} ${d}, ${y}`;
  } catch { return v; }
}

function fmtTime(v) {
  if (!v) return "—";
  try {
    let s = String(v).trim();
    if (s.includes("T")) s = s.split("T")[1];
    if (s.includes(" ")) s = s.split(" ")[1];
    const [hRaw, m] = s.split(":");
    let h = parseInt(hRaw, 10);
    if (isNaN(h)) return "—";
    const sfx = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${sfx}`;
  } catch { return "—"; }
}

function getOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESS BAR COLOUR
   ═══════════════════════════════════════════════════════════════════════════ */
function barWarn(pct) {
  if (pct >= 100) return "red";
  if (pct >= 85) return "orange";
  return "green";
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFERENCE DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ConferenceDashboard() {
  const router = useRouter();
  const { toasts, toast, removeToast } = useToast();

  /* ── State ── */
  const [company,   setCompany]   = useState(null);
  const [stats,     setStats]     = useState(null);
  const [allRooms,  setAllRooms]  = useState([]);
  const [bookings,  setBookings]  = useState([]);
  const [plan,      setPlan]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);

  const [filterDay, setFilterDay] = useState("today");

  // Panels
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Room editing
  const [editId,   setEditId]   = useState(null);
  const [editName, setEditName] = useState("");
  const [editCap,  setEditCap]  = useState("");

  // Modals
  const [addModal,    setAddModal]    = useState(false);
  const [deleteModal, setDeleteModal] = useState(null); // room object
  const [newName,   setNewName]   = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newCap,    setNewCap]    = useState("");
  const [creating,  setCreating]  = useState(false);

  // QR
  const [qrInfo,    setQrInfo]    = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);

  /* ── Date helpers ── */
  const dates = useMemo(() => ({
    yesterday: getOffset(-1), today: getOffset(0), tomorrow: getOffset(1),
  }), []);
  const selectedDate = dates[filterDay];

  /* ── Auth + load ── */
  useEffect(() => {
    const token   = localStorage.getItem("token");
    const stored  = localStorage.getItem("company");
    if (!token || !stored) { router.replace("/auth/login"); return; }
    setCompany(JSON.parse(stored));
    loadDashboard();
  }, []);

  /* ── Load dashboard ── */
  const loadDashboard = async () => {
    try {
      const [statsRes, allRoomsRes, bookingsRes, planRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms/all"),
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/plan-usage"),
      ]);

      setStats(statsRes);
      setAllRooms(Array.isArray(allRoomsRes) ? allRoomsRes : (allRoomsRes?.rooms || []));
      setBookings(bookingsRes || []);
      setPlan(planRes);
    } catch (err) {
      if (err?.message?.includes("expired") || err?.message?.includes("inactive")) {
        toast.warning("Plan Issue", err.message);
      } else {
        router.replace("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── QR ── */
  const loadQR = async () => {
    try {
      setLoadingQR(true);
      const res = await fetchPublicBookingInfo();
      setQrInfo(res);
    } catch (err) {
      toast.error("QR Failed", err?.message || "Could not load QR code");
    } finally {
      setLoadingQR(false);
    }
  };

  const openQR = () => { if (!qrInfo) loadQR(); setRightOpen(true); };

  const handleDownloadQR = async () => {
    try {
      await downloadQRCode(company?.name || "conference");
      toast.success("Downloaded", "QR code saved successfully.");
    } catch (err) { toast.error("Download Failed", err?.message); }
  };

  const handleShare = async () => {
    const url = qrInfo?.publicUrl || `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company?.slug}`;
    try {
      const res = await shareURL(url, `${company?.name} — Conference Booking`);
      if (res.success) toast.success(res.method === "share" ? "Shared!" : "Copied!", "Link is ready to share.");
    } catch (err) { toast.error("Share Failed", err?.message); }
  };

  /* ── Sync ── */
  const handleSync = async () => {
    try {
      setSyncing(true);
      await apiFetch("/api/conference/sync-rooms", { method: "POST", headers: { "Content-Type": "application/json" } });
      await loadDashboard();
      toast.success("Synced", "Room activations updated with current plan.");
    } catch (err) { toast.error("Sync Failed", err?.message); }
    finally { setSyncing(false); }
  };

  /* ── Edit room ── */
  const startEdit = (room) => {
    if (!room.is_active) { toast.warning("Locked", "Upgrade your plan to edit this room."); return; }
    setEditId(room.id); setEditName(room.room_name); setEditCap(room.capacity ?? "");
  };
  const cancelEdit = () => { setEditId(null); setEditName(""); setEditCap(""); };

  const saveEdit = async (roomId) => {
    const name = editName.trim();
    if (!name) { toast.error("Required", "Room name cannot be empty."); return; }
    const orig = allRooms.find((r) => r.id === roomId);
    if (name === orig?.room_name && String(editCap) === String(orig?.capacity ?? "")) { cancelEdit(); return; }
    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: name, capacity: parseInt(editCap) || 0 }),
      });
      cancelEdit(); await loadDashboard();
      toast.success("Updated", "Room details saved successfully.");
    } catch (err) { toast.error("Update Failed", err?.message); cancelEdit(); }
  };

  /* ── Delete room ── */
  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await apiFetch(`/api/conference/rooms/${deleteModal.id}`, { method: "DELETE" });
      setDeleteModal(null); await loadDashboard();
      toast.success("Deleted", `"${deleteModal.room_name}" has been removed.`);
    } catch (err) { toast.error("Delete Failed", err?.message); setDeleteModal(null); }
  };

  /* ── Create room ── */
  const handleCreate = async () => {
    const name = newName.trim(), num = newNumber.trim();
    if (!name || !num) { toast.error("Required", "Room name and number are required."); return; }
    if (allRooms.some((r) => String(r.room_number) === num)) {
      toast.error("Duplicate", "Room number already exists."); return;
    }
    try {
      setCreating(true);
      const res = await apiFetch("/api/conference/rooms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: name, room_number: num, capacity: parseInt(newCap) || 0 }),
      });
      setNewName(""); setNewNumber(""); setNewCap(""); setAddModal(false);
      await loadDashboard();
      if (res?.isActive) toast.success("Room Created", `"${name}" is now active.`);
      else toast.warning("Room Created (Locked)", "Upgrade your plan to activate this room.");
    } catch (err) { toast.error("Create Failed", err?.message); }
    finally { setCreating(false); }
  };

  /* ── Book button ── */
  const handleBook = () => {
    if (isPlanExpired)      { toast.warning("Plan Expired", "Please renew your plan to book rooms."); return; }
    if (isLimitExceeded)    { toast.warning("Limit Reached", "Upgrade your plan to continue booking."); return; }
    if (noActiveRooms)      { toast.info("No Active Rooms", "Add and activate a room first."); return; }
    router.push("/conference/bookings");
  };

  /* ── Computed ── */
  const filteredBookings = useMemo(() =>
    bookings.filter((b) => {
      const date = b.booking_date?.split("T")[0] ?? b.booking_date;
      return date === selectedDate && b.status === "BOOKED";
    }), [bookings, selectedDate]);

  const deptStats = useMemo(() => {
    const m = {};
    filteredBookings.forEach((b) => { const d = b.department || "Unknown"; m[d] = (m[d] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredBookings]);

  const bookingLimit   = plan?.plan === "TRIAL" ? 100 : plan?.plan === "BUSINESS" ? 1000 : Infinity;
  const bookingUsed    = stats?.totalBookings || 0;
  const bookingRem     = bookingLimit === Infinity ? null : Math.max(0, bookingLimit - bookingUsed);
  const isPlanExpired  = plan?.plan === "EXPIRED" || plan?.status === "EXPIRED";
  const isLimitExceeded = bookingLimit !== Infinity && bookingRem !== null && bookingRem <= 0;
  const noActiveRooms  = plan?.activeRooms === 0;
  const isBookDisabled = isPlanExpired || isLimitExceeded || noActiveRooms;

  const roomLimit    = plan?.limit === "Unlimited" ? Infinity : parseInt(plan?.limit) || Infinity;
  const roomTotal    = plan?.totalRooms || 0;
  const roomActive   = plan?.activeRooms || 0;
  const roomLocked   = plan?.lockedRooms || 0;
  const canAddRoom   = roomLimit === Infinity || roomTotal < roomLimit;

  const roomPct    = roomLimit === Infinity ? 100 : Math.min(100, Math.round((roomActive / parseInt(plan?.limit)) * 100));
  const bookingPct = bookingLimit === Infinity ? 100 : Math.min(100, Math.round((bookingUsed / bookingLimit) * 100));

  const publicURL = qrInfo?.publicUrl || (company ? `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}` : "");

  const disabledMsg = isPlanExpired ? "Plan expired — renew to unlock booking"
    : isLimitExceeded ? "Booking limit reached — upgrade to continue"
    : noActiveRooms ? "No active rooms — add a room to get started" : "";

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.loadingState} style={{ height: "100vh" }}>
        <div className={styles.spinner} /><p>Loading dashboard…</p>
      </div>
    </div>
  );

  if (!company || !stats) return (
    <div className={styles.container}>
      <div className={styles.errorState} style={{ height: "100vh" }}>
        <AlertCircle size={32} /><p>Unable to load dashboard</p>
        <button className={styles.retryBtn} onClick={loadDashboard}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>

      {/* ── TOASTS ── */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.leftHeader}>
          <button className={styles.menuTrigger} onClick={() => setLeftOpen(true)} aria-label="Open room panel">
            <span className={styles.menuLine}/><span className={styles.menuLine}/><span className={styles.menuLine}/>
          </button>
          <div className={styles.headerBrand}>
            <h1 className={styles.companyName}>{company.name}</h1>
            <span className={styles.subText}>Conference Dashboard</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button className={styles.qrBtn} onClick={openQR}>
            <QrCode size={15} /> QR Code
          </button>
          {company.logo_url && (
            <img src={company.logo_url} alt={`${company.name} logo`} className={styles.logo} />
          )}
          <button className={styles.homeBtn} onClick={() => router.push("/home")}>
            <Home size={14} /> Home
          </button>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <div className={styles.pageContent}>

        {/* HERO BANNER */}
        <div className={styles.heroBanner}>
          <div className={styles.bannerLeft}>
            <p className={styles.bannerLabel}>Public Booking URL</p>
            <a href={publicURL} target="_blank" rel="noreferrer" className={styles.bannerUrl}>
              {publicURL || "Loading…"}
            </a>
          </div>
          <div className={styles.bannerActions}>
            <button className={styles.shareBtn} onClick={handleShare}>
              <Share2 size={14} /> Share
            </button>
            <button className={styles.bookBtn} onClick={handleBook} disabled={isBookDisabled}>
              {isPlanExpired ? "Plan Expired" : isLimitExceeded ? "Limit Reached" : noActiveRooms ? "No Rooms" : "Book Room"}
            </button>
          </div>
          {isBookDisabled && (
            <div className={styles.bannerAlert}>
              <AlertCircle size={15} />{disabledMsg}
            </div>
          )}
        </div>

        {/* STATS */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><DoorOpen size={22} /></div>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>Active Rooms</p>
              <p className={styles.statValue}>{roomActive}</p>
              {roomLocked > 0 && <span className={styles.statSub}>+{roomLocked} locked</span>}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><CalendarClock size={22} /></div>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>{filterDay.charAt(0).toUpperCase() + filterDay.slice(1)}'s Bookings</p>
              <p className={styles.statValue}>{filteredBookings.length}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Users size={22} /></div>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>Active Departments</p>
              <p className={styles.statValue}>{deptStats.length}</p>
            </div>
          </div>
        </div>

        {/* USAGE */}
        <div className={styles.usageCard}>
          <div className={styles.usageRow}>
            <div className={styles.usageHeader}>
              <span className={styles.usageTitle}>Room Usage</span>
              <span className={styles.usageMeta}>
                {plan?.limit === "Unlimited" ? "Unlimited" : `${roomActive} / ${plan?.limit} active`}
                {roomLocked > 0 && <span className={styles.usageMetaWarn}> · {roomLocked} locked</span>}
              </span>
            </div>
            <div className={styles.barOuter}>
              <div className={styles.barInner} data-warn={barWarn(roomPct)} style={{ width: `${roomPct}%` }} />
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.usageRow}>
            <div className={styles.usageHeader}>
              <span className={styles.usageTitle}>Booking Usage</span>
              <span className={styles.usageMeta}>
                {bookingLimit === Infinity ? "Unlimited" : `${bookingUsed} / ${bookingLimit} used`}
                {isLimitExceeded && <span className={styles.usageMetaWarn}> · Limit reached</span>}
              </span>
            </div>
            <div className={styles.barOuter}>
              <div className={styles.barInner} data-warn={barWarn(bookingPct)} style={{ width: `${bookingPct}%` }} />
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className={styles.filterRow}>
          {["yesterday","today","tomorrow"].map((d) => (
            <button
              key={d}
              className={`${styles.filterTab}${filterDay === d ? " " + styles.active : ""}`}
              onClick={() => setFilterDay(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* BOOKINGS */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Daily Schedule</h3>
            <span className={styles.sectionMeta}>{fmtDate(selectedDate)}</span>
          </div>
          <div className={styles.sectionBody}>
            {filteredBookings.length === 0 ? (
              <div className={styles.emptyState}>
                <CalendarClock size={36} /><p>No bookings scheduled for this day.</p>
              </div>
            ) : (
              <div className={styles.bookingList}>
                {filteredBookings.slice(0, 12).map((b) => (
                  <div key={b.id} className={styles.bookingRow}>
                    <div>
                      <p className={styles.bookingRoom}>{b.room_name} <span style={{ fontWeight:500, color:"var(--gray-400)", fontSize:"0.72rem" }}>#{b.room_number}</span></p>
                      <p className={styles.bookingDate}>{fmtDate(b.booking_date)}</p>
                    </div>
                    <span className={styles.bookingTime}>{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
                    <span className={styles.bookingStatus}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DEPARTMENTS */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Department Usage</h3>
            <span className={styles.sectionMeta}>{deptStats.length} departments</span>
          </div>
          <div className={styles.sectionBody}>
            {deptStats.length === 0 ? (
              <div className={styles.emptyState}>
                <Users size={36} /><p>No department activity this period.</p>
              </div>
            ) : (
              <div className={styles.deptList}>
                {deptStats.map(([dep, count]) => (
                  <div key={dep} className={styles.deptRow}>
                    <span className={styles.deptName}>{dep}</span>
                    <span className={styles.deptCount}>{count} {count === 1 ? "booking" : "bookings"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT PANEL — Room Management
         ═══════════════════════════════════════════════════════════════════════ */}
      {leftOpen && (
        <>
          <div className={styles.overlay} onClick={() => { setLeftOpen(false); cancelEdit(); }} />
          <aside className={styles.leftPanel} role="dialog" aria-modal="true" aria-label="Room Management">
            <div className={styles.panelHeader}>
              <h3>Room Management</h3>
              <button className={styles.closeBtn} onClick={() => { setLeftOpen(false); cancelEdit(); }} aria-label="Close">
                <X size={17} />
              </button>
            </div>

            <div className={styles.panelBody}>
              {/* Plan summary */}
              <div className={styles.planSummary}>
                <span className={styles.planBadge}>{plan?.plan || "Plan"}</span>
                <p className={styles.planName}>{plan?.plan || "—"}</p>
                <p className={styles.planMeta}>
                  Active: <b>{roomActive}</b>
                  {roomLimit !== Infinity && <> / {plan?.limit}</>}
                  {roomLocked > 0 && <> · <span>{roomLocked} locked</span></>}
                </p>
              </div>

              {/* Actions */}
              <div className={styles.panelActions}>
                <button className={`${styles.panelBtn} ${styles.secondary}`} onClick={handleSync} disabled={syncing}>
                  <RefreshCw size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
                  {syncing ? "Syncing…" : "Sync Rooms"}
                </button>
                <button
                  className={`${styles.panelBtn} ${styles.primary}`}
                  onClick={() => setAddModal(true)}
                  disabled={!canAddRoom}
                  title={!canAddRoom ? "Plan limit reached" : undefined}
                >
                  <Plus size={14} /> Add Room
                </button>
              </div>

              {/* Room list */}
              <h4 style={{ margin: "0.25rem 0 0.25rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                All Rooms ({allRooms.length})
              </h4>
              <div className={styles.roomList}>
                {allRooms.length === 0 && (
                  <div className={styles.emptyState}>
                    <DoorOpen size={32} /><p>No rooms yet. Click "Add Room" to create one.</p>
                  </div>
                )}
                {allRooms.map((r) => (
                  <div key={r.id} className={`${styles.roomItem}${!r.is_active ? " " + styles.locked : ""}`}>
                    <div className={styles.roomTop}>
                      <span className={styles.roomItemName}>{r.room_name}</span>
                      <span className={`${styles.badge} ${r.is_active ? styles.active : styles.locked}`}>
                        {r.is_active ? "Active" : "🔒 Locked"}
                      </span>
                    </div>
                    <p className={styles.roomSub}>#{r.room_number} · Capacity: {r.capacity || "N/A"}</p>

                    {editId === r.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <input className={styles.editInput} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Room name" />
                        <input className={styles.editInput} type="number" value={editCap} onChange={(e) => setEditCap(e.target.value)} placeholder="Capacity" min={0} />
                        <div className={styles.roomControls}>
                          <button className={`${styles.iconBtn} ${styles.save}`} onClick={() => saveEdit(r.id)} title="Save"><Check size={14} /></button>
                          <button className={`${styles.iconBtn} ${styles.cancel}`} onClick={cancelEdit} title="Cancel"><X size={14} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.roomControls}>
                        <button className={`${styles.iconBtn} ${styles.edit}`} onClick={() => startEdit(r)} disabled={!r.is_active} title="Edit"><Pencil size={13} /></button>
                        <button
                          className={`${styles.iconBtn} ${styles.del}`}
                          onClick={() => { if (!r.is_active) { toast.warning("Locked", "Upgrade to delete locked rooms."); return; } setDeleteModal(r); }}
                          disabled={!r.is_active} title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — QR Code
         ═══════════════════════════════════════════════════════════════════════ */}
      {rightOpen && (
        <>
          <div className={styles.overlay} onClick={() => setRightOpen(false)} />
          <aside className={styles.rightPanel} role="dialog" aria-modal="true" aria-label="QR Code Panel">
            <div className={styles.panelHeader}>
              <h3>Public Registration</h3>
              <button className={styles.closeBtn} onClick={() => setRightOpen(false)} aria-label="Close"><X size={17} /></button>
            </div>

            <div className={styles.rightPanelBody}>
              {loadingQR ? (
                <div className={styles.loadingState}><div className={styles.spinner} /><p>Loading QR code…</p></div>
              ) : qrInfo ? (
                <>
                  <div className={styles.qrWrapper}>
                    <img src={qrInfo.qrCode} alt="Conference Booking QR Code" className={styles.qrImage} />
                    <p className={styles.qrCaption}>Scan to register & book</p>
                  </div>

                  <div className={styles.urlBox}>
                    <p className={styles.urlBoxLabel}>Public Booking URL</p>
                    <p className={styles.urlBoxValue}>{qrInfo.publicUrl}</p>
                  </div>

                  <button className={`${styles.fullBtn} ${styles.purple}`} onClick={handleShare}>
                    <Share2 size={16} /> Copy Link
                  </button>

                  <button className={`${styles.fullBtn} ${styles.amber}`} onClick={handleDownloadQR}>
                    <Download size={16} /> Download QR Code
                  </button>

                  <div className={styles.instructionBox}>
                    <h4>How it works</h4>
                    <ol>
                      <li>Share the QR code or URL with your employees</li>
                      <li>They authenticate using OTP</li>
                      <li>They select and book an available conference room</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className={styles.errorState}>
                  <AlertCircle size={28} /><p>Failed to load QR code</p>
                  <button className={styles.retryBtn} onClick={loadQR}>Retry</button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL — Add Room
         ═══════════════════════════════════════════════════════════════════════ */}
      {addModal && (
        <div className={styles.modalOverlay} onClick={() => setAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add New Room</h3>
              <button className={styles.closeBtn} onClick={() => setAddModal(false)}><X size={17} /></button>
            </div>
            <div className={styles.modalBody}>
              {!canAddRoom && (
                <div className={`${styles.alertInModal} ${styles.warn}`}>
                  <AlertCircle size={15} /> You've reached your plan limit of {plan?.limit} rooms. Upgrade to add more.
                </div>
              )}
              {roomLocked > 0 && canAddRoom && (
                <div className={`${styles.alertInModal} ${styles.info}`}>
                  <Info size={15} /> You have {roomLocked} locked room(s). This room will activate if a slot is available.
                </div>
              )}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Room Name *</label>
                <input className={styles.formInput} placeholder="e.g. Board Room" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Room Number *</label>
                <input className={styles.formInput} placeholder="e.g. 101, A1, CR-01" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} maxLength={20} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Capacity (optional)</label>
                <input className={styles.formInput} type="number" placeholder="e.g. 10" value={newCap} onChange={(e) => setNewCap(e.target.value)} min={0} max={1000} />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={() => setAddModal(false)} disabled={creating}>Cancel</button>
                <button className={styles.btnPrimary} onClick={handleCreate} disabled={creating || !newName.trim() || !newNumber.trim()}>
                  {creating ? "Creating…" : "Create Room"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL — Delete Confirm
         ═══════════════════════════════════════════════════════════════════════ */}
      {deleteModal && (
        <div className={styles.modalOverlay} onClick={() => setDeleteModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className={styles.modalHeader}>
              <h3>Delete Room</h3>
              <button className={styles.closeBtn} onClick={() => setDeleteModal(null)}><X size={17} /></button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteWarning}>
                Are you sure you want to delete <strong>"{deleteModal.room_name}"</strong>?<br /><br />
                This action cannot be undone. All associated bookings may be affected.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={() => setDeleteModal(null)}>Cancel</button>
                <button className={styles.btnDanger} onClick={handleDelete}>Delete Room</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
