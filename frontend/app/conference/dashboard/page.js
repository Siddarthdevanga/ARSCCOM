"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, downloadQRCode, shareURL, fetchPublicBookingInfo } from "../../utils/api";
import styles from "./style.module.css";


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
  const [newRoomImage, setNewRoomImage] = useState(null);
  const [newRoomImagePreview, setNewRoomImagePreview] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Edit room image
  const [editRoomImage, setEditRoomImage] = useState(null);
  const [editRoomImagePreview, setEditRoomImagePreview] = useState(null);

  const [filterDay] = useState("today");

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
    setEditingRoomId(room.id);
    setEditName(room.room_name);
    setEditCapacity(room.capacity || 0);
    setEditRoomImage(null);
    // Pre-fill preview with existing room image so admin sees the current photo
    setEditRoomImagePreview(room.image_url || null);
  };

  const cancelEdit = () => {
    setEditingRoomId(null); setEditName(""); setEditCapacity(0);
    setEditRoomImage(null); setEditRoomImagePreview(null);
  };

  const saveRoomChanges = async (roomId) => {
    const newName = editName.trim();
    const original = allRooms.find((r) => r.id === roomId);
    if (!newName) { showNotification("Name cannot be empty", "error"); return; }
    if (!original?.is_active) { showNotification("Room locked.", "warning"); cancelEdit(); return; }
    try {
      const token = localStorage.getItem("token");
      const base = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/conference/rooms/${roomId}`;

      const res = await fetch(base, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: newName, capacity: editCapacity || 0 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message || "Update failed"); }

      if (editRoomImage) {
        const fd = new FormData();
        fd.append("image", editRoomImage);
        const imgRes = await fetch(`${base}/image`, {
          method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (!imgRes.ok) { const d = await imgRes.json(); throw new Error(d?.message || "Image upload failed"); }
      }

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
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("room_name", name);
      fd.append("room_number", number);
      fd.append("capacity", capacity);
      if (newRoomImage) fd.append("image", newRoomImage);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/conference/rooms`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message || "Create failed"); }
      const response = await res.json();
      setNewRoomName(""); setNewRoomNumber(""); setNewRoomCapacity("");
      setNewRoomImage(null); setNewRoomImagePreview(null); setShowAddRoomModal(false);
      await loadDashboard();
      showNotification(response?.isActive ? "Room created and activated!" : "Room created. Upgrade to activate.", response?.isActive ? "success" : "warning");
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

  const analyticsData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    const last7 = bookings.filter((b) => {
      const bd = b.booking_date?.split("T")[0] || b.booking_date;
      return days.includes(bd) && b.status === "BOOKED";
    });
    // bookings over time
    const byDay = {};
    days.forEach((d) => { byDay[d] = 0; });
    last7.forEach((b) => { const bd = b.booking_date?.split("T")[0] || b.booking_date; if (byDay[bd] !== undefined) byDay[bd]++; });
    const dailyCounts = days.map((d) => ({ label: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday:"short" }), count: byDay[d], date: d }));
    // bookings per room
    const byRoom = {};
    last7.forEach((b) => { const key = b.room_name || "Unknown"; byRoom[key] = (byRoom[key] || 0) + 1; });
    const roomCounts = Object.entries(byRoom).sort((a, b) => b[1] - a[1]);
    // peak hours (0-23 bucket)
    const byHour = Array(24).fill(0);
    last7.forEach((b) => {
      if (b.start_time) {
        const h = parseInt(String(b.start_time).split(":")[0], 10);
        if (!isNaN(h)) byHour[h]++;
      }
    });
    return { dailyCounts, roomCounts, byHour, total: last7.length };
  }, [bookings]);

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

  if (loading) return <div className={styles.container}><div className={styles.loadingState}>Loading dashboard...</div></div>;
  if (!company || !stats) return <div className={styles.container}><div className={styles.loadingState}>Unable to load dashboard</div></div>;

  return (
    <div className={styles.container}>

      {/* ===== NOTIFICATION ===== */}
      {notification.show && (
        <div className={`${styles.toast} ${styles[`toast${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`]}`}>
          {notification.type === "success" ? "+" : notification.type === "error" ? "x" : "!"} {notification.message}
        </div>
      )}

      {/* ===== NAV OVERLAY ===== */}
      {navOpen && <div className={styles.navOverlay} onClick={() => { setNavOpen(false); cancelEdit(); }} />}

      {/* ===== SINGLE LEFT NAV PANEL ===== */}
      <div className={`${styles.navPanel} ${navOpen ? styles.navPanelOpen : ""}`}>
        <div className={styles.navPanelHeader}>
          <h3>{navTab === "qr" ? "QR Code" : "Rooms"}</h3>
          <button className={styles.navCloseBtn} onClick={() => { setNavOpen(false); cancelEdit(); }}>x</button>
        </div>

        {/* Tab switcher */}
        <div className={styles.navTabs}>
          <button className={`${styles.navTabBtn} ${navTab === "qr" ? styles.navTabActive : ""}`} onClick={() => { setNavTab("qr"); if (!publicBookingInfo) loadPublicBookingInfo(); }}>
            QR Code
          </button>
          <button className={`${styles.navTabBtn} ${navTab === "rooms" ? styles.navTabActive : ""}`} onClick={() => setNavTab("rooms")}>
            Rooms
          </button>
        </div>

        <div className={styles.navPanelBody}>

          {/* QR TAB */}
          {navTab === "qr" && (
            <>
              {loadingQR ? (
                <div className={styles.navQRLoading}><div className={styles.spinner} /><p>Loading QR Code...</p></div>
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
                      <button className={styles.copyBtn} onClick={handleShareURL}>Copy</button>
                    </div>
                  </div>
                  <button className={styles.downloadBtn} onClick={handleDownloadQR}>Download QR Code</button>
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
                  <button className={styles.retryBtn} onClick={loadPublicBookingInfo}>Retry</button>
                </div>
              )}
            </>
          )}

          {/* ROOMS TAB */}
          {navTab === "rooms" && (
            <>
              {plan && (
                <div className={styles.planBox}>
                  <div className={styles.planRow}>
                    <span>Plan: <b>{plan.plan}</b></span>
                    {plan.limit !== "Unlimited" && <span>Active: <b>{plan.activeRooms}</b>/{plan.limit}</span>}
                    {plan.limit === "Unlimited" && <span>Unlimited</span>}
                  </div>
                  {plan.lockedRooms > 0 && <div className={styles.lockedInfo}>{plan.lockedRooms} locked</div>}
                  <div className={styles.planBarBg}>
                    <div className={styles.planBarFill} style={{ width: `${roomPercentage}%`, background: roomPercentage >= 90 ? "#cc1100" : "#00b894" }} />
                  </div>
                  <div className={styles.planActions}>
                    <button className={styles.syncBtn} onClick={handleSyncRooms} disabled={syncing}>{syncing ? "Syncing..." : "Sync"}</button>
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
                        {r.is_active ? <span className={styles.activeBadge}>Active</span> : <span className={styles.lockBadge}>Locked</span>}
                      </div>
                      <small>#{r.room_number} &bull; Capacity: {r.capacity || "N/A"}</small>
                    </div>

                    {editingRoomId === r.id ? (
                      <div className={styles.editForm}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Room name" autoFocus />
                        <input type="number" value={editCapacity} onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)} placeholder="Capacity" />
                        <div style={{ marginTop:"0.75rem" }}>
                          <label style={{ fontSize:"0.78rem", fontWeight:600, color:"#374151", display:"block", marginBottom:"0.4rem" }}>
                            Room Photo
                          </label>
                          {editRoomImagePreview ? (
                            <div style={{ position:"relative", marginBottom:"0.5rem" }}>
                              <img src={editRoomImagePreview} alt="Room preview"
                                style={{ width:"100%", aspectRatio:"16/9", objectFit:"cover",
                                  borderRadius:"0.5rem", display:"block",
                                  border:"2px solid #7c3aed" }} />
                              <div style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,0.55)",
                                color:"#fff", fontSize:"0.62rem", fontWeight:700, borderRadius:4,
                                padding:"2px 6px", letterSpacing:"0.3px" }}>
                                {editRoomImage ? "NEW PHOTO" : "CURRENT PHOTO"}
                              </div>
                              <button onClick={() => { setEditRoomImage(null); setEditRoomImagePreview(null); }}
                                style={{ position:"absolute", top:6, right:6, background:"rgba(239,68,68,0.85)",
                                  border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer",
                                  color:"#fff", fontSize:"0.85rem", display:"flex", alignItems:"center",
                                  justifyContent:"center", lineHeight:1 }}>
                                ×
                              </button>
                            </div>
                          ) : (
                            <div style={{ width:"100%", aspectRatio:"16/9", background:"#f3f4f6",
                              borderRadius:"0.5rem", display:"flex", alignItems:"center",
                              justifyContent:"center", marginBottom:"0.5rem", border:"2px dashed #d1d5db" }}>
                              <span style={{ fontSize:"0.78rem", color:"#9ca3af" }}>No photo uploaded</span>
                            </div>
                          )}
                          <label style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem",
                            padding:"0.35rem 0.875rem", background:"#ede9fe", color:"#7c3aed",
                            borderRadius:"0.4rem", fontSize:"0.78rem", fontWeight:700, cursor:"pointer" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                            </svg>
                            {editRoomImagePreview ? "Replace Photo" : "Upload Photo"}
                            <input type="file" accept="image/*" style={{ display:"none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) { setEditRoomImage(f); setEditRoomImagePreview(URL.createObjectURL(f)); }
                              }} />
                          </label>
                        </div>
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
            <p className={styles.deleteWarning}>This action cannot be undone.</p>
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
            {planUsage && !planUsage.canAddMore && <div className={styles.warningBox}>Plan limit reached.</div>}
            <div className={styles.formGroup}><label>Room Name *</label><input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g., Board Room" /></div>
            <div className={styles.formGroup}><label>Room Number *</label><input value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} placeholder="e.g., 101" /></div>
            <div className={styles.formGroup}><label>Capacity</label><input type="number" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} placeholder="e.g., 10" /></div>
            <div className={styles.formGroup}>
              <label>Room Image</label>
              {newRoomImagePreview && (
                <img src={newRoomImagePreview} alt="Preview" style={{ width:"100%", aspectRatio:"16/9", objectFit:"cover", borderRadius:"0.5rem", marginBottom:"0.5rem" }} />
              )}
              <input type="file" accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setNewRoomImage(f); setNewRoomImagePreview(URL.createObjectURL(f)); }
                }} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowAddRoomModal(false)} disabled={isCreatingRoom}>Cancel</button>
              <button className={styles.modalPrimary} onClick={createNewRoom} disabled={isCreatingRoom || !newRoomName.trim() || !newRoomNumber.trim()}>{isCreatingRoom ? "Creating..." : "Create Room"}</button>
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
          <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt="Logo" className={styles.companyLogo} onError={e => { e.currentTarget.style.display = "none"; }} />
          <button className={styles.bookNowBtn} disabled={isBookingDisabled} onClick={() => {
            if (isBookingDisabled) { showNotification(getBookingDisabledMessage(), "warning"); }
            else { router.push("/conference/book"); }
          }}>
            {isPlanExpired ? "Expired" : isBookingLimitExceeded ? "Limit Reached" : hasNoActiveRooms ? "No Rooms" : "Book Now"}
          </button>
          <button className={styles.backBtn} onClick={() => router.push("/home")}>&larr; Back</button>
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
          <button className={styles.shareUrlBtn} onClick={handleShareURL}>Share</button>
        </div>

        {/* ===== ROOM SCHEDULE ===== */}
        {allRooms.length > 0 && (
          <section style={{ padding:"0.75rem 1rem 1.5rem" }}>
            <TodayTimeline rooms={allRooms} bookings={bookings} />
          </section>
        )}

        {/* ===== ANALYTICS CHARTS ===== */}
        {analyticsData.total > 0 && (
          <section style={{ padding:"0 1rem 1.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"1rem" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span style={{ fontWeight:700, fontSize:"0.95rem", color:"#1f2937" }}>Analytics</span>
              <span style={{ fontSize:"0.75rem", color:"#9ca3af", fontWeight:600 }}>Last 7 days · {analyticsData.total} bookings</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"1rem" }}>

              {/* Bookings over time */}
              <AreaChart data={analyticsData.dailyCounts} />

              {/* Bookings per room */}
              <RoomBarChart data={analyticsData.roomCounts} />

              {/* Peak hours heatmap */}
              <PeakHoursChart byHour={analyticsData.byHour} />

            </div>
          </section>
        )}

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>

          <div className={styles.tablesRow}>
            {/* Department Usage */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>Department Usage</h3>
                <span className={styles.cardCount}>{departmentStats.length}</span>
              </div>
              {departmentStats.length === 0 ? (
                <div className={styles.emptyState}><span className={styles.emptyIcon}>—</span>No activity for this period</div>
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
                <div className={styles.emptyState}><span className={styles.emptyIcon}>—</span>No bookings scheduled</div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead><tr><th>Room</th><th>Time</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredBookings.slice(0, 10).map((b) => (
                        <tr key={b.id}>
                          <td><span className={styles.roomCode}>{b.room_name}</span><br /><small>#{b.room_number}</small></td>
                          <td>{formatNiceTime(b.start_time)} &ndash; {formatNiceTime(b.end_time)}</td>
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

/* ─── Analytics: Bookings over time (area chart) ─── */
function AreaChart({ data }) {
  const W = 340, H = 120, PAD = 28;
  const max = Math.max(...data.map(d => d.count), 1);
  const xs = data.map((_, i) => PAD + (i / (data.length - 1)) * (W - PAD * 2));
  const ys = data.map(d => PAD + (1 - d.count / max) * (H - PAD * 2));
  const linePts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const areaPts = `${xs[0]},${H - PAD} ` + xs.map((x, i) => `${x},${ys[i]}`).join(" ") + ` ${xs[xs.length - 1]},${H - PAD}`;
  return (
    <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb", padding:"1rem" }}>
      <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#374151", marginBottom:"0.75rem" }}>Bookings Over Time</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0,0.5,1].map((f,i) => (
          <line key={i} x1={PAD} y1={PAD + f*(H-PAD*2)} x2={W-PAD} y2={PAD + f*(H-PAD*2)}
            stroke="#f3f4f6" strokeWidth="1"/>
        ))}
        <polygon points={areaPts} fill="url(#areaGrad)"/>
        <polyline points={linePts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r="3" fill="#7c3aed"/>
            <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{data[i].label}</text>
            {data[i].count > 0 && <text x={x} y={ys[i] - 6} textAnchor="middle" fontSize="9" fontWeight="700" fill="#7c3aed">{data[i].count}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─── Analytics: Bookings per room (horizontal bar chart) ─── */
function RoomBarChart({ data }) {
  const max = Math.max(...data.map(d => d[1]), 1);
  const colors = ["#7c3aed","#0891b2","#059669","#d97706","#dc2626","#9333ea","#0284c7","#16a34a"];
  return (
    <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb", padding:"1rem" }}>
      <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#374151", marginBottom:"0.75rem" }}>Bookings per Room</div>
      {data.length === 0 ? (
        <div style={{ fontSize:"0.78rem", color:"#9ca3af", textAlign:"center", padding:"1.5rem 0" }}>No data</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
          {data.slice(0, 6).map(([room, count], i) => (
            <div key={room}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.72rem", fontWeight:700, color:"#374151", marginBottom:"0.2rem" }}>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%" }}>{room}</span>
                <span style={{ color: colors[i % colors.length] }}>{count}</span>
              </div>
              <div style={{ height:8, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(count/max)*100}%`, background: colors[i % colors.length], borderRadius:99, transition:"width 0.4s" }}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Analytics: Peak hours heatmap ─── */
function PeakHoursChart({ byHour }) {
  const workHours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM
  const max = Math.max(...workHours.map(h => byHour[h]), 1);
  const toLabel = (h) => `${h % 12 || 12}${h >= 12 ? "p" : "a"}`;
  const alpha = (h) => byHour[h] === 0 ? 0.06 : 0.15 + (byHour[h] / max) * 0.85;
  return (
    <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb", padding:"1rem" }}>
      <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#374151", marginBottom:"0.75rem" }}>Peak Hours</div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${workHours.length}, 1fr)`, gap:"3px" }}>
        {workHours.map(h => (
          <div key={h} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
            <div style={{ width:"100%", height:36, borderRadius:5,
              background:`rgba(124,58,237,${alpha(h)})`,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              {byHour[h] > 0 && <span style={{ fontSize:"0.6rem", fontWeight:800, color:"#7c3aed" }}>{byHour[h]}</span>}
            </div>
            <span style={{ fontSize:"0.55rem", color:"#9ca3af", fontWeight:600 }}>{toLabel(h)}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginTop:"0.75rem", justifyContent:"flex-end" }}>
        <span style={{ fontSize:"0.65rem", color:"#9ca3af" }}>low</span>
        {[0.1,0.3,0.55,0.8,1].map((a,i) => (
          <div key={i} style={{ width:12, height:12, borderRadius:3, background:`rgba(124,58,237,${a})` }}/>
        ))}
        <span style={{ fontSize:"0.65rem", color:"#9ca3af" }}>high</span>
      </div>
    </div>
  );
}

/* ─── Room colour palette ─── */
const PALETTE = [
  { bg:"#7c3aed", dim:"#a78bfa" },
  { bg:"#0891b2", dim:"#67e8f9" },
  { bg:"#059669", dim:"#6ee7b7" },
  { bg:"#d97706", dim:"#fcd34d" },
  { bg:"#dc2626", dim:"#fca5a5" },
  { bg:"#9333ea", dim:"#d8b4fe" },
  { bg:"#0284c7", dim:"#7dd3fc" },
  { bg:"#16a34a", dim:"#86efac" },
];

/* ─── Today's Timeline — vertical Google Calendar style ──── */
function TodayTimeline({ rooms, bookings }) {
  const HOUR_H   = 68;
  const START_H  = 7;
  const END_H    = 22;
  const ROOM_COL = 148;
  const TIME_W   = 58;
  const hours    = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const totalH   = (END_H - START_H) * HOUR_H;
  const scrollRef = React.useRef(null);
  const [popup, setPopup] = React.useState(null);

  const toMin = (t) => { if (!t) return 0; const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  const fmt   = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`; };
  const normDate = (d) => {
    if (!d) return "";
    if (d instanceof Date) return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return String(d).includes("T") ? String(d).split("T")[0] : String(d);
  };

  const nowIST  = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayIST = nowIST.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const nowMin  = nowIST.getHours() * 60 + nowIST.getMinutes();
  const nowTop  = ((nowMin - START_H * 60) / 60) * HOUR_H;
  const nowH    = nowIST.getHours();

  const [calView, setCalView] = React.useState("day");
  const [calDate, setCalDate] = React.useState(todayIST);
  const isToday = calDate === todayIST;

  const getWeekDates = (ds) => {
    const d = new Date(ds + "T12:00:00"); const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({length:7}, (_, i) => { const dt = new Date(mon); dt.setDate(mon.getDate() + i); return dt.toLocaleDateString("en-CA"); });
  };
  const getMonthCells = (ds) => {
    const [y, m] = ds.split("-").map(Number);
    const first = new Date(y, m-1, 1); const last = new Date(y, m, 0);
    const pad = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const cells = Array(pad).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    return cells;
  };
  const navigate = (dir) => {
    if (calView === "day") {
      const d = new Date(calDate + "T12:00:00"); d.setDate(d.getDate() + dir); setCalDate(d.toLocaleDateString("en-CA"));
    } else if (calView === "week") {
      const d = new Date(calDate + "T12:00:00"); d.setDate(d.getDate() + 7 * dir); setCalDate(d.toLocaleDateString("en-CA"));
    } else {
      const [y, m] = calDate.split("-").map(Number); const nm = m + dir;
      const ny = y + Math.floor((nm - 1) / 12); const am = ((nm - 1 + 120) % 12) + 1;
      setCalDate(`${ny}-${String(am).padStart(2,"0")}-01`);
    }
  };

  const allNorm = React.useMemo(() =>
    bookings.filter(b => b.status === "BOOKED").map(b => ({ ...b, _date: normDate(b.booking_date) })),
  [bookings]);

  const dayBookings = React.useMemo(() => allNorm.filter(b => b._date === calDate), [allNorm, calDate]);
  const bookingsByDate = React.useMemo(() => {
    const map = {};
    allNorm.forEach(b => { if (!map[b._date]) map[b._date] = []; map[b._date].push(b); });
    return map;
  }, [allNorm]);

  const weekDates   = React.useMemo(() => calView === "week"  ? getWeekDates(calDate)  : [], [calView, calDate]);
  const monthCells  = React.useMemo(() => calView === "month" ? getMonthCells(calDate) : [], [calView, calDate]);

  const headerLabel = React.useMemo(() => {
    if (calView === "day") {
      const d = new Date(calDate + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" });
    }
    if (calView === "week") {
      const wk = getWeekDates(calDate);
      const f = new Date(wk[0] + "T12:00:00"), l = new Date(wk[6] + "T12:00:00");
      return `${f.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${l.toLocaleDateString("en-US",{month:"short",day:"numeric"})}, ${l.getFullYear()}`;
    }
    const [y, m] = calDate.split("-").map(Number);
    return new Date(y, m-1, 1).toLocaleDateString("en-US", { month:"long", year:"numeric" });
  }, [calView, calDate]);

  React.useEffect(() => {
    if (!scrollRef.current || calView !== "day") return;
    scrollRef.current.scrollTop = isToday ? Math.max(0, nowTop - 100) : 0;
  }, [nowTop, isToday, calView]);

  React.useEffect(() => {
    if (!popup) return;
    const handler = () => setPopup(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [popup]);

  const PopupBookingDetail = ({ b, color, roomName }) => {
    const fmt2 = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
    const members = b.team_members || [];
    const displayName = b.booked_by === "ADMIN" ? "Admin" : (b.booked_by_name || b.booked_by?.replace(/\s*\([^)]*\)$/,"").trim() || b.booked_by);
    const displayEmail = b.booked_by?.includes("@") ? b.booked_by : null;
    return (
      <div onClick={e => e.stopPropagation()}
        style={{ position:"fixed", top: Math.min(popup.y, window.innerHeight - 360),
          left: Math.min(popup.x, window.innerWidth - 280),
          width:268, background:"#fff", borderRadius:"0.875rem",
          boxShadow:"0 8px 32px rgba(0,0,0,0.18)", zIndex:1000, overflow:"hidden" }}>
        <div style={{ background:color, padding:"0.75rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff" }}>{roomName}</div>
            <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.85)", marginTop:2 }}>{fmt2(b.start_time)} – {fmt2(b.end_time)}</div>
          </div>
          <button onClick={() => setPopup(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:"0.85rem", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <div style={{ padding:"0.75rem 1rem", fontSize:"0.78rem", color:"#374151" }}>
          <div style={{ marginBottom:"0.4rem" }}>
            <span style={{ color:"#9ca3af", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Booked By</span>
            <div style={{ fontWeight:700, color:"#1f2937", marginTop:2 }}>{displayName}</div>
            {displayEmail && <div style={{ fontSize:"0.65rem", color:"#6b7280", marginTop:1 }}>{displayEmail}</div>}
          </div>
          {b.department && (
            <div style={{ marginBottom:"0.4rem" }}>
              <span style={{ color:"#9ca3af", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Department</span>
              <div style={{ fontWeight:600, marginTop:2 }}>{b.department}</div>
            </div>
          )}
          {b.purpose && (
            <div style={{ marginBottom:"0.4rem" }}>
              <span style={{ color:"#9ca3af", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Purpose</span>
              <div style={{ marginTop:2 }}>{b.purpose}</div>
            </div>
          )}
          {members.length > 0 && (
            <div>
              <span style={{ color:"#9ca3af", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>Team Members</span>
              <div style={{ marginTop:4, display:"flex", flexWrap:"wrap", gap:"0.3rem" }}>
                {members.map((mem, i) => (
                  <span key={i} style={{ background:"#ede9fe", color:"#7c3aed", borderRadius:99, padding:"2px 8px", fontSize:"0.68rem", fontWeight:700 }}>{mem.name || mem}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background:"#fff", borderRadius:"0.875rem", border:"1px solid #e5e7eb", overflow:"clip", position:"relative" }}>
      {/* Top bar */}
      <div style={{ padding:"0.5rem 0.875rem", borderBottom:"1px solid #f3f4f6",
        display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"0.4rem",
        background:"linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
        {/* Title */}
        <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize:"0.8rem", fontWeight:800, color:"#fff" }}>Room Schedule</span>
        </div>
        {/* Controls */}
        <div style={{ display:"flex", alignItems:"center", gap:"0.3rem", flexWrap:"wrap" }}>
          {/* View tabs */}
          {["day","week","month"].map(v => (
            <button key={v} onClick={() => setCalView(v)}
              style={{ padding:"0.17rem 0.5rem", borderRadius:99, fontSize:"0.65rem", fontWeight:700, cursor:"pointer", border:"none",
                background: calView === v ? "#fff" : "rgba(255,255,255,0.18)",
                color: calView === v ? "#7c3aed" : "#fff", transition:"all 0.15s" }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          {/* Date nav */}
          <div style={{ display:"flex", alignItems:"center", gap:"0.15rem", background:"rgba(255,255,255,0.12)", borderRadius:99, padding:"0.1rem 0.3rem" }}>
            <button onClick={() => navigate(-1)} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", fontSize:"1rem", lineHeight:1, padding:"0 2px" }}>‹</button>
            <span style={{ fontSize:"0.62rem", fontWeight:700, color:"#fff", minWidth:90, textAlign:"center" }}>{headerLabel}</span>
            <button onClick={() => navigate(1)} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", fontSize:"1rem", lineHeight:1, padding:"0 2px" }}>›</button>
          </div>
          {!isToday && calView === "day" && (
            <button onClick={() => setCalDate(todayIST)}
              style={{ padding:"0.17rem 0.5rem", borderRadius:99, fontSize:"0.65rem", fontWeight:700, cursor:"pointer", border:"none", background:"rgba(255,255,255,0.18)", color:"#fff" }}>
              Today
            </button>
          )}
          {/* Date / Month picker */}
          {calView === "month" ? (
            <input type="month" value={calDate.slice(0,7)} onChange={e => setCalDate(e.target.value + "-01")}
              style={{ fontSize:"0.6rem", borderRadius:6, border:"1px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.15)", color:"#fff", padding:"0.12rem 0.25rem", cursor:"pointer" }} />
          ) : (
            <input type="date" value={calDate} onChange={e => e.target.value && setCalDate(e.target.value)}
              style={{ fontSize:"0.6rem", borderRadius:6, border:"1px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.15)", color:"#fff", padding:"0.12rem 0.25rem", cursor:"pointer" }} />
          )}
          {calView === "day" && isToday && (
            <button onClick={() => scrollRef.current && (scrollRef.current.scrollTop = Math.max(0, nowTop - 100))}
              style={{ fontSize:"0.65rem", color:"#7c3aed", background:"#fff", border:"none", borderRadius:99, padding:"0.17rem 0.5rem", cursor:"pointer", fontWeight:700, display:"flex", alignItems:"center", gap:"0.2rem" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Now
            </button>
          )}
        </div>
      </div>

      {/* ── Day View ── */}
      {calView === "day" && (
        <>
          {/* Scroll container wraps BOTH the sticky header and timeline so sticky works correctly */}
          <div ref={scrollRef} style={{ overflowY:"auto", overflowX:"auto", maxHeight:480, overscrollBehavior:"contain" }}>
            {/* Sticky room-name header — inside the scroll container so it sticks while scrolling vertically */}
            <div style={{ display:"flex", borderBottom:"2px solid #e5e7eb", background:"#fafafa", position:"sticky", top:0, zIndex:10, minWidth: TIME_W + rooms.length * ROOM_COL }}>
              <div style={{ width:TIME_W, flexShrink:0 }} />
              {rooms.map((r, i) => {
                const col = PALETTE[i % PALETTE.length];
                return (
                  <div key={r.id} style={{ width:ROOM_COL, flexShrink:0, padding:"0.5rem 0.4rem", borderLeft:"1px solid #e5e7eb", textAlign:"center", borderTop:`3px solid ${col.bg}` }}>
                    <div style={{ fontSize:"0.72rem", fontWeight:800, color:"#1f2937", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.room_name}</div>
                    <div style={{ fontSize:"0.6rem", color:"#9ca3af" }}>#{r.room_number}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", position:"relative", minWidth: TIME_W + rooms.length * ROOM_COL }}>
              <div style={{ width:TIME_W, flexShrink:0 }}>
                {hours.map(h => (
                  <div key={h} style={{ height:HOUR_H, display:"flex", alignItems:"flex-start", paddingTop:5, paddingRight:8, justifyContent:"flex-end", boxSizing:"border-box" }}>
                    <span style={{ fontSize:"0.62rem", fontWeight: h === nowH ? 800 : 400, color: h === nowH ? "#7c3aed" : "#9ca3af", whiteSpace:"nowrap" }}>
                      {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h-12} PM`}
                    </span>
                  </div>
                ))}
              </div>
              {rooms.map((room, ri) => {
                const col = PALETTE[ri % PALETTE.length];
                const roomBk = dayBookings.filter(b => b.room_id === room.id);
                return (
                  <div key={room.id} style={{ width:ROOM_COL, flexShrink:0, position:"relative", borderLeft:"1px solid #e5e7eb", height:totalH }}>
                    {hours.map(h => (
                      <div key={h} style={{ position:"absolute", top:(h-START_H)*HOUR_H, left:0, right:0, height:HOUR_H, borderBottom:"1px solid #f3f4f6", background: h === nowH ? `${col.bg}08` : h % 2 === 0 ? "#fafafa" : "#fff" }} />
                    ))}
                    {isToday && nowTop >= 0 && nowTop <= totalH && (
                      <div style={{ position:"absolute", top:nowTop, left:0, right:0, height:2, background:"#ef4444", zIndex:5, display:"flex", alignItems:"center" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", marginLeft:-4, flexShrink:0 }} />
                      </div>
                    )}
                    {roomBk.map((b, bi) => {
                      const sMin = toMin(b.start_time), eMin = toMin(b.end_time);
                      const top  = Math.max(0, ((sMin - START_H*60)/60)*HOUR_H);
                      const ht   = Math.max(22, ((eMin-sMin)/60)*HOUR_H - 3);
                      const isPast = eMin < nowMin, isNow = sMin <= nowMin && eMin > nowMin;
                      const bg = isPast ? col.dim : col.bg;
                      const name = b.booked_by_name || b.booked_by?.split("(")?.[0]?.trim() || "Booked";
                      return (
                        <div key={bi}
                          onClick={(e) => { e.stopPropagation(); setPopup({ booking:b, roomName:room.room_name, color:col.bg, x:e.clientX, y:e.clientY }); }}
                          style={{ position:"absolute", top, left:3, right:3, height:ht, background:bg, borderRadius:6, padding:"3px 6px", overflow:"hidden", zIndex:3, cursor:"pointer", opacity: isPast ? 0.55 : 1, boxShadow: isNow ? `0 0 0 2px #fff, 0 0 0 4px ${col.bg}` : `0 1px 4px ${col.bg}44`, transition:"transform 0.1s" }}
                          onMouseEnter={e => e.currentTarget.style.transform="scale(1.02)"}
                          onMouseLeave={e => e.currentTarget.style.transform=""}>
                          <div style={{ fontSize:"0.6rem", color:"#fff", fontWeight:700, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fmt(b.start_time)}</div>
                          {ht > 34 && <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,0.9)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Week View ── */}
      {calView === "week" && (
        <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:480, overscrollBehavior:"contain" }}>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(7, minmax(120px, 1fr))`, borderTop:"1px solid #f3f4f6", minWidth:700 }}>
            {weekDates.map((d, di) => {
              const dateObj = new Date(d + "T12:00:00");
              const dayBks = bookingsByDate[d] || [];
              const isTd = d === todayIST;
              return (
                <div key={d}
                  onClick={(e) => { e.stopPropagation(); setPopup({ type:"day", date:d, bookings:dayBks, x:e.clientX, y:e.clientY }); }}
                  style={{ padding:"0.6rem 0.5rem", borderLeft: di > 0 ? "1px solid #f3f4f6" : "none", cursor:"pointer", minHeight:130, background: isTd ? "#f5f3ff" : "#fff" }}
                  onMouseEnter={e => !isTd && (e.currentTarget.style.background="#fafafa")}
                  onMouseLeave={e => !isTd && (e.currentTarget.style.background="#fff")}>
                  <div style={{ fontSize:"0.58rem", color: isTd ? "#7c3aed" : "#9ca3af", fontWeight:700, textTransform:"uppercase" }}>
                    {dateObj.toLocaleDateString("en-US",{weekday:"short"})}
                  </div>
                  <div style={{ fontSize:"1rem", fontWeight:800, color: isTd ? "#7c3aed" : "#1f2937", marginBottom:"0.3rem" }}>{dateObj.getDate()}</div>
                  {dayBks.length === 0
                    ? <div style={{ fontSize:"0.58rem", color:"#d1d5db" }}>No bookings</div>
                    : <>
                        <div style={{ fontSize:"0.6rem", fontWeight:700, color:"#7c3aed", marginBottom:"0.2rem" }}>{dayBks.length} booking{dayBks.length !== 1 ? "s" : ""}</div>
                        {dayBks.slice(0,3).map((b, i) => {
                          const rIdx = rooms.findIndex(r => r.id === b.room_id);
                          const color = PALETTE[rIdx >= 0 ? rIdx % PALETTE.length : 0].bg;
                          return (
                            <div key={i} style={{ fontSize:"0.56rem", color:"#374151", marginBottom:2, padding:"1px 4px", borderLeft:`2px solid ${color}`, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {fmt(b.start_time)} · {b.room_name}
                            </div>
                          );
                        })}
                        {dayBks.length > 3 && <div style={{ fontSize:"0.54rem", color:"#9ca3af" }}>+{dayBks.length - 3} more</div>}
                      </>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Month View ── */}
      {calView === "month" && (
        <div style={{ padding:"0.5rem", overflowY:"auto", maxHeight:480, overscrollBehavior:"contain" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", marginBottom:"0.25rem" }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:"0.6rem", fontWeight:700, color:"#9ca3af", padding:"0.2rem 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2 }}>
            {monthCells.map((d, idx) => {
              if (!d) return <div key={idx} />;
              const isTd = d === todayIST;
              const dayBks = bookingsByDate[d] || [];
              return (
                <div key={d}
                  onClick={(e) => { e.stopPropagation(); setPopup({ type:"day", date:d, bookings:dayBks, x:e.clientX, y:e.clientY }); }}
                  style={{ padding:"0.3rem", borderRadius:"0.35rem", minHeight:52, cursor:"pointer",
                    background: isTd ? "#f5f3ff" : "#fafafa", border:`1px solid ${isTd ? "#a78bfa" : "#e5e7eb"}` }}
                  onMouseEnter={e => !isTd && (e.currentTarget.style.background="#f3f4f6")}
                  onMouseLeave={e => !isTd && (e.currentTarget.style.background="#fafafa")}>
                  <div style={{ fontSize:"0.7rem", fontWeight: isTd ? 800 : 600, color: isTd ? "#7c3aed" : "#374151" }}>
                    {parseInt(d.split("-")[2])}
                  </div>
                  {dayBks.length > 0 && (
                    <span style={{ fontSize:"0.55rem", fontWeight:700, color:"#7c3aed", background:"#ede9fe", borderRadius:99, padding:"0 4px", marginTop:2, display:"inline-block" }}>
                      {dayBks.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Single booking popup (day view click) ── */}
      {popup && !popup.type && (
        <PopupBookingDetail b={popup.booking} color={popup.color} roomName={popup.roomName} />
      )}

      {/* ── Day summary popup (week/month click) ── */}
      {popup?.type === "day" && (() => {
        const fmt2 = (t) => { if (!t) return ""; const [h, m] = String(t).split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; };
        const dl = new Date(popup.date + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
        return (
          <div onClick={e => e.stopPropagation()}
            style={{ position:"fixed", top: Math.min(popup.y, window.innerHeight - 360), left: Math.min(popup.x, window.innerWidth - 280),
              width:272, background:"#fff", borderRadius:"0.875rem", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", zIndex:1000, overflow:"hidden" }}>
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#a78bfa)", padding:"0.75rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff" }}>{dl}</div>
                <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.85)", marginTop:2 }}>
                  {popup.bookings.length} booking{popup.bookings.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => setPopup(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:"0.85rem", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ maxHeight:280, overflowY:"auto" }}>
              {popup.bookings.length === 0
                ? <div style={{ padding:"1rem", textAlign:"center", color:"#9ca3af", fontSize:"0.75rem" }}>No bookings</div>
                : popup.bookings.map((b, i) => {
                    const rIdx = rooms.findIndex(r => r.id === b.room_id);
                    const col  = PALETTE[rIdx >= 0 ? rIdx % PALETTE.length : 0];
                    const name = b.booked_by_name || b.booked_by?.split("(")?.[0]?.trim() || b.booked_by;
                    const email = b.booked_by?.includes("@") ? b.booked_by : null;
                    return (
                      <div key={i} style={{ padding:"0.55rem 1rem", borderBottom:"1px solid #f3f4f6", borderLeft:`3px solid ${col.bg}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ fontWeight:700, fontSize:"0.75rem", color:"#1f2937" }}>{b.room_name}</div>
                          <div style={{ fontSize:"0.62rem", color:"#7c3aed", fontWeight:700 }}>{fmt2(b.start_time)}–{fmt2(b.end_time)}</div>
                        </div>
                        <div style={{ fontSize:"0.68rem", color:"#374151", marginTop:2, fontWeight:600 }}>{name}</div>
                        {email && <div style={{ fontSize:"0.62rem", color:"#6b7280" }}>{email}</div>}
                        {b.department && <div style={{ fontSize:"0.62rem", color:"#9ca3af", marginTop:1 }}>{b.department}</div>}
                        {b.purpose && <div style={{ fontSize:"0.62rem", color:"#6b7280", marginTop:1 }}>"{b.purpose}"</div>}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        );
      })()}
    </div>
  );
}
