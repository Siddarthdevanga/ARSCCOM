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

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editName, setEditName] = useState("");

  /* ================= LOAD DASHBOARD ================= */
  const loadDashboard = async () => {
    try {
      const [statsRes, roomsRes, bookingsRes] = await Promise.all([
        apiFetch("/api/conference/dashboard"),
        apiFetch("/api/conference/rooms"),
        apiFetch("/api/conference/bookings")
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

  /* ================= SAVE RENAMED ROOM ================= */
  const saveRoomName = async (roomId) => {
    if (!editName.trim()) return;

    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify({
          room_name: editName.trim()
        })
      });

      setEditingRoomId(null);
      setEditName("");
      loadDashboard();
    } catch (err) {
      alert(err.message || "Failed to rename room");
    }
  };

  /* ================= DEPARTMENT WISE BOOKINGS ================= */
  const departmentStats = useMemo(() => {
    const map = {};

    bookings.forEach((b) => {
      const dep = b.department || "Unknown";
      if (!map[dep]) map[dep] = 0;
      map[dep]++;
    });

    return Object.entries(map);
  }, [bookings]);

  if (loading || !company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>
      {/* ================= HEADER ================= */}
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

      {/* ================= PUBLIC BOOK URL ================= */}
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

      {/* ================= STATS ================= */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Conference Rooms</span>
          <b>{stats.rooms}</b>
        </div>

        <div className={styles.statCard}>
          <span>Today’s Bookings</span>
          <b>{stats.todayBookings}</b>
        </div>

        <div className={styles.statCard}>
          <span>Departments Using Rooms</span>
          <b>{departmentStats.length}</b>
        </div>
      </div>

      {/* ================= DEPARTMENT WISE BOOKINGS ================= */}
      <div className={styles.section}>
        <h3>Department Wise Bookings</h3>

        {departmentStats.length === 0 ? (
          <p>No bookings yet</p>
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

      {/* ================= ROOMS ================= */}
      <div className={styles.section}>
        <h3>Conference Rooms</h3>

        <ul className={styles.roomList}>
          {rooms.map((r) => (
            <li key={r.id}>
              #{r.room_number} —
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

      {/* ================= RECENT BOOKINGS ================= */}
      <div className={styles.section}>
        <h3>Recent Bookings</h3>

        {bookings.length === 0 && <p>No bookings yet</p>}

        {bookings.slice(0, 5).map((b) => (
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
