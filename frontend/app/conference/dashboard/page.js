"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../utils/api";
import styles from "./style.module.css";

/* ---------------- DATE ---------------- */
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

/* ---------------- TIME ---------------- */
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
  const getDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const today = getDate(0);
  const yesterday = getDate(-1);
  const tomorrow = getDate(1);

  const selectedDate =
    filterDay === "yesterday" ? yesterday :
    filterDay === "tomorrow" ? tomorrow :
    today;

  /* ================= LOAD DASHBOARD ================= */
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

      let bookingLimit =
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

    } catch {
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

  /* ================= ADDITION: RENAME ELIGIBILITY ================= */
  const canRenameRoom = (index) => {
    if (!plan) return false;
    if (plan.limit === "UNLIMITED") return true;
    return index < plan.limit;
  };

  /* ================= SAVE ROOM ================= */
  const saveRoomName = async (roomId) => {
    const newName = editName.trim();
    const original = rooms.find((r) => r.id === roomId)?.room_name;

    if (!newName) return alert("Room name is required");
    if (newName === original) {
      setEditingRoomId(null);
      return;
    }

    try {
      await apiFetch(`/api/conference/rooms/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roomId, room_name: newName }),
      });

      setEditingRoomId(null);
      setEditName("");
      loadDashboard();
    } catch (err) {
      alert(err?.message || "Upgrade your plan to rename this room");
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

  if (loading || !company || !stats) return null;

  const publicURL = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/book/${company.slug}`;

  return (
    <div className={styles.container}>

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

          <div className={styles.leftPanelContent}>
            <ul className={styles.roomList}>
              {rooms.map((r, index) => (
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
                  ) : canRenameRoom(index) ? (
                    <button
                      onClick={() => {
                        setEditingRoomId(r.id);
                        setEditName(r.room_name);
                      }}
                    >
                      Rename
                    </button>
                  ) : (
                    <button
                      disabled
                      title="Upgrade your plan to rename this room"
                      style={{ opacity: 0.5, cursor: "not-allowed" }}
                    >
                      🔒 Upgrade Plan
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
