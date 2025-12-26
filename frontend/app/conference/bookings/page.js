"use client";

import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

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
      setBookings(bookingsRes.slice(0, 5));
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

  /* =====================================================
     INLINE RENAME ROOM
  ====================================================== */
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const renameRoom = async (roomId) => {
    try {
      await apiFetch(`/api/conference/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({ room_name: renameValue })
      });

      setEditingRoomId(null);
      setRenameValue("");
      loadDashboard();
    } catch (err) {
      alert(err.message || "Rename failed");
    }
  };

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    localStorage.clear();
    router.replace("/auth/login");
  };

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
            onClick={handleLogout}
          >
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
          <span>Total Bookings</span>
          <b>{stats.totalBookings}</b>
        </div>
      </div>

      {/* ================= ROOMS ================= */}
      <div className={styles.section}>
        <h3>Conference Rooms</h3>

        {error && <p className={styles.error}>{error}</p>}

        <ul className={styles.roomList}>
          {rooms.map((r) => (
            <li key={r.id} className={styles.roomItem}>
              <span className={styles.roomNumber}>
                #{r.room_number}
              </span>

              {editingRoomId === r.id ? (
                <>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className={styles.renameInput}
                  />

                  <button
                    className={styles.saveBtn}
                    onClick={() => renameRoom(r.id)}
                  >
                    Save
                  </button>

                  <button
                    className={styles.cancelBtn}
                    onClick={() => {
                      setEditingRoomId(null);
                      setRenameValue("");
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.roomName}>
                    {r.room_name}
                  </span>

                  <button
                    className={styles.renameBtn}
                    onClick={() => {
                      setEditingRoomId(r.id);
                      setRenameValue(r.room_name);
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

        {bookings.map((b) => (
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
