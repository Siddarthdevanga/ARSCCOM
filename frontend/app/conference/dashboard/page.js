"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

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

  /* DATE FILTER */
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

  /* LOAD DASHBOARD */
  const loadDashboard = async () => {
    try {
      const [statsRes, roomsRes, bookingsRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings"),
      ]);

      setStats(statsRes);
      setRooms(roomsRes);
      setBookings(bookingsRes);
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

  /* SAVE ROOM RENAME */
  const saveRoomName = async (roomId) => {
    if (!editName.trim()) return;

    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify({
          room_name: editName.trim(),
        }),
      });

      setEditingRoomId(null);
      setEditName("");
      loadDashboard();
    } catch (err) {
      alert(err.message || "Failed to rename room");
    }
  };

  /* FILTER BOOKINGS */
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.booking_date?.split("T")[0] === selectedDate &&
        b.status === "BOOKED"
    );
  }, [bookings, selectedDate]);

  /* DEPARTMENT STATS */
  const departmentStats = useMemo(() => {
    const map = {};
    filteredBookings.forEach((b) => {
      const dep = b.department || "Unknown";
      if (!map[dep]) map[dep] = 0;
      map[dep]++;
    });
    return Object.entries(map);
  }, [filteredBookings]);

  if (loading || !company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div>
          <h2 className={styles.companyName}>{company.name}</h2>
          <span className={styles.subText}>Conference Dashboard</span>
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

      {/* PUBLIC URL */}
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

      {/* LEFT BAR */}
      <div className={styles.leftBar}>
        <button onClick={() => setSidePanelOpen(true)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* LEFT PANEL */}
      {sidePanelOpen && (
        <div className={styles.leftPanel}>
          <div className={styles.leftPanelHeader}>
            <h3>Rename the Conference Rooms</h3>

            <button
              className={styles.leftCloseBtn}
              onClick={() => {
                setSidePanelOpen(false);
                setEditingRoomId(null);
              }}
            >
              ✖
            </button>
          </div>

          <div className={styles.leftPanelContent}>
            <ul className={styles.roomList}>
              {rooms.map((r) => (
                <li key={r.id}>
                  #{r.room_number} —{" "}
                  {editingRoomId === r.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
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
                    <>
                      {r.room_name}{" "}
                      <button
                        onClick={() => {
                          setEditingRoomId(r.id);
                          setEditName(r.room_name);
                        }}
                      >
                        Rename
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* DATE FILTER */}
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

      {/* STATS */}
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
      </div>

      {/* DEPARTMENT STATS */}
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

      {/* BOOKINGS LIST */}
      <div className={styles.section}>
        <h3>Bookings List</h3>

        {filteredBookings.length === 0 && <p>No bookings</p>}

        {filteredBookings.slice(0, 6).map((b) => (
          <div key={b.id} className={styles.bookingRow}>
            <div>
              <b>{b.room_name}</b> (#{b.room_number})
              <p>{b.booking_date}</p>
            </div>
            <div>
              {b.start_time} – {b.end_time}
            </div>
            <div className={styles.status}>{b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

