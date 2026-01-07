"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ======================================================
   DATE FORMATTER
====================================================== */
const formatNiceDate = (value) => {
  if (!value) return "-";

  try {
    let str = String(value).trim();

    if (str.includes("T")) str = str.split("T")[0];
    if (str.includes(" ")) str = str.split(" ")[0];

    const [y, m, d] = str.split("-");
    const names = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];

    return `${names[Number(m) - 1]} ${d}, ${y}`;
  } catch {
    return value;
  }
};

/* ======================================================
   TIME FORMATTER
====================================================== */
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

  /* LEFT PANEL */
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");

  /* FILTER DATE */
  const [filterDay, setFilterDay] = useState("today");

  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const today = getDate(0);
  const yesterday = getDate(-1);
  const tomorrow = getDate(1);

  const selectedDate =
    filterDay === "yesterday"
      ? yesterday
      : filterDay === "tomorrow"
      ? tomorrow
      : today;

  /* ================= LOAD DASHBOARD ================= */
  const loadDashboard = async () => {
    try {
      const [statsRes, roomsRes, bookingsRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings"),
      ]);

      setStats(statsRes);
      setRooms(roomsRes || []);
      setBookings(bookingsRes || []);
      setLoading(false);
    } catch {
      router.replace("/auth/login");
    }
  };

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

  /* ================= SAVE ROOM NAME ================= */
  const saveRoomName = async (roomId) => {
    if (!editName.trim()) return;

    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: editName.trim() }),
      });

      setEditingRoomId(null);
      setEditName("");
      loadDashboard();
    } catch (err) {
      alert(
        err?.message ||
          "Plan limit exceeded. Upgrade plan to manage rooms"
      );
    }
  };

  /* ================= FILTER BOOKINGS ================= */
  const filteredBookings = useMemo(() => {
    return (bookings || []).filter(
      (b) =>
        (b.booking_date?.includes("T")
          ? b.booking_date.split("T")[0]
          : b.booking_date) === selectedDate &&
        b.status === "BOOKED"
    );
  }, [bookings, selectedDate]);

  /* ================= DEPARTMENT ANALYTICS ================= */
  const departmentStats = useMemo(() => {
    const map = {};
    filteredBookings.forEach((b) => {
      const dep = b.department || "Unknown";
      map[dep] = (map[dep] || 0) + 1;
    });
    return Object.entries(map);
  }, [filteredBookings]);

  if (loading || !company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  /* ================= PLAN REMAINING FROM BACKEND ================= */
  const remaining = stats?.remaining?.conference_bookings_left ?? "unlimited";
  const roomsLeft = stats?.remaining?.rooms_left ?? "unlimited";

  const planExceeded =
    remaining !== "unlimited" && remaining <= 0;

  /* ================= ROOM LIMIT USING BACKEND ================= */
  let allowedRooms = Infinity;

  if (roomsLeft !== "unlimited") {
    allowedRooms = stats.rooms - roomsLeft;
    if (allowedRooms < 0) allowedRooms = 0;
    allowedRooms = Math.max(stats.rooms - roomsLeft, 0);
    allowedRooms = stats.rooms - roomsLeft === 0 ? stats.rooms : stats.rooms - roomsLeft;
  }

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.leftHeader}>
          <div
            className={styles.leftMenuTrigger}
            onClick={() => setSidePanelOpen(true)}
          >
            <span></span>
            <span></span>
            <span></span>
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

      {/* ================= PUBLIC URL ================= */}
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
            <h3>Rename Conference Rooms</h3>

            <button
              className={styles.leftCloseBtn}
              onClick={() => {
                setSidePanelOpen(false);
                setEditingRoomId(null);
              }}
            >
              Close ✖
            </button>
          </div>

          <div className={styles.leftPanelContent}>
            <ul className={styles.roomList}>
              {rooms.map((r, index) => {
                const locked =
                  roomsLeft !== "unlimited" && index >= allowedRooms;

                return (
                  <li key={r.id}>
                    <b
                      style={{
                        color: locked ? "#aaa" : "#fff",
                      }}
                    >
                      {r.room_name}
                    </b>{" "}
                    (#{r.room_number})

                    {locked && (
                      <span style={{ color: "red", marginLeft: 8 }}>
                        — Locked (Plan Limit)
                      </span>
                    )}

                    {editingRoomId === r.id ? (
                      <>
                        <input
                          value={editName}
                          disabled={locked}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <button
                          disabled={locked}
                          onClick={() => saveRoomName(r.id)}
                        >
                          Save
                        </button>
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
                        disabled={locked}
                        onClick={() => {
                          setEditingRoomId(r.id);
                          setEditName(r.room_name);
                        }}
                      >
                        {locked ? "Locked" : "Rename"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ================= DATE FILTER ================= */}
      <div className={styles.section}>
        <h3>Bookings View</h3>

        <div style={{ display: "flex", gap: 10 }}>
          {["yesterday", "today", "tomorrow"].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDay(d)}
              style={{
                background: filterDay === d ? "yellow" : "#ffffff",
                color: "#000",
                padding: "8px 18px",
                borderRadius: 30,
                border: "none",
              }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ================= KPIs ================= */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Conference Rooms</span>
          <b>{stats.rooms}</b>
        </div>

        <div className={styles.statCard}>
          <span>Bookings ({filterDay.toUpperCase()})</span>
          <b>{filteredBookings.length}</b>
        </div>

        <div className={styles.statCard}>
          <span>Departments Using Rooms</span>
          <b>{departmentStats.length}</b>
        </div>

        <div
          className={styles.statCard}
          style={{
            background: planExceeded ? "#ffcccc" : "#e8ffe8",
            color: "#000",
          }}
        >
          <span>Remaining Conference Bookings</span>
          <b>
            {remaining === "unlimited" ? "Unlimited" : remaining}
          </b>

          {planExceeded && (
            <p style={{ color: "red", marginTop: 6 }}>
              Plan limit exceeded. Contact administrator
            </p>
          )}
        </div>
      </div>

      {/* ================= DEPARTMENT STATS ================= */}
      <div className={styles.section}>
        <h3>Department Wise Bookings</h3>

        {departmentStats.length === 0 ? (
          <p>No bookings</p>
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

      {/* ================= BOOKINGS LIST ================= */}
      <div className={styles.section}>
        <h3>Bookings List</h3>

        {filteredBookings.length === 0 && <p>No bookings</p>}

        {filteredBookings.slice(0, 6).map((b) => (
          <div key={b.id} className={styles.bookingRow}>
            <div>
              <b>{b.room_name}</b> (#{b.room_number})
              <p>{formatNiceDate(b.booking_date)}</p>
            </div>

            <div>
              {formatNiceTime(b.start_time)} –{" "}
              {formatNiceTime(b.end_time)}
            </div>

            <div className={styles.status}>{b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
