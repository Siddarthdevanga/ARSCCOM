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
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");
  
  // Create Room Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ room_name: '', room_number: '' });
  
  const [filterDay, setFilterDay] = useState("today");
  const [searchRooms, setSearchRooms] = useState("");

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
      
      const [statsRes, roomsRes, planRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/plan-usage"),
      ]);

      setStats(statsRes ?? {});
      setRooms(Array.isArray(roomsRes) ? roomsRes : []);
      
      // Client-side booking filter simulation using dashboard stats
      setFilteredBookings(statsRes?.todayBookings || 0);
      
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
      setShowCreateModal(false);
      setNewRoom({ room_name: '', room_number: '' });
      loadDashboard();
    } catch (err) {
      alert(err?.message || "Failed to create room");
    }
  };

  /* ================= SAVE ROOM NAME ================= */
  const saveRoomName = async (roomId) => {
    const newName = editName.trim();
    const original = rooms.find((r) => r.id === roomId)?.room_name;

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
    return rooms.filter(r => 
      r.room_name.toLowerCase().includes(searchRooms.toLowerCase()) ||
      r.room_number.toString().includes(searchRooms)
    ).sort((a, b) => a.room_number - b.room_number);
  }, [rooms, searchRooms]);

  /* ================= CALCULATIONS ================= */
  const roomPercentage = plan?.plan_limit === "UNLIMITED" 
    ? 100 
    : Math.min(100, Math.round((plan?.used / parseInt(plan?.plan_limit)) * 100 || 0));

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

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  /* ================= ERROR STATE ================= */
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

      {/* ================= PLAN USAGE ================= */}
      {plan && (
        <div className={styles.section}>
          <h3>Conference Plan</h3>
          <p>
            <b>{plan.plan}</b> | Used <b>{plan.used}</b> / {plan.plan_limit} 
            {plan.remaining !== null && ` | Remaining: <b>${plan.remaining}</b>`}
          </p>
          {plan.remaining === 0 && (
            <p style={{ color: "#ff9800" }}>
              Upgrade plan to add/rename more rooms
            </p>
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

      {/* ================= SIDE PANEL ================= */}
      {sidePanelOpen && (
        <div className={styles.leftPanel}>
          <div className={styles.leftPanelHeader}>
            <h3>Rooms Management</h3>
            <button className={styles.leftCloseBtn} onClick={() => {
              setSidePanelOpen(false);
              setEditingRoomId(null);
              setEditName("");
            }}>
              Close ✖
            </button>
          </div>

          {/* Create Room Modal */}
          <div style={{ marginBottom: 20, padding: "1rem", background: "#f5f5f5", borderRadius: 8 }}>
            <h4>Create New Room</h4>
            <input
              placeholder="Room Name"
              value={newRoom.room_name}
              onChange={(e) => setNewRoom({...newRoom, room_name: e.target.value})}
              style={{ width: "100%", marginBottom: 8, padding: 8 }}
              disabled={!canCreateRoom}
            />
            <input
              placeholder="Room Number"
              value={newRoom.room_number}
              onChange={(e) => setNewRoom({...newRoom, room_number: e.target.value})}
              style={{ width: "100%", marginBottom: 8, padding: 8 }}
              type="number"
              disabled={!canCreateRoom}
            />
            <button 
              onClick={createRoom}
              disabled={!canCreateRoom}
              style={{
                width: "100%",
                padding: "8px",
                background: canCreateRoom ? "#00c853" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: 4
              }}
            >
              {canCreateRoom ? "Create Room" : "Upgrade Required"}
            </button>
          </div>

          {/* Room Search */}
          <input
            placeholder="Search rooms..."
            value={searchRooms}
            onChange={(e) => setSearchRooms(e.target.value)}
            style={{ width: "100%", padding: "8px", marginBottom: 16 }}
          />

          {/* Rooms List */}
          <ul className={styles.roomList}>
            {filteredRooms.map((r) => (
              <li key={r.id}>
                <b>{r.room_name}</b> (#{r.room_number})
                {editingRoomId === r.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      style={{ marginLeft: 8, padding: 4 }}
                    />
                    <button onClick={() => saveRoomName(r.id)} style={{ marginLeft: 4 }}>Save</button>
                    <button onClick={() => {setEditingRoomId(null); setEditName("");}} style={{ marginLeft: 4 }}>Cancel</button>
                  </>
                ) : (
                  <button
                    disabled={plan?.remaining === 0}
                    onClick={() => {
                      setEditingRoomId(r.id);
                      setEditName(r.room_name);
                    }}
                    style={{
                      marginLeft: 8,
                      opacity: plan?.remaining === 0 ? 0.5 : 1,
                      background: "#2196f3",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: plan?.remaining === 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    Rename
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ================= DATE FILTER ================= */}
      <div className={styles.section}>
        <h3>Bookings Overview ({formatNiceDate(selectedDate)})</h3>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {["yesterday", "today", "tomorrow"].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDay(d)}
              style={{
                background: filterDay === d ? "#ffeb3b" : "#f5f5f5",
                color: "#000",
                padding: "8px 16px",
                borderRadius: 20,
                border: "1px solid #ddd",
                cursor: "pointer"
              }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ================= STATS GRID ================= */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Rooms</span>
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

      {/* ================= BOOKINGS ================= */}
      <div className={styles.section}>
        <h3>Recent Activity</h3>
        {stats?.todayBookings === 0 ? (
          <p>No bookings today. <button onClick={loadDashboard}>Refresh</button></p>
        ) : (
          <div>
            <p>{stats?.todayBookings} bookings recorded for today</p>
            <button 
              onClick={() => router.push("/conference/bookings")}
              style={{ marginTop: 10, padding: "8px 16px", background: "#2196f3", color: "white", border: "none", borderRadius: 4 }}
            >
              View All Bookings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
