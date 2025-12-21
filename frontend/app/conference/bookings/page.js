"use client";

import { useState } from "react";
import styles from "./style.module.css";

export default function ConferenceBookingPage() {
  //-----------------------------
  // COMPANY INFO (STATIC DEMO)
  //-----------------------------
  const companyName = "Demo Company Pvt Ltd";
  const companyLogo = "/logo_placeholder.png";

  //-----------------------------
  // TIME SLOT DATA
  //-----------------------------
  const timeSlots = [
    "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM",
    "11:30 AM", "12:00 PM", "12:30 PM",
    "1:00 PM", "1:30 PM", "2:00 PM",
    "2:30 PM", "3:00 PM", "3:30 PM",
    "4:00 PM", "4:30 PM", "5:00 PM",
    "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM"
  ];

  //-----------------------------
  // BOOKING STATE
  //-----------------------------
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [purpose, setPurpose] = useState("");

  // DUMMY BOOKINGS LIST
  const [bookings, setBookings] = useState([
    {
      id: 1,
      date: "2025-12-08",
      start: "10:00 AM",
      end: "11:00 AM",
      purpose: "Team Sync"
    },
    {
      id: 2,
      date: "2025-12-08",
      start: "2:00 PM",
      end: "3:00 PM",
      purpose: "Client Call"
    }
  ]);

  //-----------------------------
  // CREATE NEW BOOKING
  //-----------------------------
  const createBooking = () => {
    if (!selectedDate || !startTime || !endTime || !purpose) {
      alert("Please fill all details.");
      return;
    }

    const newBooking = {
      id: bookings.length + 1,
      date: selectedDate,
      start: startTime,
      end: endTime,
      purpose,
    };

    setBookings([...bookings, newBooking]);
    alert("Booking Created!");

    // Reset fields
    setSelectedDate("");
    setStartTime("");
    setEndTime("");
    setPurpose("");
  };

  //-----------------------------
  // CANCEL BOOKING
  //-----------------------------
  const cancelBooking = (id) => {
    setBookings(bookings.filter((b) => b.id !== id));
  };

  //-----------------------------
  // EDIT BOOKING TIME
  //-----------------------------
  const editBooking = (id) => {
    const newStart = prompt("Enter new Start Time (Ex: 11:00 AM):");
    const newEnd = prompt("Enter new End Time (Ex: 12:00 PM):");

    if (!newStart || !newEnd) return;

    setBookings(
      bookings.map((b) =>
        b.id === id ? { ...b, start: newStart, end: newEnd } : b
      )
    );
  };

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brand}>WHEELBRAND</div>

        <div className={styles.companySection}>
          <span className={styles.companyName}>{companyName}</span>
          <img src={companyLogo} className={styles.companyLogo} alt="logo" />
        </div>
      </header>

      <h1 className={styles.pageTitle}>Conference Room Booking</h1>

      <div className={styles.layoutBox}>

        {/* LEFT SIDE — SCHEDULE VIEW */}
        <div className={styles.calendarBox}>
          <h2 className={styles.sectionTitle}>Schedule View</h2>

          <div className={styles.timelineHeader}>
            <span>{selectedDate || "Select a date →"}</span>
          </div>

          <div className={styles.timeline}>
            {timeSlots.map((slot) => (
              <div key={slot} className={styles.timeRow}>
                <div className={styles.timeLabel}>{slot}</div>

                {/* If booking exists, show highlight */}
                <div className={styles.timeCell}>
                  {bookings
                    .filter((b) => b.date === selectedDate && b.start === slot)
                    .map((b) => (
                      <div key={b.id} className={styles.bookingBlock}>
                        {b.purpose}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* MANAGE BOOKINGS */}
          <h2 className={styles.sectionTitle} style={{ marginTop: "25px" }}>
            Manage Your Bookings
          </h2>

          <div className={styles.bookingList}>
            {bookings.map((b) => (
              <div key={b.id} className={styles.bookingItem}>
                <div>
                  <strong>{b.date}</strong> — {b.start} to {b.end}
                  <br />
                  <span>{b.purpose}</span>
                </div>

                <div className={styles.bookingActions}>
                  <button className={styles.editBtn} onClick={() => editBooking(b.id)}>
                    Edit
                  </button>
                  <button className={styles.cancelBtn} onClick={() => cancelBooking(b.id)}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE — BOOKING FORM */}
        <div className={styles.formBox}>
          <h2 className={styles.sectionTitle}>Book a Slot</h2>

          <label>Date *</label>
          <input
            type="date"
            className={styles.input}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <label>Start Time *</label>
          <select className={styles.input} value={startTime} onChange={(e) => setStartTime(e.target.value)}>
            <option value="">Select</option>
            {timeSlots.map((t) => <option key={t}>{t}</option>)}
          </select>

          <label>End Time *</label>
          <select className={styles.input} value={endTime} onChange={(e) => setEndTime(e.target.value)}>
            <option value="">Select</option>
            {timeSlots.map((t) => <option key={t}>{t}</option>)}
          </select>

          <label>Purpose *</label>
          <input
            className={styles.input}
            placeholder="Enter meeting purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />

          <button className={styles.submitBtn} onClick={createBooking}>
            Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
}
