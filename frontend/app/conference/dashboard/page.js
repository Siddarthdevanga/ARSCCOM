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

  const [activeTab, setActiveTab] = useState("dashboard");

  /* Sidebar toggle */
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ================= DATE FILTER ================= */
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

  /* ================= FILTERED BOOKINGS ================= */
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.booking_date?.split("T")[0] === selectedDate &&
        b.status === "BOOKED"
    );
  }, [bookings, selectedDate]);

  /* ================= DEPARTMENT STATS ================= */
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
    <div className={styles.layoutWrapper}>
      {/* ================= SIDEBAR ================= */}
      <aside
        className={`${styles.sidebar} ${
          sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed
        }`}
      >
        <h2 className={styles.sidebarTitle}>Conference</h2>

        <div className={styles.navList}>
          <div
            className={`${styles.navItem} ${
              activeTab === "dashboard" ? styles.activeNav : ""
            }`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </div>

          <div
            className={`${styles.navItem} ${
              activeTab === "rooms" ? styles.activeNav : ""
            }`}
            onClick={() => setActiveTab("rooms")}
          >
            Manage Rooms
          </div>

          <div
            className={`${styles.navItem} ${
              activeTab === "settings" ? styles.activeNav : ""
            }`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </div>
        </div>

        <button
          className={styles.logoutBtn}
          onClick={() => {
            localStorage.clear();
            router.replace("/auth/login");
          }}
        >
          Logout
        </button>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <div className={`${styles.mainContent} ${sidebarOpen ? styles.shift : ""}`}>
        {/* Toggle Button */}
        <button
          className={styles.menuToggle}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>

        {/* HEADER */}
        <header className={styles.header}>
          <div>
            <h2 className={styles.companyName}>{company.name}</h2>
            <span className={styles.subText}>Conference Dashboard</span>
          </div>

          <img
            src={company.logo_url || "/logo.png"}
            className={styles.logo}
            alt="Logo"
          />
        </header>

        {/* PUBLIC URL */}
        <div className={styles.publicBox}>
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
            Book Room
          </button>
        </div>

        {/* ================= DASHBOARD TAB ================= */}
        {activeTab === "dashboard" && (
          <>
            {/* DATE FILTER */}
            <div className={styles.section}>
              <h3>Bookings View</h3>
              <div className={styles.dayToggle}>
                <button
                  onClick={() => setFilterDay("yesterday")}
                  className={
                    filterDay === "yesterday"
                      ? styles.dayActive
                      : styles.dayBtn
                  }
                >
                  Yesterday
                </button>

                <button
                  onClick={() => setFilterDay("today")}
                  className={
                    filterDay === "today"
                      ? styles.dayActive
                      : styles.dayBtn
                  }
                >
                  Today
                </button>

                <button
                  onClick={() => setFilterDay("tomorrow")}
                  className={
                    filterDay === "tomorrow"
                      ? styles.dayActive
                      : styles.dayBtn
                  }
                >
                  Tomorrow
                </button>
              </div>
            </div>

            {/* STATS */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span>Conference Rooms</span>
                <b>{stats.rooms}</b>
              </div>

              <div className={styles.statCard}>
                <span>Bookings ({filterDay})</span>
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

            {/* RECENT BOOKINGS */}
            <div className={styles.section}>
              <h3>Bookings</h3>

              {filteredBookings.length === 0 && <p>No bookings</p>}

              {filteredBookings.slice(0, 6).map((b) => (
                <div key={b.id} className={styles.bookingRow}>
                  <div>
                    <b>{b.room_name}</b> (#{b.room_number})
                    <p>{b.booking_date}</p>
                  </div>

                  <div>
                    {b.start_time} - {b.end_time}
                  </div>

                  <span className={styles.status}>BOOKED</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ================= ROOMS TAB ================= */}
        {activeTab === "rooms" && (
          <div className={styles.section}>
            <h3>Manage Conference Rooms</h3>

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
        )}

        {/* ================= SETTINGS TAB ================= */}
        {activeTab === "settings" && (
          <div className={styles.section}>
            <h3>Settings</h3>
            <p>More features coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
