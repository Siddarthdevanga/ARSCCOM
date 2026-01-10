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
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [plan, setPlan] = useState(null);
  const [bookingPlan, setBookingPlan] = useState(null);

  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");

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
      const [statsRes, roomsRes, bookingsRes, planRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/plan-usage"),
      ]);

      setStats(statsRes);
      setRooms(roomsRes || []);
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
      console.error(err);
      router.replace("/auth/login");
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
  const saveRoomName = async (roomId) => {
    const newName = editName.trim();
    const original = rooms.find((r) => r.id === roomId)?.room_name;

    if (!newName) return;
    if (newName === original) {
      setEditingRoomId(null);
      return;
    }

    try {
      await apiFetch("/api/conference/rooms/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roomId, room_name: newName }),
      });

      setEditingRoomId(null);
      setEditName("");
      loadDashboard();
    } catch (err) {
      alert(err?.message || "Failed to rename room");
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

  if (loading) return <div className={styles.container}>Loading dashboard…</div>;
  if (!company || !stats) return <div className={styles.container}>Unable to load dashboard</div>;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  const roomPercentage =
    plan?.limit === "UNLIMITED"
      ? 100
      : Math.min(100, Math.round((plan?.used / plan?.limit) * 100));

  const bookingPercentage =
    bookingPlan?.limit === Infinity
      ? 100
      : Math.min(100, Math.round((bookingPlan?.used / bookingPlan?.limit) * 100));

  return (
    <div className={styles.container}>
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
          
          {/* BACK BUTTON REPLACING LOGOUT */}
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
              }}
            >
              Close ✖
            </button>
          </div>

          {plan && (
            <div style={{ padding: "0 20px", marginBottom: 20 }}>
              <p>Plan: <b>{plan.plan}</b></p>
              {plan.limit === "UNLIMITED" ? (
                <p>Unlimited Rooms 🎉</p>
              ) : (
                <p>Rooms: <b>{plan.used}</b> / {plan.limit}</p>
              )}
              <div className={styles.barOuter}>
                <div
                  className={styles.barInner}
                  style={{
                    width: roomPercentage + "%",
                    background: roomPercentage >= 90 ? "#ff1744" : "#00c853",
                  }}
                ></div>
              </div>
            </div>
          )}

          <div className={styles.leftPanelContent}>
            <ul className={styles.roomList}>
              {rooms.map((r) => (
                <li key={r.id}>
                  <b>{r.room_name}</b> (#{r.room_number})
                  {editingRoomId === r.id ? (
                    <div style={{ marginTop: 5 }}>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => saveRoomName(r.id)}>Save</button>
                      <button onClick={() => setEditingRoomId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      disabled={plan?.remaining === 0 && !r.is_active}
                      style={{
                        opacity: !r.is_active && plan?.remaining === 0 ? 0.5 : 1,
                        cursor: !r.is_active && plan?.remaining === 0 ? "not-allowed" : "pointer",
                      }}
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
          <b>{stats.rooms}</b>
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
