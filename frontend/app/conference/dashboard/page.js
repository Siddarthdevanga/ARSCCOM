"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
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
  } catch {
    return value;
  }
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
  } catch {
    return "-";
  }
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

  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState(0);

  // Add room modal state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [filterDay, setFilterDay] = useState("today");

  /* ================= HELPERS ================= */
  const getDate = useCallback((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  }, []);

  const dates = useMemo(() => ({
    today: getDate(0),
    yesterday: getDate(-1),
    tomorrow: getDate(1)
  }), [getDate]);

  const selectedDate = dates[filterDay];

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
      
      // Handle both array response and {rooms: [...]} response
      const roomsData = Array.isArray(allRoomsRes) ? allRoomsRes : (allRoomsRes?.rooms || []);
      setAllRooms(roomsData);
      
      setBookings(bookingsRes || []);
      setPlan(planRes);

      const bookingLimit =
        planRes?.plan === "TRIAL" ? 100 :
        planRes?.plan === "BUSINESS" ? 1000 :
        Infinity;

      setBookingPlan({
        limit: bookingLimit,
        used: statsRes.totalBookings || 0,
        remaining:
          bookingLimit === Infinity
            ? null
            : Math.max(bookingLimit - (statsRes.totalBookings || 0), 0),
      });

    } catch (err) {
      console.error("Dashboard load error:", err);
      if (err?.message?.includes("expired") || err?.message?.includes("inactive")) {
        alert(err.message);
      } else {
        router.replace("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ================= LIFECYCLE ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    setCompany(JSON.parse(storedCompany));
    loadDashboard();
  }, []);

  /* ================= ACTIONS ================= */
  const handleSyncRooms = async () => {
    try {
      setSyncing(true);
      await apiFetch("/api/conference/sync-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      await loadDashboard();
      alert("Rooms synchronized successfully!");
    } catch (err) {
      alert(err?.message || "Failed to sync rooms");
    } finally {
      setSyncing(false);
    }
  };

  const saveRoomName = async (roomId) => {
    const newName = editName.trim();
    const original = allRooms.find((r) => r.id === roomId);

    if (!newName) {
      alert("Room name cannot be empty");
      return;
    }
    
    if (newName === original?.room_name && editCapacity === original?.capacity) {
      setEditingRoomId(null);
      return;
    }

    // Check if room is active before allowing edit
    if (!original?.is_active) {
      alert("This room is locked under your current plan. Please upgrade to edit.");
      setEditingRoomId(null);
      return;
    }

    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          room_name: newName,
          capacity: editCapacity || 0
        }),
      });

      setEditingRoomId(null);
      setEditName("");
      setEditCapacity(0);
      await loadDashboard();
    } catch (err) {
      alert(err?.message || "Failed to update room. This room may be locked under your current plan.");
    }
  };

  const deleteRoom = async (roomId) => {
    const room = allRooms.find((r) => r.id === roomId);
    
    if (!room?.is_active) {
      alert("Cannot delete locked rooms. Please upgrade your plan first.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${room.room_name}"?`)) {
      return;
    }

    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "DELETE",
      });

      await loadDashboard();
      alert("Room deleted successfully");
    } catch (err) {
      alert(err?.message || "Failed to delete room");
    }
  };

  const createNewRoom = async () => {
    const name = newRoomName.trim();
    const number = newRoomNumber.trim();
    const capacity = parseInt(newRoomCapacity) || 0;

    if (!name || !number) {
      alert("Room name and number are required");
      return;
    }

    // Check if room number already exists
    if (allRooms.some(r => String(r.room_number) === String(number))) {
      alert("Room number already exists. Please use a different number.");
      return;
    }

    setIsCreatingRoom(true);

    try {
      const response = await apiFetch("/api/conference/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: name,
          room_number: number,
          capacity: capacity,
        }),
      });

      // Reset form
      setNewRoomName("");
      setNewRoomNumber("");
      setNewRoomCapacity("");
      setShowAddRoomModal(false);
      
      // Reload dashboard to get updated room list
      await loadDashboard();
      
      // Show appropriate message based on whether room was activated
      if (response?.isActive) {
        alert("Room created and activated successfully!");
      } else {
        alert("Room created successfully! This room is locked. Upgrade your plan to activate it.");
      }
    } catch (err) {
      alert(err?.message || "Failed to create room");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  /* ================= COMPUTED DATA ================= */
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const date = b.booking_date?.includes("T")
        ? b.booking_date.split("T")[0]
        : b.booking_date;
      return date === selectedDate && b.status === "BOOKED";
    });
  }, [bookings, selectedDate]);

  const departmentStats = useMemo(() => {
    const map = {};
    filteredBookings.forEach((b) => {
      const dep = b.department || "Unknown";
      map[dep] = (map[dep] || 0) + 1;
    });
    return Object.entries(map);
  }, [filteredBookings]);

  // Calculate plan usage
  const planUsage = useMemo(() => {
    if (!plan) return null;
    
    const limit = plan.limit === "Unlimited" ? Infinity : parseInt(plan.limit);
    const total = plan.totalRooms || 0;
    const active = plan.activeRooms || 0;
    const locked = plan.lockedRooms || 0;
    const canAddMore = limit === Infinity || total < limit;
    
    return {
      limit,
      total,
      active,
      locked,
      canAddMore,
      slotsAvailable: limit === Infinity ? Infinity : Math.max(0, limit - total)
    };
  }, [plan]);

  if (loading) return <div className={styles.container}>Loading dashboard…</div>;
  if (!company || !stats) return <div className={styles.container}>Unable to load dashboard</div>;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  const roomPercentage =
    plan?.limit === "Unlimited"
      ? 100
      : Math.min(100, Math.round((plan?.activeRooms / parseInt(plan?.limit)) * 100));

  const bookingPercentage =
    bookingPlan?.limit === Infinity
      ? 100
      : Math.min(100, Math.round((bookingPlan?.used / bookingPlan?.limit) * 100));

  return (
    <div className={styles.container}>
      {/* ADD ROOM MODAL */}
      {showAddRoomModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddRoomModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add New Conference Room</h3>
              <button 
                className={styles.closeBtn}
                onClick={() => setShowAddRoomModal(false)}
              >
                ✖
              </button>
            </div>

            <div className={styles.modalBody}>
              {planUsage && !planUsage.canAddMore && (
                <div className={styles.warningBox}>
                  ⚠️ You've reached your plan limit of {planUsage.limit} rooms.
                  The room will be created but will remain locked until you upgrade.
                </div>
              )}

              {planUsage && planUsage.locked > 0 && planUsage.canAddMore && (
                <div className={styles.infoBox}>
                  ℹ️ You have {planUsage.locked} locked room(s). 
                  This new room will be activated automatically if slots are available.
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Board Room"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Room Number *</label>
                <input
                  type="text"
                  placeholder="e.g., 101, A1, CR-01"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  maxLength={20}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Capacity (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g., 10"
                  value={newRoomCapacity}
                  onChange={(e) => setNewRoomCapacity(e.target.value)}
                  min="0"
                  max="1000"
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setShowAddRoomModal(false)}
                  disabled={isCreatingRoom}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={createNewRoom}
                  disabled={isCreatingRoom || !newRoomName.trim() || !newRoomNumber.trim()}
                >
                  {isCreatingRoom ? "Creating..." : "Create Room"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <header className={styles.header}>
        <div className={styles.leftHeader}>
          <div className={styles.leftMenuTrigger} onClick={() => setSidePanelOpen(true)}>
            <span></span><span></span><span></span>
          </div>

          <div>
            <h2 className={styles.companyName}>{company.name}</h2>
            <span className={styles.subText}>Conference Dashboard</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <img src={company.logo_url || "/logo.png"} className={styles.logo} alt="Company Logo" />
          
          <button
            className={styles.logoBtn}
            title="Back to Home"
            onClick={() => router.push("/home")}
          >
            ↩
          </button>
        </div>
      </header>

      {/* PUBLIC URL SECTION */}
      <div className={styles.publicBox}>
        <div className={styles.publicRow}>
          <div>
            <p className={styles.publicTitle}>Public Booking URL</p>
            <a href={publicURL} target="_blank" className={styles.publicLink}>
              {publicURL}
            </a>
          </div>

          <button className={styles.bookBtn} onClick={() => router.push("/conference/bookings")}>
            Book
          </button>
        </div>
      </div>

      {/* BOOKING LIMITS / PROGRESS */}
      {bookingPlan && (
        <div className={styles.section}>
          <h3>Conference Booking Usage</h3>
          {bookingPlan.limit === Infinity ? (
            <p>Unlimited Bookings Available 🎉</p>
          ) : (
            <p>
              Used <b>{bookingPlan.used}</b> / {bookingPlan.limit} |
              Remaining: <b>{bookingPlan.remaining}</b>
            </p>
          )}
          <div className={styles.barOuter}>
            <div
              className={styles.barInner}
              style={{
                width: bookingPercentage + "%",
                background:
                  bookingPercentage >= 90 ? "#ff1744" : 
                  bookingPercentage >= 70 ? "#ff9800" : "#00c853",
              }}
            ></div>
          </div>
        </div>
      )}

      {/* SLIDE-OUT PANEL: ROOM MANAGEMENT */}
      {sidePanelOpen && (
        <div className={styles.leftPanel}>
          <div className={styles.leftPanelHeader}>
            <h3>Plan & Room Settings</h3>
            <button
              className={styles.leftCloseBtn}
              onClick={() => {
                setSidePanelOpen(false);
                setEditingRoomId(null);
                setEditName("");
                setEditCapacity(0);
              }}
            >
              Close ✖
            </button>
          </div>

          {plan && (
            <div style={{ padding: "0 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0 }}>Plan: <b>{plan.plan}</b></p>
                  {plan.limit === "Unlimited" ? (
                    <p style={{ margin: "5px 0 0 0" }}>Unlimited Rooms 🎉</p>
                  ) : (
                    <>
                      <p style={{ margin: "5px 0 0 0" }}>
                        Active: <b>{plan.activeRooms}</b> / {plan.limit}
                      </p>
                      {plan.lockedRooms > 0 && (
                        <p style={{ margin: "5px 0 0 0", color: "#ff9800" }}>
                          🔒 Locked: <b>{plan.lockedRooms}</b>
                        </p>
                      )}
                    </>
                  )}
                </div>
                
                <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                  <button
                    className={styles.syncBtn}
                    onClick={handleSyncRooms}
                    disabled={syncing}
                    title="Sync room activation with current plan"
                    style={{ 
                      padding: "6px 12px",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      opacity: syncing ? 0.6 : 1
                    }}
                  >
                    {syncing ? "Syncing..." : "🔄 Sync"}
                  </button>
                  
                  <button
                    className={styles.addRoomBtn}
                    onClick={() => setShowAddRoomModal(true)}
                    title={planUsage && !planUsage.canAddMore ? "You can still create rooms, but they will be locked" : "Add new room"}
                    style={{ padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    + Add Room
                  </button>
                </div>
              </div>

              <div className={styles.barOuter}>
                <div
                  className={styles.barInner}
                  style={{
                    width: roomPercentage + "%",
                    background: roomPercentage >= 90 ? "#ff1744" : "#00c853",
                  }}
                ></div>
              </div>

              {planUsage && planUsage.slotsAvailable !== Infinity && (
                <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#666" }}>
                  {planUsage.slotsAvailable > 0 
                    ? `${planUsage.slotsAvailable} slot(s) available for activation`
                    : "No slots available - upgrade to activate more rooms"}
                </p>
              )}
            </div>
          )}

          <div className={styles.leftPanelContent}>
            <h4 style={{ padding: "0 20px", margin: "10px 0" }}>All Rooms</h4>
            <ul className={styles.roomList}>
              {allRooms.map((r) => (
                <li 
                  key={r.id}
                  className={!r.is_active ? styles.lockedRoom : ""}
                  style={{
                    opacity: !r.is_active ? 0.6 : 1,
                    background: !r.is_active ? "#f5f5f5" : "#fff"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <b style={{ color: !r.is_active ? "#999" : "#333" }}>{r.room_name}</b>
                      {!r.is_active && (
                        <span className={styles.lockBadge} style={{
                          background: "#ff9800",
                          color: "#fff",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          🔒 Locked
                        </span>
                      )}
                      {r.is_active && (
                        <span style={{
                          background: "#00c853",
                          color: "#fff",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          ✓ Active
                        </span>
                      )}
                    </div>
                    <small style={{ color: !r.is_active ? "#999" : "#666" }}>
                      #{r.room_number} • Capacity: {r.capacity || "N/A"}
                    </small>
                  </div>

                  {editingRoomId === r.id ? (
                    <div style={{ marginTop: 10, width: "100%" }}>
                      <input
                        style={{ width: "100%", marginBottom: 5 }}
                        placeholder="Room name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <input
                        style={{ width: "100%", marginBottom: 5 }}
                        type="number"
                        placeholder="Capacity"
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                      />
                      <div style={{ display: "flex", gap: 5 }}>
                        <button 
                          onClick={() => saveRoomName(r.id)}
                          style={{ flex: 1 }}
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => {
                            setEditingRoomId(null);
                            setEditName("");
                            setEditCapacity(0);
                          }}
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        disabled={!r.is_active}
                        style={{
                          opacity: !r.is_active ? 0.5 : 1,
                          cursor: !r.is_active ? "not-allowed" : "pointer",
                          padding: "6px 12px",
                          fontSize: 12
                        }}
                        onClick={() => {
                          if (r.is_active) {
                            setEditingRoomId(r.id);
                            setEditName(r.room_name);
                            setEditCapacity(r.capacity || 0);
                          }
                        }}
                        title={!r.is_active ? "Upgrade plan to edit this room" : "Edit room"}
                      >
                        Edit
                      </button>
                      
                      <button
                        disabled={!r.is_active}
                        style={{
                          opacity: !r.is_active ? 0.5 : 1,
                          cursor: !r.is_active ? "not-allowed" : "pointer",
                          padding: "6px 12px",
                          fontSize: 12,
                          background: "#ff1744",
                          color: "#fff"
                        }}
                        onClick={() => r.is_active && deleteRoom(r.id)}
                        title={!r.is_active ? "Upgrade plan to delete this room" : "Delete room"}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}

              {allRooms.length === 0 && (
                <li style={{ textAlign: "center", color: "#999", padding: 20 }}>
                  No rooms yet. Click "Add Room" to create one.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* BOOKING FILTERS */}
      <div className={styles.section}>
        <h3>Bookings View</h3>
        <div style={{ display: "flex", gap: 10 }}>
          {["yesterday", "today", "tomorrow"].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDay(d)}
              style={{
                background: filterDay === d ? "#7a00ff" : "#f0f0f0",
                color: filterDay === d ? "#fff" : "#333",
                padding: "8px 18px",
                borderRadius: 30,
                border: "none",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD KPIs */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Active Rooms</span>
          <b>{plan?.activeRooms || 0}</b>
          {plan && plan.lockedRooms > 0 && (
            <small style={{ color: "#ff9800", fontSize: 11 }}>
              +{plan.lockedRooms} locked
            </small>
          )}
        </div>

        <div className={styles.statCard}>
          <span>{filterDay.toUpperCase()} Bookings</span>
          <b>{filteredBookings.length}</b>
        </div>

        <div className={styles.statCard}>
          <span>Active Departments</span>
          <b>{departmentStats.length}</b>
        </div>
      </div>

      {/* ANALYTICS: DEPARTMENTS */}
      <div className={styles.section}>
        <h3>Department Usage</h3>
        {departmentStats.length === 0 ? (
          <p>No activity recorded for this period.</p>
        ) : (
          <ul className={styles.roomList}>
            {departmentStats.map(([dep, count]) => (
              <li key={dep}>
                <b>{dep}</b> — {count} bookings
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* BOOKINGS LIST */}
      <div className={styles.section}>
        <h3>Daily Schedule</h3>
        {filteredBookings.length === 0 && <p>No bookings scheduled.</p>}
        {filteredBookings.slice(0, 10).map((b) => (
          <div key={b.id} className={styles.bookingRow}>
            <div>
              <b>{b.room_name}</b> (#{b.room_number})
              <p style={{ margin: 0, fontSize: 12, color: "#666" }}>{formatNiceDate(b.booking_date)}</p>
            </div>
            <div>
              {formatNiceTime(b.start_time)} – {formatNiceTime(b.end_time)}
            </div>
            <div className={styles.status} style={{ fontWeight: 800, color: "#7a00ff" }}>{b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
