"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Users, Calendar, DoorOpen, LayoutDashboard, Lock, ArrowLeft, ExternalLink, ShieldAlert, X } from "lucide-react";

/**
 * MOCKED API FETCH FOR PREVIEW
 * In your actual app, this would use your existing apiFetch utility.
 */
const mockApiFetch = async (url, options = {}) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (url === "/api/conference/plan-usage") {
    return {
      plan: "TRIAL",
      limit: 2,
      used: 2,
      totalRooms: 10,
      remaining: 0,
      upgradeRequired: true
    };
  }
  if (url === "/api/conference/dashboard") {
    return { rooms: 2, totalBookings: 85, todayBookings: 3 };
  }
  if (url === "/api/conference/rooms") {
    return [
      { id: 1, room_number: 1, room_name: "Boardroom A", capacity: 12, is_active: 1 },
      { id: 2, room_number: 2, room_name: "Creative Hub", capacity: 6, is_active: 1 },
      { id: 3, room_number: 3, room_name: "Zoom Room", capacity: 4, is_active: 0 },
      { id: 4, room_number: 4, room_name: "Quiet Pod", capacity: 2, is_active: 0 },
    ];
  }
  if (url === "/api/conference/bookings") {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return [
      { id: 101, room_name: "Boardroom A", room_number: 1, booking_date: today, start_time: "09:00", end_time: "10:30", status: "BOOKED", department: "Sales" },
      { id: 102, room_name: "Creative Hub", room_number: 2, booking_date: today, start_time: "11:00", end_time: "12:00", status: "BOOKED", department: "Marketing" },
      { id: 103, room_name: "Boardroom A", room_number: 1, booking_date: yesterday, start_time: "14:00", end_time: "15:00", status: "BOOKED", department: "HR" },
    ];
  }
  return {};
};

