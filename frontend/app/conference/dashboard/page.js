"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ---------------- DATE/TIME FORMATTERS ---------------- */
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

export default function ConferenceDashboard() {
  const router = useRouter();

  /* ================= STATE ================= */
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newRoom, setNewRoom] = useState({ room_name: '', room_number: '' });
  const [searchRooms, setSearchRooms] = useState("");
  const [filterDay, setFilterDay] = useState("today");

  /* ================= DATE HELPERS ================= */
  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const today = getDate(0);
  const yesterday = getDate(-1);
  const tomorrow = getDate(1);
  const selectedDate = filterDay === "yesterday" ? yesterday : filterDay === "tomorrow" ? tomorrow : today;

  /* ================= LOAD DASHBOARD ================= */
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statsRes, roomsRes, allRoomsRes, planRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),      // Active rooms
        apiFetch("/api/conference/rooms/all"),  // All rooms for panel
        apiFetch("/api/conference/plan-usage"),
      ]);

      setStats(statsRes ?? {});
      setRooms(Array.isArray(roomsRes) ? roomsRes : []);
      setAllRooms(Array.isArray(allRoomsRes) ? allRoomsRes : []);
      setPlan(planRes ?? null);
    } catch (err) {
      console.error("[DASHBOARD ERROR]", err);
      setError(err?.message || "Failed to load dashboard");
      if (err?.status === 403) {
        localStorage.clear();
        router.replace("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  /* ================= CREATE ROOM ================= */
  const createRoom = async () => {
    if (!newRoom.room_name?.trim() || !newRoom.room_number) {
      alert("Room name & number required");
      return;
    }
    try {
      await apiFetch("/api/conference/rooms", {
        method: "POST",
        body: JSON.stringify(newRoom),
      });
      setNewRoom({ room_name: '', room_number: '' });
      loadDashboard();
    } catch (err) {
      alert(err?.message || "Failed to create room");
    }
  };

  /* ================= SAVE ROOM NAME ================= */
  const saveRoomName = async (roomId) => {
    const newName = editName.trim();
    const original = allRooms.find((r) => r.id === roomId)?.room_name;

    if (!newName) {
      alert("Room name is required");
      return;
    }
    if (newName === original) {
      setEditingRoomId(null);
      setEditName("");
      return;
    }

    try {
      await apiFetch("/api/conference/rooms/rename", {
        method: "POST",
        body: JSON.stringify({ id: roomId, room_name: newName }),
      });
      setEditingRoomId(null);
      setEditName("");
      loadDashboard();
    } catch (err) {
      alert(err?.message || "Failed to rename room");
    }
  };

  /* ================= FILTER ROOMS ================= */
  const filteredRooms = useMemo(() => {
    return allRooms.filter(r => 
      r.room_name.toLowerCase().includes(searchRooms.toLowerCase()) ||
      r.room_number.toString().includes(searchRooms)
    ).sort((a, b) => a.room_number - b.room_number);
  }, [allRooms, searchRooms]);

  /* ================= CALCULATIONS ================= */
  const roomPercentage = plan?.plan_limit === "UNLIMITED" 
    ? 100 
    : Math.min(100, Math.round((plan?.used / parseInt(plan?.plan_limit)) * 100 || 0));

  const bookingPercentage = stats?.totalBookings ? Math.min(100, Math.round((stats.totalBookings / 1000) * 100)) : 0;
  const canCreateRoom = plan?.remaining > 0 || plan?.plan_limit === "UNLIMITED";
  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company?.slug}`;

  /* ================= INIT ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedCompany = localStorage.getItem("company");

    if (!token || !storedCompany) {
      router.replace("/auth/login");
      return;
    }

    try {
      setCompany(JSON.parse(storedCompany));
      loadDashboard();
    } catch {
      localStorage.clear();
      router.replace("/auth/login");
    }
  }, [loadDashboard, router]);

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className={styles.container}>
        <div style={{ padding: "2rem", textAlign: "center", color: "#ff1744" }}>
          {error}. <button onClick={loadDashboard}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.leftHeader}>
          <div className={styles.leftMenuTrigger} onClick={() => setSidePanelOpen(true)}>
            <span></span><span></span><span></span>
          </div>
          <div>
            <h2 className={styles.companyName}>{company?.name}</h2>
            <span className={styles.subText}>Conference Dashboard</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <img src={company?.logo_url || "/logo.png"} className={styles.logo} alt="Logo" />
          <button className={styles.logoBtn} title="Logout" onClick={() => {
            localStorage.clear();
            router.replace("/auth/login");
          }}>
            ⏻
          </button>
        </div>
      </header>

      {/* ================= PUBLIC LINK ================= */}
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

      {/* ================= BOOKINGS OVERVIEW ================= */}
      <div className={styles.section}>
        <h3>Bookings Overview ({formatNiceDate(selectedDate)})</h3>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {["yesterday", "today", "tomorrow"].map((d) => (
            <button
              key={d}
              className={filterDay === d ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => setFilterDay(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ================= STATS GRID ================= */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Active Rooms</span>
          <b>{stats?.rooms || 0}</b>
        </div>
        <div className={styles.statCard}>
          <span>Total Bookings</span>
          <b>{stats?.totalBookings || 0}</b>
        </div>
        <div className={styles.statCard}>
          <span>Today's Bookings</span>
          <b>{stats?.todayBookings || 0}</b>
        </div>
      </div>

      {/* ================= BOOKING PROGRESS ================= */}
      {stats?.totalBookings > 0 && (
        <div className={styles.section}>
          <h3>Booking Usage</h3>
          <p>Total: <b>{stats?.totalBookings}</b> bookings</p>
          <div className={styles.barOuter}>
            <div 
              className={styles.barInner}
              style={{
                width: `${bookingPercentage}%`,
                background: bookingPercentage >= 90 ? "#ff1744" : bookingPercentage >= 70 ? "#ff9800" : "#00c853",
              }}
            />
          </div>
          <small>Max capacity: 1000 bookings</small>
        </div>
      )}

      {/* ================= RECENT ACTIVITY ================= */}
      <div className={styles.section}>
        <h3>Recent Activity</h3>
        {stats?.todayBookings === 0 ? (
          <p>No bookings today. <button className={styles.btnPrimary} onClick={loadDashboard}>Refresh</button></p>
        ) : (
          <div>
            <p>{stats?.todayBookings} bookings recorded for today</p>
            <button 
              className={styles.btnPrimary}
              onClick={() => router.push("/conference/bookings")}
            >
              View All Bookings
            </button>
          </div>
        )}
      </div>

      {/* ================= SLIDING PANEL - ALL CONFERENCE MANAGEMENT ================= */}
      {sidePanelOpen && (
        <div className={styles.leftPanel}>
          <div className={styles.leftPanelHeader}>
            <h3>Conference Management</h3>
            <button className={styles.leftCloseBtn} onClick={() => {
              setSidePanelOpen(false);
              setEditingRoomId(null);
              setEditName("");
            }}>
              Close ✖
            </button>
          </div>

          {/* ================= PLAN INFO ================= */}
          {plan && (
            <div className={styles.section} style={{ marginBottom: 20 }}>
              <h4>Plan: <b>{plan.plan}</b></h4>
              <p>
                Active: <b>{plan.used}</b> / {plan.plan_limit} 
                {plan.remaining !== null && ` | Remaining: <b>${plan.remaining}</b>`}
                {plan.inactive_rooms > 0 && ` | Inactive: <b>${plan.inactive_rooms}</b>`}
              </p>
              {plan.remaining === 0 && (
                <p style={{ color: "#ff9800" }}>Upgrade plan to add/rename more rooms</p>
              )}
              <div className={styles.barOuter}>
                <div 
                  className={styles.barInner}
                  style={{
                    width: `${roomPercentage}%`,
                    background: roomPercentage >= 90 ? "#ff1744" : roomPercentage >= 70 ? "#ff9800" : "#00c853",
                  }}
                />
              </div>
            </div>
          )}

          {/* ================= 1. RENAME ROOMS ================= */}
          <div className={styles.section}>
            <h4>🔄 Rename Rooms</h4>
            <input
              className={styles.inputSearch}
              placeholder="Search all rooms..."
              value={searchRooms}
              onChange={(e) => setSearchRooms(e.target.value)}
            />
            <ul className={styles.roomList}>
              {filteredRooms.map((r) => (
                <li key={r.id}>
                  <b>{r.room_name}</b> (#{r.room_number})
                  {editingRoomId === r.id ? (
                    <>
                      <input
                        className={styles.inputEdit}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button className={styles.btnSuccess} onClick={() => saveRoomName(r.id)}>
                        Save
                      </button>
                      <button className={styles.btnWarning} onClick={() => {
                        setEditingRoomId(null);
                        setEditName("");
                      }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.btnSecondary}
                      disabled={plan?.remaining === 0}
                      onClick={() => {
                        setEditingRoomId(r.id);
                        setEditName(r.room_name);
                      }}
                    >
                      Rename
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* ================= 2. CREATE ROOM ================= */}
          <div className={styles.section}>
            <h4>➕ Create New Room</h4>
            <input
              className={styles.inputField}
              placeholder="Room Name"
              value={newRoom.room_name}
              onChange={(e) => setNewRoom({...newRoom, room_name: e.target.value})}
              disabled={!canCreateRoom}
            />
            <input
              className={styles.inputField}
              placeholder="Room Number"
              value={newRoom.room_number}
              onChange={(e) => setNewRoom({...newRoom, room_number: e.target.value})}
              type="number"
              disabled={!canCreateRoom}
            />
            <button 
              className={styles.btnPrimary}
              disabled={!canCreateRoom || !newRoom.room_name?.trim() || !newRoom.room_number}
              onClick={createRoom}
            >
              {canCreateRoom ? "Create Room" : "Upgrade Required"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
