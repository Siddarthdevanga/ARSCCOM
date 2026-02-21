"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, downloadQRCode, shareURL, fetchPublicBookingInfo } from "../../utils/api";
import styles from "./style.module.css";

/* ================= DATE FORMATTER ================= */
const formatNiceDate = (value) => {
  if (!value) return "-";
  try {
    let str = String(value).trim();
    if (str.includes("T")) str = str.split("T")[0];
    if (str.includes(" ")) str = str.split(" ")[0];
    const [y, m, d] = str.split("-");
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[Number(m) - 1]} ${d}, ${y}`;
  } catch { return value; }
};

/* ================= TIME FORMATTER ================= */
const formatNiceTime = (value) => {
  if (!value) return "-";
  try {
    let str = String(value).trim();
    if (str.includes("T")) str = str.split("T")[1];
    if (str.includes(" ")) str = str.split(" ")[1];
    const [hRaw, m] = str.split(":");
    let h = parseInt(hRaw, 10);
    if (isNaN(h)) return "-";
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
  } catch { return "-"; }
};

export default function ConferenceDashboard() {
  const router = useRouter();

  /* ================= STATE ================= */
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [plan, setPlan] = useState(null);
  const [bookingPlan, setBookingPlan] = useState(null);

  // Single nav panel
  const [navOpen, setNavOpen] = useState(false);
  const [navTab, setNavTab] = useState("qr"); // "qr" | "rooms"

  // Room editing
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState(0);

  // Add room modal
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [filterDay, setFilterDay] = useState("today");

  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);

  // QR Code
  const [publicBookingInfo, setPublicBookingInfo] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);

  /* ================= HELPERS ================= */
  const getDate = useCallback((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  }, []);

  const dates = useMemo(() => ({
    today: getDate(0), yesterday: getDate(-1), tomorrow: getDate(1)
  }), [getDate]);

  const selectedDate = dates[filterDay];

  const showNotification = (message, type = "info") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 5000);
  };

  /* ================= QR CODE ================= */
  const loadPublicBookingInfo = async () => {
    try {
      setLoadingQR(true);
      const response = await fetchPublicBookingInfo();
      setPublicBookingInfo(response);
    } catch (err) {
      showNotification(err?.message || "Failed to load QR code", "error");
    } finally { setLoadingQR(false); }
  };

  const handleDownloadQR = async () => {
    try {
      await downloadQRCode(company?.name || "conference");
      showNotification("QR code downloaded!", "success");
    } catch (err) { showNotification(err?.message || "Failed to download", "error"); }
  };

  const handleShareURL = async () => {
    const url = publicBookingInfo?.publicUrl || `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;
    try {
      const result = await shareURL(url, `${company?.name} - Conference Room Booking`);
      if (result.success) {
        showNotification(result.method === "share" ? "Shared!" : "Link copied!", "success");
      }
    } catch (err) { showNotification(err?.message || "Failed to share", "error"); }
  };

  /* ================= API CALLS ================= */
  const loadDashboard = async () => {
    try {
      const [statsRes, roomsRes, allRoomsRes, bookingsRes, planRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/rooms/all"),
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/plan-usage"),
      ]);
      setStats(statsRes);
      setRooms(roomsRes || []);
      setAllRooms(Array.isArray(allRoomsRes) ? allRoomsRes : (allRoomsRes?.rooms || []));
      setBookings(bookingsRes || []);
      setPlan(planRes);
      const bookingLimit = planRes?.plan === "TRIAL" ? 100 : planRes?.plan === "BUSINESS" ? 1000 : Infinity;
      setBookingPlan({
        limit: bookingLimit,
        used: statsRes.totalBookings || 0,
        remaining: bookingLimit === Infinity ? null : Math.max(bookingLimit - (statsRes.totalBookings || 0), 0),
      });
    } catch (err) {
      if (err?.message?.includes("expired") || err?.message?.includes("inactive")) {
        showNotification(err.message, "error");
      } else { router.replace("/auth/login"); }
    } finally { setLoading(false); }
  };

  /* ================= LIFECYCLE ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");
    if (!token || !storedCompany) { router.replace("/auth/login"); return; }
    setCompany(JSON.parse(storedCompany));
    loadDashboard();
  }, []);

  /* ================= ROOM ACTIONS ================= */
  const handleSyncRooms = async () => {
    try {
      setSyncing(true);
      await apiFetch("/api/conference/sync-rooms", { method: "POST", headers: { "Content-Type": "application/json" } });
      await loadDashboard();
      showNotification("Rooms synchronized!", "success");
    } catch (err) { showNotification(err?.message || "Sync failed", "error"); }
    finally { setSyncing(false); }
  };

  const startEditRoom = (room) => {
    if (!room.is_active) { showNotification("Room locked. Upgrade to edit.", "warning"); return; }
    setEditingRoomId(room.id); setEditName(room.room_name); setEditCapacity(room.capacity || 0);
  };

  const cancelEdit = () => { setEditingRoomId(null); setEditName(""); setEditCapacity(0); };

  const saveRoomChanges = async (roomId) => {
    const newName = editName.trim();
    const original = allRooms.find((r) => r.id === roomId);
    if (!newName) { showNotification("Name cannot be empty", "error"); return; }
    if (newName === original?.room_name && editCapacity === original?.capacity) { cancelEdit(); return; }
    if (!original?.is_active) { showNotification("Room locked.", "warning"); cancelEdit(); return; }
    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: newName, capacity: editCapacity || 0 }),
      });
      cancelEdit(); await loadDashboard(); showNotification("Room updated!", "success");
    } catch (err) { showNotification(err?.message || "Update failed", "error"); cancelEdit(); }
  };

  const deleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      await apiFetch(`/api/conference/rooms/${roomToDelete.id}`, { method: "DELETE" });
      await loadDashboard(); showNotification("Room deleted!", "success");
    } catch (err) { showNotification(err?.message || "Delete failed", "error"); }
    finally { setShowDeleteConfirm(false); setRoomToDelete(null); }
  };

  const confirmDeleteRoom = (room) => {
    if (!room?.is_active) { showNotification("Cannot delete locked rooms.", "warning"); return; }
    setRoomToDelete(room); setShowDeleteConfirm(true);
  };

  const createNewRoom = async () => {
    const name = newRoomName.trim(), number = newRoomNumber.trim(), capacity = parseInt(newRoomCapacity) || 0;
    if (!name || !number) { showNotification("Name and number required", "error"); return; }
    if (allRooms.some(r => String(r.room_number) === String(number))) { showNotification("Room number exists", "error"); return; }
    setIsCreatingRoom(true);
    try {
      const response = await apiFetch("/api/conference/rooms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: name, room_number: number, capacity }),
      });
      setNewRoomName(""); setNewRoomNumber(""); setNewRoomCapacity(""); setShowAddRoomModal(false);
      await loadDashboard();
      showNotification(response?.isActive ? "Room created & activated!" : "Room created! Upgrade to activate.", response?.isActive ? "success" : "warning");
    } catch (err) { showNotification(err?.message || "Create failed", "error"); }
    finally { setIsCreatingRoom(false); }
  };

  /* ================= COMPUTED ================= */
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const date = b.booking_date?.includes("T") ? b.booking_date.split("T")[0] : b.booking_date;
      return date === selectedDate && b.status === "BOOKED";
    });
  }, [bookings, selectedDate]);

  const departmentStats = useMemo(() => {
    const map = {};
    filteredBookings.forEach((b) => { const dep = b.department || "Unknown"; map[dep] = (map[dep] || 0) + 1; });
    return Object.entries(map);
  }, [filteredBookings]);

  const isPlanExpired = plan?.plan === "EXPIRED" || plan?.status === "EXPIRED";
  const isBookingLimitExceeded = bookingPlan && bookingPlan.limit !== Infinity && bookingPlan.remaining !== null && bookingPlan.remaining <= 0;
  const hasNoActiveRooms = plan && plan.activeRooms === 0;
  const isBookingDisabled = isPlanExpired || isBookingLimitExceeded || hasNoActiveRooms;

  const getBookingDisabledMessage = () => {
    if (isPlanExpired) return "Plan expired. Please upgrade.";
    if (isBookingLimitExceeded) return "Booking limit exceeded. Please upgrade.";
    if (hasNoActiveRooms) return "No active rooms. Please add rooms.";
    return "";
  };

  const planUsage = useMemo(() => {
    if (!plan) return null;
    const limit = plan.limit === "Unlimited" ? Infinity : parseInt(plan.limit);
    const total = plan.totalRooms || 0, active = plan.activeRooms || 0, locked = plan.lockedRooms || 0;
    return { limit, total, active, locked, canAddMore: limit === Infinity || total < limit, slotsAvailable: limit === Infinity ? Infinity : Math.max(0, limit - total) };
  }, [plan]);

  const bookingPercentage = bookingPlan?.limit === Infinity ? 100 : Math.min(100, Math.round((bookingPlan?.used / bookingPlan?.limit) * 100));
  const roomPercentage = plan?.limit === "Unlimited" ? 100 : Math.min(100, Math.round((plan?.activeRooms / parseInt(plan?.limit)) * 100));

  const publicURL = publicBookingInfo?.publicUrl || `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company?.slug}`;

  /* ================= NAV HELPERS ================= */
  const openNav = (tab) => {
    setNavTab(tab);
    setNavOpen(true);
    if (tab === "qr" && !publicBookingInfo) loadPublicBookingInfo();
  };

  if (loading) return <div className={styles.container}><div className={styles.loadingState}>Loading dashboard…</div></div>;
  if (!company || !stats) return <div className={styles.container}><div className={styles.loadingState}>Unable to load dashboard</div></div>;

  return (
    <div className={styles.container}>

      {/* ===== NOTIFICATION ===== */}
      {notification.show && (
        <div className={`${styles.toast} ${styles[`toast${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`]}`}>
          {notification.type === "success" ? "✓" : notification.type === "error" ? "✕" : "⚠"} {notification.message}
        </div>
      )}

      {/* ===== NAV OVERLAY ===== */}
      {navOpen && <div className={styles.navOverlay} onClick={() => { setNavOpen(false); cancelEdit(); }} />}

      {/* ===== SINGLE LEFT NAV PANEL ===== */}
      <div className={`${styles.navPanel} ${navOpen ? styles.navPanelOpen : ""}`}>
        <div className={styles.navPanelHeader}>
          <h3>{navTab === "qr" ? "📱 QR Code" : "🏢 Rooms"}</h3>
          <button className={styles.navCloseBtn} onClick={() => { setNavOpen(false); cancelEdit(); }}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className={styles.navTabs}>
          <button className={`${styles.navTabBtn} ${navTab === "qr" ? styles.navTabActive : ""}`} onClick={() => { setNavTab("qr"); if (!publicBookingInfo) loadPublicBookingInfo(); }}>
            📱 QR Code
          </button>
          <button className={`${styles.navTabBtn} ${navTab === "rooms" ? styles.navTabActive : ""}`} onClick={() => setNavTab("rooms")}>
            🏢 Rooms
          </button>
        </div>

        <div className={styles.navPanelBody}>

          {/* ── QR TAB ── */}
          {navTab === "qr" && (
            <>
              {loadingQR ? (
                <div className={styles.navQRLoading}><div className={styles.spinner} /><p>Loading QR Code…</p></div>
              ) : publicBookingInfo ? (
                <>
                  <div className={styles.qrSection}>
                    <img src={publicBookingInfo.qrCode} alt="QR Code" className={styles.qrImage} />
                    <p className={styles.qrHint}>Scan to book</p>
                  </div>
                  <div className={styles.urlSection}>
                    <label>Public Booking URL</label>
                    <div className={styles.urlBox}>
                      <input type="text" value={publicBookingInfo.publicUrl} readOnly className={styles.urlInput} />
                      <button className={styles.copyBtn} onClick={handleShareURL}>📋</button>
                    </div>
                  </div>
                  <button className={styles.downloadBtn} onClick={handleDownloadQR}>💾 Download QR Code</button>
                  <div className={styles.navInstructions}>
                    <h4>How to use:</h4>
                    <ol>
                      <li>Share QR code or URL with employees</li>
                      <li>Authenticate with OTP</li>
                      <li>Book a conference room</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className={styles.navQRLoading}>
                  <p>Failed to load QR code</p>
                  <button className={styles.retryBtn} onClick={loadPublicBookingInfo}>↻ Retry</button>
                </div>
              )}
            </>
          )}

          {/* ── ROOMS TAB ── */}
          {navTab === "rooms" && (
            <>
              {plan && (
                <div className={styles.planBox}>
                  <div className={styles.planRow}>
                    <span>Plan: <b>{plan.plan}</b></span>
                    {plan.limit !== "Unlimited" && <span>Active: <b>{plan.activeRooms}</b>/{plan.limit}</span>}
                    {plan.limit === "Unlimited" && <span>Unlimited 🎉</span>}
                  </div>
                  {plan.lockedRooms > 0 && <div className={styles.lockedInfo}>🔒 {plan.lockedRooms} locked</div>}
                  <div className={styles.planBarBg}>
                    <div className={styles.planBarFill} style={{ width: `${roomPercentage}%`, background: roomPercentage >= 90 ? "#cc1100" : "#00b894" }} />
                  </div>
                  <div className={styles.planActions}>
                    <button className={styles.syncBtn} onClick={handleSyncRooms} disabled={syncing}>{syncing ? "Syncing…" : "🔄 Sync"}</button>
                    <button className={styles.addRoomBtn} onClick={() => setShowAddRoomModal(true)}>+ Add Room</button>
                  </div>
                </div>
              )}

              <div className={styles.roomList}>
                {allRooms.map((r) => (
                  <div key={r.id} className={`${styles.roomItem} ${!r.is_active ? styles.roomLocked : ""}`}>
                    <div className={styles.roomInfo}>
                      <div className={styles.roomNameRow}>
                        <b>{r.room_name}</b>
                        {r.is_active ? <span className={styles.activeBadge}>✓ Active</span> : <span className={styles.lockBadge}>🔒 Locked</span>}
                      </div>
                      <small>#{r.room_number} • Capacity: {r.capacity || "N/A"}</small>
                    </div>

                    {editingRoomId === r.id ? (
                      <div className={styles.editForm}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Room name" autoFocus />
                        <input type="number" value={editCapacity} onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)} placeholder="Capacity" />
                        <div className={styles.editActions}>
                          <button className={styles.saveBtn} onClick={() => saveRoomChanges(r.id)}>Save</button>
                          <button className={styles.cancelEditBtn} onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.roomActions}>
                        <button disabled={!r.is_active} onClick={() => startEditRoom(r)}>Edit</button>
                        <button className={styles.deleteRoomBtn} disabled={!r.is_active} onClick={() => confirmDeleteRoom(r)}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
                {allRooms.length === 0 && <div className={styles.emptyRooms}>No rooms yet. Click "+ Add Room".</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== DELETE CONFIRM MODAL ===== */}
      {showDeleteConfirm && roomToDelete && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Delete "{roomToDelete.room_name}"?</h3>
            <p className={styles.deleteWarning}>⚠️ This cannot be undone.</p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className={styles.modalDelete} onClick={deleteRoom}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD ROOM MODAL ===== */}
      {showAddRoomModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddRoomModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Add New Room</h3>
            {planUsage && !planUsage.canAddMore && <div className={styles.warningBox}>⚠️ Plan limit reached.</div>}
            <div className={styles.formGroup}><label>Room Name *</label><input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g., Board Room" /></div>
            <div className={styles.formGroup}><label>Room Number *</label><input value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} placeholder="e.g., 101" /></div>
            <div className={styles.formGroup}><label>Capacity</label><input type="number" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} placeholder="e.g., 10" /></div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowAddRoomModal(false)} disabled={isCreatingRoom}>Cancel</button>
              <button className={styles.modalPrimary} onClick={createNewRoom} disabled={isCreatingRoom || !newRoomName.trim() || !newRoomNumber.trim()}>{isCreatingRoom ? "Creating…" : "Create Room"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.hamburgerBtn} onClick={() => openNav("qr")} title="Menu">
            <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
          </button>
          <div className={styles.logoText}>{company.name}</div>
        </div>
        <div className={styles.rightHeader}>
          <img src={company.logo_url || "/logo.png"} alt="Logo" className={styles.companyLogo} />
          <button className={styles.bookNowBtn} disabled={isBookingDisabled} onClick={() => {
            if (isBookingDisabled) { showNotification(getBookingDisabledMessage(), "warning"); }
            else { router.push("/conference/bookings"); }
          }}>
            {isPlanExpired ? "Expired" : isBookingLimitExceeded ? "Limit" : hasNoActiveRooms ? "No Rooms" : "Book Now"}
          </button>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>← Back</button>
        </div>
      </header>

      {/* ===== SCROLLABLE BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Conference <span>Dashboard</span></h1>
          <p className={styles.heroSub}>Manage rooms, bookings, and usage in real time</p>

          <div className={styles.heroStats}>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Active Rooms</div>
              <div className={styles.heroStatValue}>{plan?.activeRooms || 0}</div>
              {plan?.lockedRooms > 0 && <div className={styles.heroStatExtra}>+{plan.lockedRooms} locked</div>}
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>{filterDay.charAt(0).toUpperCase() + filterDay.slice(1)} Bookings</div>
              <div className={styles.heroStatValue}>{filteredBookings.length}</div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatLabel}>Departments</div>
              <div className={styles.heroStatValue}>{departmentStats.length}</div>
            </div>
          </div>
        </section>

        {/* ===== BOOKING DISABLED WARNING ===== */}
        {isBookingDisabled && (
          <div className={styles.upgradeMsg}>{getBookingDisabledMessage()}</div>
        )}

        {/* ===== BOOKING USAGE BAR ===== */}
        {bookingPlan && bookingPlan.limit !== Infinity && (
          <div className={styles.usageBarWrapper}>
            <div className={styles.usageHeader}>
              <span className={styles.usageName}>Booking Usage</span>
              <span>{bookingPlan.remaining} remaining</span>
            </div>
            <div className={styles.usageBarBg}>
              <div className={styles.usageBarFill} style={{
                width: `${bookingPercentage}%`,
                background: bookingPercentage >= 90 ? "#cc1100" : bookingPercentage >= 70 ? "#f0a500" : "#00b894"
              }} />
            </div>
            <div className={styles.usageFooter}><span>{bookingPlan.used} / {bookingPlan.limit} used</span></div>
          </div>
        )}

        {/* ===== PUBLIC URL ===== */}
        <div className={styles.publicUrlBar}>
          <span className={styles.publicLabel}>Public URL</span>
          <a href={publicURL} target="_blank" className={styles.publicLink}>{publicURL}</a>
          <button className={styles.shareUrlBtn} onClick={handleShareURL}>🔗 Share</button>
        </div>

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>

          {/* Filter tabs */}
          <div className={styles.filterRow}>
            {["yesterday", "today", "tomorrow"].map((d) => (
              <button key={d} className={`${styles.filterBtn} ${filterDay === d ? styles.filterActive : ""}`} onClick={() => setFilterDay(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          <div className={styles.tablesRow}>
            {/* Department Usage */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>Department Usage</h3>
                <span className={styles.cardCount}>{departmentStats.length}</span>
              </div>
              {departmentStats.length === 0 ? (
                <div className={styles.emptyState}><span className={styles.emptyIcon}>📊</span>No activity for this period</div>
              ) : (
                <div className={styles.tableScroll}>
                  {departmentStats.map(([dep, count]) => (
                    <div key={dep} className={styles.deptRow}>
                      <span>{dep}</span><b>{count} bookings</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Schedule */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <span className={`${styles.cardDot} ${styles.cardDotGreen}`} />
                <h3 className={styles.cardTitle}>Daily Schedule</h3>
                <span className={`${styles.cardCount} ${styles.cardCountGreen}`}>{filteredBookings.length}</span>
              </div>
              {filteredBookings.length === 0 ? (
                <div className={styles.emptyState}><span className={styles.emptyIcon}>📅</span>No bookings scheduled</div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead><tr><th>Room</th><th>Time</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredBookings.slice(0, 10).map((b) => (
                        <tr key={b.id}>
                          <td><span className={styles.roomCode}>{b.room_name}</span><br /><small>#{b.room_number}</small></td>
                          <td>{formatNiceTime(b.start_time)} – {formatNiceTime(b.end_time)}</td>
                          <td><span className={styles.statusBadge}>{b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