/* ================= DATE FORMATTER ================= */
const formatNiceDate = (value) => {
  if (!value) return "-";
  try {
    let str = String(value).trim();
    if (str.includes("T")) str = str.split("T")[0];
    const [y, m, d] = str.split("-");
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[Number(m) - 1]} ${d}, ${y}`;
  } catch { return value; }
};

/* ================= TIME FORMATTER ================= */
const formatNiceTime = (value) => {
  if (!value) return "-";
  try {
    let str = String(value).trim();
    if (str.includes("T")) str = str.split("T")[1];
    const parts = str.split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
  } catch { return "-"; }
};

export default function App() {
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
        mockApiFetch("/api/conference/dashboard"),
        mockApiFetch("/api/conference/rooms"),
        mockApiFetch("/api/conference/bookings"),
        mockApiFetch("/api/conference/plan-usage"),
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
        remaining: bookingLimit === Infinity ? null : Math.max(bookingLimit - (statsRes.totalBookings || 0), 0),
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCompany({ name: "Trial Corp", slug: "trial-corp", logo_url: "" });
    loadDashboard();
  }, []);

  /* ================= ACTIONS ================= */
  const saveRoomName = async (roomId) => {
    const newName = editName.trim();
    if (!newName) return;
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, room_name: newName } : r));
    setEditingRoomId(null);
    setEditName("");
  };

  /* ================= COMPUTED DATA ================= */
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const bDate = b.booking_date?.includes("T") ? b.booking_date.split("T")[0] : b.booking_date;
      return bDate === selectedDate && b.status === "BOOKED";
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

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50 font-bold text-slate-400">Loading dashboard…</div>;
  if (!company || !stats) return <div className="flex items-center justify-center h-screen bg-slate-50 font-bold text-slate-400">Unable to load dashboard</div>;

  const publicURL = `booking.com/${company.slug}`;
  const roomPercentage = plan?.limit === "UNLIMITED" ? 100 : Math.min(100, Math.round((plan?.used / plan?.limit) * 100));
  const bookingPercentage = bookingPlan?.limit === Infinity ? 100 : Math.min(100, Math.round((bookingPlan?.used / bookingPlan?.limit) * 100));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      {/* HEADER SECTION */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div 
            className="flex flex-col gap-1 cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors" 
            onClick={() => setSidePanelOpen(true)}
          >
            <span className="w-6 h-0.5 bg-indigo-600"></span>
            <span className="w-6 h-0.5 bg-indigo-600"></span>
            <span className="w-4 h-0.5 bg-indigo-600"></span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">{company.name}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-[10px]">Conference Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
             <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <button
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors text-lg"
            title="Back to Home"
            onClick={() => {}}
          >
            ↩
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-8">
        {/* PUBLIC URL SECTION */}
        <section className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-indigo-100 font-bold text-xs uppercase tracking-widest">Public Booking URL</p>
            <p className="text-lg font-mono opacity-90 break-all select-all">{publicURL}</p>
          </div>
          <button className="w-full md:w-auto bg-white text-indigo-600 px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-transform active:scale-95 shadow-lg">
            Book
          </button>
        </section>

        {/* BOOKING LIMITS / PROGRESS */}
        {bookingPlan && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-end">
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Conference Booking Usage</h3>
              <div className="text-right">
                {bookingPlan.limit === Infinity ? (
                  <p className="text-sm font-bold text-emerald-600">Unlimited Bookings Available 🎉</p>
                ) : (
                  <p className="text-xs font-bold text-slate-500">
                    Used <b className="text-slate-900">{bookingPlan.used}</b> / {bookingPlan.limit} | 
                    Remaining: <b className="text-indigo-600">{bookingPlan.remaining}</b>
                  </p>
                )}
              </div>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative border border-slate-50">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: bookingPercentage + "%",
                  background:
                    bookingPercentage >= 90 ? "#ff1744" : 
                    bookingPercentage >= 70 ? "#ff9800" : "#00c853",
                }}
              ></div>
            </div>
          </section>
        )}

        {/* DASHBOARD KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest block mb-1">Active Rooms</span>
            <b className="text-4xl font-black text-slate-800">{stats.rooms}</b>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest block mb-1">{filterDay.toUpperCase()} Bookings</span>
            <b className="text-4xl font-black text-slate-800">{filteredBookings.length}</b>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest block mb-1">Active Departments</span>
            <b className="text-4xl font-black text-slate-800">{departmentStats.length}</b>
          </div>
        </div>

        {/* BOOKING FILTERS & SCHEDULE */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Daily Schedule</h3>
             <div className="flex bg-slate-200/50 p-1 rounded-full w-fit">
              {["yesterday", "today", "tomorrow"].map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDay(d)}
                  className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-tighter transition-all ${
                    filterDay === d ? "bg-white text-indigo-600 shadow-sm scale-105" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredBookings.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 p-12 text-center rounded-2xl">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No bookings scheduled</p>
              </div>
            ) : (
              filteredBookings.map((b) => (
                <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between group hover:border-indigo-300 transition-all shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
                      {b.room_number}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">{b.room_name}</h4>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatNiceDate(b.booking_date)}</span>
                         <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                         <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{b.department || "General"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-indigo-600 text-lg">{formatNiceTime(b.start_time)} – {formatNiceTime(b.end_time)}</p>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">
                      {b.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* SLIDE-OUT PANEL: ROOM MANAGEMENT */}
      {sidePanelOpen && (
        <div className="fixed inset-0 z-50 flex overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidePanelOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b flex items-center justify-between bg-indigo-600 text-white">
              <h3 className="font-black uppercase tracking-widest text-sm">Plan & Room Settings</h3>
              <button onClick={() => setSidePanelOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              {plan && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Current Plan</span>
                      <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{plan.plan}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700 font-bold">Active Rooms</span>
                      <span className="text-slate-900 font-black">{plan.used} / {plan.limit === "UNLIMITED" ? '∞' : plan.limit}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-700" 
                        style={{ width: `${roomPercentage}%`, background: roomPercentage >= 90 ? "#ff1744" : "#00c853" }} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage Your Rooms</h4>
                <ul className="space-y-3">
                  {rooms.map((r) => (
                    <li key={r.id} className={`p-4 rounded-2xl border transition-all ${r.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${r.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                            {r.room_number}
                          </span>
                          <span className={`font-black ${r.is_active ? 'text-slate-800' : 'text-slate-400'}`}>
                            {r.room_name}
                          </span>
                        </div>
                        {!r.is_active && (
                          <div className="flex items-center gap-1 text-red-500 font-black text-[10px] uppercase tracking-tighter">
                            <Lock className="w-3 h-3" /> Locked
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        {editingRoomId === r.id ? (
                          <div className="flex gap-2">
                            <input
                              className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                            />
                            <button 
                              onClick={() => saveRoomName(r.id)} 
                              className="bg-indigo-600 text-white px-5 rounded-xl text-xs font-black uppercase tracking-widest"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={plan?.remaining === 0 && !r.is_active}
                            className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              r.is_active 
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                                : 'bg-slate-200/50 text-slate-400 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              setEditingRoomId(r.id);
                              setEditName(r.room_name);
                            }}
                          >
                            {r.is_active ? 'Rename' : 'Upgrade to Unlock'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
