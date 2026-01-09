"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ================= DATE ================= */
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

/* ================= TIME ================= */
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

  /* ================= DATE HELPERS ================= */
  const getDate = useCallback((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  }, []);

  const dates = useMemo(() => ({
    today: getDate(0),
    yesterday: getDate(-1),
    tomorrow: getDate(1),
  }), [getDate]);

  const selectedDate = dates[filterDay];

  /* ================= LOAD DASHBOARD ================= */
  const loadDashboard = async () => {
    try {
      const [statsRes, roomsRes, bookingsRes, planRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings"),
        apiFetch("/api/conference/plan-usage"),
      ]);

      // ✅ Backward + forward compatible
      setStats(statsRes?.summary || statsRes);
      setRooms(roomsRes || []);
      setBookings(bookingsRes || []);
      setPlan(planRes);

      const bookingLimit =
        planRes?.plan === "TRIAL" ? 100 :
        planRes?.plan === "BUSINESS" ? 1000 :
        Infinity;

      setBookingPlan({
        limit: bookingLimit,
        used: statsRes?.summary?.totalBookings || statsRes?.totalBookings || 0,
        remaining:
          bookingLimit === Infinity
            ? null
            : Math.max(
                bookingLimit -
                  (statsRes?.summary?.totalBookings ||
                    statsRes?.totalBookings ||
                    0),
                0
              ),
      });
    } catch (err) {
      console.error(err);
      router.replace("/auth/login");
    } finally {
      setLoading(false);
    }
  };

  /* ================= INIT ================= */
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

  /* ================= SAVE ROOM ================= */
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

  /* ================= FILTER BOOKINGS ================= */
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const date = b.booking_date?.includes("T")
        ? b.booking_date.split("T")[0]
        : b.booking_date;
      return date === selectedDate && b.status === "BOOKED";
    });
  }, [bookings, selectedDate]);

  /* ================= DEPARTMENT STATS ================= */
  const departmentStats = useMemo(() => {
    const map = {};
    filteredBookings.forEach((b) => {
      const dep = b.department || "Unknown";
      map[dep] = (map[dep] || 0) + 1;
    });
    return Object.entries(map);
  }, [filteredBookings]);

  /* ================= LOADING ================= */
  if (loading) {
    return <div className={styles.container}>Loading dashboard…</div>;
  }

  if (!company || !stats) {
    return <div className={styles.container}>Unable to load dashboard</div>;
  }

  /* ================= VALUES ================= */
  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  const roomPercentage =
    plan?.plan_limit === "UNLIMITED"
      ? 100
      : Math.min(100, Math.round((plan?.used / plan?.plan_limit) * 100));

  const bookingPercentage =
    bookingPlan?.limit === Infinity
      ? 100
      : Math.min(100, Math.round((bookingPlan?.used / bookingPlan?.limit) * 100));

  /* ================= UI ================= */
  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.leftHeader}>
          <div
            className={styles.leftMenuTrigger}
            onClick={() => setSidePanelOpen(true)}
          >
            <span></span><span></span><span></span>
          </div>

          <div>
            <h2 className={styles.companyName}>{company.name}</h2>
            <span className={styles.subText}>Conference Dashboard</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <img
            src={company.logo_url || "/logo.png"}
            className={styles.logo}
            alt="Logo"
          />
          <button
            className={styles.logoBtn}
            title="Logout"
            onClick={() => {
              localStorage.clear();
              router.replace("/auth/login");
            }}
          >
            ⏻
          </button>
        </div>
      </header>

      {/* PUBLIC LINK */}
      <div className={styles.publicBox}>
        <div className={styles.publicRow}>
          <div>
            <p className={styles.publicTitle}>Public Booking URL</p>
            <a href={publicURL} target="_blank" className={styles.publicLink}>
              {publicURL}
            </a>
          </div>

          <button
            className={styles.bookBtn}
            onClick={() => router.push("/conference/bookings")}
          >
            Book
          </button>
        </div>
      </div>

      {/* ================= LEFT PANEL ================= */}
      {sidePanelOpen && (
        <div className={styles.leftPanel}>
          <div className={styles.leftPanelHeader}>
            <h3>Conference Plan + Room Rename</h3>
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

          {/* ROOM RENAME LIST */}
          <div className={styles.leftPanelContent}>
            <ul className={styles.roomList}>
              {rooms.map((r) => (
                <li key={r.id}>
                  <b>{r.room_name}</b> (#{r.room_number})

                  {editingRoomId === r.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => saveRoomName(r.id)}>Save</button>
                      <button
                        onClick={() => {
                          setEditingRoomId(null);
                          setEditName("");
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={!r.is_active}
                      title={
                        r.is_active
                          ? "Rename room"
                          : "Room locked. Upgrade plan to rename."
                      }
                      style={{
                        opacity: r.is_active ? 1 : 0.4,
                        cursor: r.is_active ? "pointer" : "not-allowed",
                      }}
                      onClick={() => {
                        if (!r.is_active) return;
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

      {/* ================= KPIs ================= */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Conference Rooms</span>
          <b>{stats.activeRooms ?? stats.rooms}</b>
        </div>

        <div className={styles.statCard}>
          <span>Bookings ({filterDay.toUpperCase()})</span>
          <b>{filteredBookings.length}</b>
        </div>

        <div className={styles.statCard}>
          <span>Departments Using Rooms</span>
          <b>{departmentStats.length}</b>
        </div>
      </div>
    </div>
  );
}
